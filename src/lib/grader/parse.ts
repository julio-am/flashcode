import type { RunOutcome } from "../runner/types";
import { USER_FILE } from "./assemble";
import type { CheckResult, Diagnostic, GradeResult } from "./types";

const DIAG = new RegExp(`^${USER_FILE.replace(".", "\\.")}:(\\d+):(\\d+): (error|warning|note): (.*)$`);

export function parseDiagnostics(compilerOutput: string): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const line of compilerOutput.split("\n")) {
    const m = DIAG.exec(line);
    if (m) {
      out.push({
        line: Number(m[1]),
        col: Number(m[2]),
        severity: m[3] as Diagnostic["severity"],
        message: m[4],
      });
    }
  }
  return out;
}

/** Turn a raw compile-and-run into a verdict. Only lines carrying this job's token count. */
export function parseOutcome(outcome: RunOutcome, token: string): GradeResult {
  const diagnostics = parseDiagnostics(outcome.compile.output);
  if (!outcome.compile.ok || !outcome.run) {
    return {
      status: "compile_error",
      checks: [],
      compileOutput: outcome.compile.output.trim(),
      diagnostics,
    };
  }

  const { run } = outcome;
  const prefix = `@@FLASH ${token} `;
  const checks: CheckResult[] = [];
  const userLines: string[] = [];
  let doneCount: number | null = null;

  for (const line of run.stdout.split("\n")) {
    if (!line.startsWith(prefix)) {
      userLines.push(line);
      continue;
    }
    try {
      const rec = JSON.parse(line.slice(prefix.length));
      if (rec.done === true) doneCount = Number(rec.count);
      else checks.push({ ok: rec.ok === true, name: String(rec.name), detail: rec.detail });
    } catch {
      userLines.push(line);
    }
  }

  const stdout = userLines.join("\n").replace(/^\n+|\n+$/g, "") || undefined;
  const stderr = run.stderr.trim() || undefined;
  const base = { checks, diagnostics, stdout, stderr, timeMs: run.timeMs };

  if (run.timedOut) {
    return {
      ...base,
      status: "timeout",
      message: "Time limit exceeded. Check for an infinite loop, or an approach that is too slow.",
    };
  }
  if (doneCount === null || doneCount !== checks.length) {
    const how = run.signal
      ? `was killed by ${run.signal}`
      : run.exitCode !== 0
        ? `exited with code ${run.exitCode}`
        : "stopped before the grader finished";
    return {
      ...base,
      status: "runtime_error",
      message: `Your program ${how}. Look for out-of-range indexing, null pointers, or an early exit.`,
    };
  }
  const passed = checks.length > 0 && checks.every((c) => c.ok);
  return { ...base, status: passed ? "passed" : "failed" };
}
