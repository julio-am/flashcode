import { Rating } from "ts-fsrs";
import { z } from "zod";
import { getProblem } from "@/lib/problems";
import { recordReview } from "@/lib/scheduler";
import { currentUser } from "@/lib/session";

const Body = z.object({ problemId: z.string(), presentationId: z.uuid() });

// Showing the solution before a graded answer counts as a miss for scheduling.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const problem = getProblem(parsed.data.problemId);
  if (!problem) return Response.json({ error: "Unknown problem." }, { status: 404 });
  const user = await currentUser();
  await recordReview({
    userId: user.id,
    problemId: problem.id,
    presentationId: parsed.data.presentationId,
    rating: Rating.Again,
    reason: "revealed",
  });
  return Response.json({ solution: problem.solution });
}
