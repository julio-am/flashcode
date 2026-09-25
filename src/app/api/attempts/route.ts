import { z } from "zod";
import { rateLimited } from "@/lib/attempts";
import { db, schema } from "@/lib/db";
import { MAX_CODE_LENGTH, validateSubmission } from "@/lib/grader/assemble";
import { getProblem } from "@/lib/problems";
import { enqueueGrade } from "@/lib/queue";
import { currentUser } from "@/lib/session";

const Body = z.object({
  problemId: z.string(),
  presentationId: z.uuid(),
  code: z.string().max(MAX_CODE_LENGTH),
  elapsedMs: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const { problemId, presentationId, code, elapsedMs } = parsed.data;
  if (!getProblem(problemId)) return Response.json({ error: "Unknown problem." }, { status: 404 });

  const user = await currentUser();
  const invalid = validateSubmission(code);
  if (invalid) return Response.json({ error: invalid }, { status: 422 });
  const limited = await rateLimited(user.id);
  if (limited) return Response.json({ error: limited }, { status: 429 });

  const [attempt] = await db()
    .insert(schema.attempts)
    .values({ userId: user.id, problemId, presentationId, code, elapsedMs })
    .returning({ id: schema.attempts.id });
  await enqueueGrade({ attemptId: attempt.id });
  return Response.json({ attemptId: attempt.id }, { status: 202 });
}
