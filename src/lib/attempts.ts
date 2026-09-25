import { and, count, eq, gte, inArray } from "drizzle-orm";
import { db, schema } from "./db";

export const RATE_LIMIT = { perMinute: 10, inFlight: 2 };

/** Returns a reason string if the user should wait before submitting again. */
export async function rateLimited(userId: string): Promise<string | null> {
  const since = new Date(Date.now() - 60_000);
  const [recent] = await db()
    .select({ n: count() })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, userId), gte(schema.attempts.createdAt, since)));
  if (recent.n >= RATE_LIMIT.perMinute) return "Too many submissions in the last minute. Take a breath and try again shortly.";
  const [pending] = await db()
    .select({ n: count() })
    .from(schema.attempts)
    .where(and(eq(schema.attempts.userId, userId), inArray(schema.attempts.status, ["queued", "running"])));
  if (pending.n >= RATE_LIMIT.inFlight) return "Your previous submission is still being graded.";
  return null;
}
