/**
 * The one seam between the app and wherever untrusted code actually runs.
 * Production uses the sandbox runner (runner/ in this repo: nsjail inside
 * gVisor); a local g++ serves development, and Judge0 remains an option.
 */
export interface RunRequest {
  /** C++ source that starts with #include "flash.h"; the runner supplies that header. */
  source: string;
  stdin: string;
}

export interface RunOutcome {
  compile: { ok: boolean; output: string };
  run?: {
    stdout: string;
    stderr: string;
    exitCode: number | null;
    signal: string | null;
    timedOut: boolean;
    timeMs: number;
  };
}

export interface Runner {
  readonly name: string;
  run(req: RunRequest): Promise<RunOutcome>;
}

// runner/server.py keeps its own copy of these; change both together.
export const LIMITS = {
  compileSeconds: 10,
  runWallSeconds: 3,
  runCpuSeconds: 2,
  memoryMb: 256,
  maxOutputBytes: 64 * 1024,
};

/** v1 is scoped to one language standard. Every runner compiles with it. */
export const CXX_STD = "c++23";
