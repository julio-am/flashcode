import { and, eq } from "drizzle-orm";
import { db, schema } from "./db";
import { grade } from "./grader/grade";
import type { GradeResult } from "./grader/types";
import { getProblem } from "./problems";
import { getRunner } from "./runner";
import { ratingFor, recordReview } from "./scheduler";

// Worker-only: the web app never imports this, so it never touches a runner.

// Results that say something about recall. A compile error or a rejected
// submission doesn't move the schedule; the user can fix it and resubmit.
const SCHEDULED: GradeResult["status"][] = ["passed", "failed", "runtime_error", "timeout"];

/** Worker entry point: grade one queued attempt and update the schedule. Safe to retry. */
export async function gradeAttempt(attemptId: string): Promise<void> {
  const claimed = await db()
    .update(schema.attempts)
    .set({ status: "running" })
    .where(and(eq(schema.attempts.id, attemptId), eq(schema.attempts.status, "queued")))
    .returning();
  const attempt = claimed[0];
  if (!attempt) return; // already graded, or picked up by another worker

  const problem = getProblem(attempt.problemId);
  let result: GradeResult;
  try {
    if (!problem) throw new Error(`unknown problem ${attempt.problemId}`);
    result = await grade(problem, attempt.code, getRunner());
  } catch (e) {
    console.error(`[grade] attempt ${attemptId} failed`, e);
    result = { status: "internal_error", cases: [], diagnostics: [], message: "The grader hit a problem. Try again." };
  }

  await db()
    .update(schema.attempts)
    .set({ status: result.status, result, finishedAt: new Date() })
    .where(eq(schema.attempts.id, attemptId));

  if (SCHEDULED.includes(result.status)) {
    await recordReview({
      userId: attempt.userId,
      problemId: attempt.problemId,
      presentationId: attempt.presentationId,
      rating: ratingFor({ passed: result.status === "passed", elapsedMs: attempt.elapsedMs }),
      reason: result.status,
    });
  }
}
