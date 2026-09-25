import { createHash } from "node:crypto";
import { flashHeader } from "./flash-header";
import type { RunOutcome, RunRequest, Runner } from "./types";

export interface SandboxConfig {
  url: string; // e.g. http://10.0.0.5:8080, the runner service from runner/
  token: string;
  timeoutMs?: number;
}

export function sandboxConfigFromEnv(env = process.env): SandboxConfig {
  const url = env.FLASH_SANDBOX_URL;
  if (!url) throw new Error("FLASH_RUNNER=sandbox needs FLASH_SANDBOX_URL");
  const token = env.FLASH_SANDBOX_TOKEN;
  if (!token) throw new Error("FLASH_RUNNER=sandbox needs FLASH_SANDBOX_TOKEN (the runner's RUNNER_TOKEN)");
  return { url: url.replace(/\/+$/, ""), token };
}

/**
 * Sends code to the FlashCode sandbox runner (runner/ in this repo): g++ and
 * the program each run in their own nsjail, inside gVisor, on a separate
 * machine. The runner has flash.h and its precompiled header baked in; the
 * header's hash goes with every request so a stale runner image fails loudly
 * instead of grading against an old header.
 */
export class SandboxRunner implements Runner {
  readonly name = "sandbox";
  private readonly headerSha256 = createHash("sha256").update(flashHeader()).digest("hex");

  constructor(
    private readonly cfg: SandboxConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async run(req: RunRequest): Promise<RunOutcome> {
    const res = await this.fetchImpl(`${this.cfg.url}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.cfg.token}` },
      body: JSON.stringify({ source: req.source, stdin: req.stdin, headerSha256: this.headerSha256 }),
      signal: AbortSignal.timeout(this.cfg.timeoutMs ?? 60_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Sandbox runner returned HTTP ${res.status} ${detail}`.trim());
    }
    return (await res.json()) as RunOutcome;
  }
}
