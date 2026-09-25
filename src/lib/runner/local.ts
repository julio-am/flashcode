import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { flashHeader } from "./flash-header";
import { LIMITS, cxxStd, type RunOutcome, type RunRequest, type Runner } from "./types";

/**
 * Compiles and runs with the g++ on this machine, under rlimits and timeouts.
 *
 * DEVELOPMENT ONLY. This is not a sandbox: the program runs as your user and
 * can read your files and use the network. It refuses to start in production
 * unless FLASH_ALLOW_LOCAL_RUNNER=1 (for CI that grades only reference code).
 */
export class LocalRunner implements Runner {
  readonly name = "local";
  private pchReady: Promise<string> | null = null;

  constructor(private readonly cxx = process.env.CXX ?? "g++") {}

  private flags(): string[] {
    return [
      `-std=${cxxStd()}`,
      "-O0",
      "-pipe",
      "-Wall",
      "-fdiagnostics-plain-output",
      "-fmax-errors=10",
      "-ftemplate-depth=256",
    ];
  }

  /** Precompile flash.h (and with it <bits/stdc++.h>) once per flag set. */
  private headerDir(): Promise<string> {
    this.pchReady ??= (async () => {
      const header = flashHeader();
      const key = createHash("sha1").update(header + this.flags().join(" ")).digest("hex").slice(0, 12);
      const dir = path.join(os.tmpdir(), `flashcode-pch-${key}`);
      const gch = path.join(dir, "flash.h.gch");
      if (!fs.existsSync(gch)) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, "flash.h"), header);
        const tmp = `${gch}.${process.pid}.tmp`;
        const r = await exec(this.cxx, [...this.flags(), "-x", "c++-header", "flash.h", "-o", tmp], {
          cwd: dir,
          timeoutMs: 120_000,
        });
        if (r.code === 0) fs.renameSync(tmp, gch);
        else console.warn("[local runner] could not precompile flash.h; compiling without PCH\n" + r.stderr);
      }
      return dir;
    })();
    return this.pchReady;
  }

  async run(req: RunRequest): Promise<RunOutcome> {
    const includeDir = await this.headerDir();
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "flashcode-job-"));
    try {
      fs.writeFileSync(path.join(work, "main.cpp"), req.source);
      const compile = await exec(
        this.cxx,
        [...this.flags(), "-I", includeDir, "main.cpp", "-o", "prog"],
        { cwd: work, timeoutMs: LIMITS.compileSeconds * 1000 },
      );
      if (compile.code !== 0 || compile.timedOut) {
        const output = compile.timedOut
          ? `Compilation took longer than ${LIMITS.compileSeconds}s and was stopped.`
          : compile.stderr;
        return { compile: { ok: false, output } };
      }
      const started = Date.now();
      const run = await exec(
        "prlimit",
        [
          `--as=${LIMITS.memoryMb * 1024 * 1024}`,
          `--cpu=${LIMITS.runCpuSeconds}:${LIMITS.runCpuSeconds + 1}`,
          `--fsize=${LIMITS.maxOutputBytes}`,
          "--core=0",
          "--",
          "./prog",
        ],
        { cwd: work, timeoutMs: LIMITS.runWallSeconds * 1000, stdin: req.stdin },
      );
      return {
        compile: { ok: true, output: compile.stderr },
        run: {
          stdout: run.stdout,
          stderr: run.stderr,
          exitCode: run.code,
          signal: run.signal,
          timedOut: run.timedOut || run.signal === "SIGXCPU",
          timeMs: Date.now() - started,
        },
      };
    } finally {
      fs.rmSync(work, { recursive: true, force: true });
    }
  }
}

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  timedOut: boolean;
}

function exec(
  cmd: string,
  args: string[],
  opts: { cwd: string; timeoutMs: number; stdin?: string },
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd: opts.cwd, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const cap = LIMITS.maxOutputBytes;
    const killGroup = () => {
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    };
    const timer = setTimeout(() => {
      timedOut = true;
      killGroup();
    }, opts.timeoutMs);
    child.stdout.on("data", (d: Buffer) => {
      if (stdout.length < cap) stdout += d.toString();
      else killGroup();
    });
    child.stderr.on("data", (d: Buffer) => {
      if (stderr.length < cap) stderr += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, signal, timedOut });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(opts.stdin ?? "");
  });
}
