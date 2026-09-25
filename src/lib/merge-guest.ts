import { and, eq, isNull, sql } from "drizzle-orm";
import type { db as getDb } from "./db";
import { schema } from "./db";

type Db = ReturnType<typeof getDb>;

/**
 * Move a guest's attempts and review schedule onto a signed-in user, then
 * delete the guest. Where both have a schedule for the same problem, the more
 * recently reviewed one wins. Returns false if there was no such guest (it was
 * already merged, or the id belongs to a real account).
 */
export async function mergeGuest(database: Db, guestId: string, userId: string): Promise<boolean> {
  if (guestId === userId) return false;
  return database.transaction(async (tx) => {
    const [guest] = await tx
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, guestId), isNull(schema.users.email)))
      .for("update");
    if (!guest) return false;

    await tx.update(schema.attempts).set({ userId }).where(eq(schema.attempts.userId, guestId));
    await tx.update(schema.reviewLogs).set({ userId }).where(eq(schema.reviewLogs.userId, guestId));
    await tx.execute(sql`
      insert into review_states (user_id, problem_id, card, due, updated_at)
      select ${userId}, problem_id, card, due, updated_at from review_states where user_id = ${guestId}
      on conflict (user_id, problem_id) do update
        set card = excluded.card, due = excluded.due, updated_at = excluded.updated_at
        where review_states.updated_at < excluded.updated_at`);
    await tx.delete(schema.users).where(eq(schema.users.id, guestId));
    return true;
  });
}
