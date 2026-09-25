import type { RunOutcome } from "../runner/types";
import { USER_FILE } from "./assemble";
import type { Diagnostic, GradeResult, TestCase } from "./types";

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

function tidy(lines: string[]): string | undefined {
  // flash.h starts every record on a fresh line, which leaves blank lines
  // around the user's own output; drop them at the edges only.
  return lines.join("\n").replace(/^\n+|\n+$/g, "") || undefined;
}

interface OpenCase extends TestCase {
  lines: string[];
  ended: boolean;
}

/** Turn a raw compile-and-run into a verdict. Only lines carrying this job's token count. */
export function parseOutcome(outcome: RunOutcome, token: string): GradeResult {
  const diagnostics = parseDiagnostics(outcome.compile.output);
  if (!outcome.compile.ok || !outcome.run) {
    return {
      status: "compile_error",
      cases: [],
      compileOutput: outcome.compile.output.trim(),
      diagnostics,
    };
  }

  const { run } = outcome;
  const prefix = `@@FLASH ${token} `;
  const open: OpenCase[] = [];
  const outside: string[] = [];
  let current: OpenCase | null = null;
  let checkCount = 0;
  let doneCount: number | null = null;

  const begin = (inputs: TestCase["inputs"]): OpenCase => {
    const c: OpenCase = { index: open.length, ok: false, inputs, checks: [], lines: [], ended: false };
    open.push(c);
    return c;
  };

  for (const line of run.stdout.split("\n")) {
    if (!line.startsWith(prefix)) {
      (current ? current.lines : outside).push(line);
      continue;
    }
    let rec: Record<string, unknown>;
    try {
      rec = JSON.parse(line.slice(prefix.length));
    } catch {
      (current ? current.lines : outside).push(line);
      continue;
    }
    if (rec.done === true) {
      doneCount = Number(rec.count);
    } else if (rec.case === "begin") {
      const inputs = Array.isArray(rec.inputs) ? rec.inputs : [];
      current = begin(inputs.map((i: { name: unknown; value: unknown }) => ({ name: String(i.name), value: String(i.value) })));
    } else if (rec.case === "end") {
      if (current) current.ended = true;
      current = null;
    } else if ("ok" in rec) {
      const c: OpenCase = current ?? (current = begin([]));
      checkCount++;
      c.checks.push({
        ok: rec.ok === true,
        hint: String(rec.hint ?? ""),
        ...("label" in rec
          ? { label: String(rec.label), actual: String(rec.actual), expected: String(rec.expected) }
          : {}),
      });
    }
  }

  const cases: TestCase[] = open.map(({ lines, ended, ...c }) => ({
    ...c,
    ok: ended && c.checks.length > 0 && c.checks.every((k) => k.ok),
    console: tidy(lines),
    ...(ended ? {} : { incomplete: true }),
  }));
  const base = { cases, diagnostics, stdout: tidy(outside), stderr: run.stderr.trim() || undefined, timeMs: run.timeMs };

  if (run.timedOut) {
    return {
      ...base,
      status: "timeout",
      message: "Time limit exceeded. Check for an infinite loop, or an approach that is too slow.",
    };
  }
  if (doneCount === null || doneCount !== checkCount) {
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
  const passed = cases.length > 0 && cases.every((c) => c.ok);
  return { ...base, status: passed ? "passed" : "failed" };
}
