import { inlineFlashHeader } from "./flash-header";
import { LIMITS, type RunOutcome, type RunRequest, type Runner } from "./types";

export interface Judge0Config {
  url: string; // e.g. https://judge0-ce.p.rapidapi.com or your own instance
  apiKey?: string;
  apiKeyHeader?: string;
  languageId: number;
  compilerOptions: string;
  pollMs?: number;
  timeoutMs?: number;
}

export function judge0ConfigFromEnv(env = process.env): Judge0Config {
  const url = env.JUDGE0_URL;
  if (!url) throw new Error("FLASH_RUNNER=judge0 needs JUDGE0_URL");
  const rapid = url.includes("rapidapi.com");
  return {
    url: url.replace(/\/+$/, ""),
    apiKey: env.JUDGE0_API_KEY || undefined,
    apiKeyHeader: env.JUDGE0_API_KEY_HEADER || (rapid ? "X-RapidAPI-Key" : "X-Auth-Token"),
    // 54 is "C++ (GCC 9.2.0)" on Judge0 CE. Newer instances list newer GCCs
    // under other ids; check GET /languages on yours.
    languageId: Number(env.JUDGE0_LANGUAGE_ID ?? 54),
    compilerOptions: env.JUDGE0_COMPILER_OPTIONS ?? `-std=${env.FLASH_CXX_STD ?? "c++17"} -O0 -Wall`,
  };
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
const unb64 = (s: string | null | undefined) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

interface Judge0Submission {
  stdout: string | null;
  stderr: string | null;
  compile_output: string | null;
  message: string | null;
  status: { id: number; description: string };
  time: string | null;
}

/** Runs code on a Judge0 instance (hosted or self-hosted). */
export class Judge0Runner implements Runner {
  readonly name = "judge0";

  constructor(
    private readonly cfg: Judge0Config,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.cfg.apiKey && this.cfg.apiKeyHeader) h[this.cfg.apiKeyHeader] = this.cfg.apiKey;
    if (this.cfg.url.includes("rapidapi.com")) h["X-RapidAPI-Host"] = new URL(this.cfg.url).host;
    return h;
  }

  async run(req: RunRequest): Promise<RunOutcome> {
    const create = await this.fetchImpl(`${this.cfg.url}/submissions?base64_encoded=true&wait=false`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        source_code: b64(inlineFlashHeader(req.source)),
        language_id: this.cfg.languageId,
        compiler_options: this.cfg.compilerOptions,
        stdin: b64(req.stdin),
        cpu_time_limit: LIMITS.runCpuSeconds,
        wall_time_limit: LIMITS.runWallSeconds,
        memory_limit: LIMITS.memoryMb * 1024,
        max_processes_and_or_threads: 32,
        enable_network: false,
      }),
    });
    if (!create.ok) throw new Error(`Judge0 rejected the submission: HTTP ${create.status} ${await create.text()}`);
    const { token } = (await create.json()) as { token: string };

    const deadline = Date.now() + (this.cfg.timeoutMs ?? 30_000);
    const fields = "stdout,stderr,compile_output,message,status,time";
    for (;;) {
      const res = await this.fetchImpl(
        `${this.cfg.url}/submissions/${token}?base64_encoded=true&fields=${fields}`,
        { headers: this.headers() },
      );
      if (!res.ok) throw new Error(`Judge0 poll failed: HTTP ${res.status}`);
      const sub = (await res.json()) as Judge0Submission;
      if (sub.status.id > 2) return toOutcome(sub);
      if (Date.now() > deadline) throw new Error("Judge0 did not finish in time");
      await new Promise((r) => setTimeout(r, this.cfg.pollMs ?? 400));
    }
  }
}

// Judge0 status ids: 3 accepted, 4 wrong answer (unused, no expected_output),
// 5 time limit, 6 compile error, 7-12 runtime errors, 13 internal, 14 exec format.
export function toOutcome(sub: Judge0Submission): RunOutcome {
  const id = sub.status.id;
  if (id === 6) return { compile: { ok: false, output: unb64(sub.compile_output) } };
  if (id === 13 || id === 14) throw new Error(`Judge0 error: ${sub.status.description} ${unb64(sub.message)}`);
  const signalMatch = /SIG[A-Z]+/.exec(sub.status.description);
  return {
    compile: { ok: true, output: unb64(sub.compile_output) },
    run: {
      stdout: unb64(sub.stdout),
      stderr: unb64(sub.stderr),
      exitCode: id === 3 || id === 4 ? 0 : id === 11 ? 1 : null,
      signal: signalMatch ? signalMatch[0] : null,
      timedOut: id === 5,
      timeMs: Math.round(Number(sub.time ?? 0) * 1000),
    },
  };
}
