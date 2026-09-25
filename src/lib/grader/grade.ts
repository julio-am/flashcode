import { randomBytes } from "node:crypto";
import type { Problem } from "../problems";
import type { Runner } from "../runner/types";
import { assemble, validateSubmission } from "./assemble";
import { parseOutcome } from "./parse";
import type { GradeResult } from "./types";

export async function grade(problem: Problem, code: string, runner: Runner): Promise<GradeResult> {
  const rejected = validateSubmission(code);
  if (rejected) return { status: "rejected", cases: [], diagnostics: [], message: rejected };

  // A fresh token per job, handed to the program on stdin. Output that
  // doesn't carry it (for example the user printing a fake PASS) is ignored.
  const token = randomBytes(12).toString("hex");
  const outcome = await runner.run({ source: assemble(problem.harness, code), stdin: token + "\n" });
  return parseOutcome(outcome, token);
}
