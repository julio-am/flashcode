import { and, asc, eq } from "drizzle-orm";
import { createEmptyCard, fsrs, generatorParameters, Rating, TypeConvert, type Card, type Grade } from "ts-fsrs";
import { db, schema } from "./db";
import { loadCatalog, type Problem } from "./problems";

// FSRS decides when each problem comes back. We rate a presentation from its
// first graded run: a pass is Good (Hard if it took a long time), a fail or
// peeking at the solution first is Again.
const scheduler = fsrs(generatorParameters({ enable_fuzz: true }));

export const SLOW_ANSWER_MS = 3 * 60 * 1000;

export function ratingFor(outcome: { passed: boolean; elapsedMs?: number | null }): Grade {
  if (!outcome.passed) return Rating.Again;
  if (outcome.elapsedMs != null && outcome.elapsedMs > SLOW_ANSWER_MS) return Rating.Hard;
  return Rating.Good;
}

/** Apply a rating once per presentation. Returns false if this presentation was already rated. */
export async function recordReview(args: {
  userId: string;
  problemId: string;
  presentationId: string;
  rating: Grade;
  reason: string;
  now?: Date;
}): Promise<boolean> {
  const now = args.now ?? new Date();
  return db().transaction(async (tx) => {
    const inserted = await tx
      .insert(schema.reviewLogs)
      .values({
        presentationId: args.presentationId,
        userId: args.userId,
        problemId: args.problemId,
        rating: args.rating,
        reason: args.reason,
      })
      .onConflictDoNothing()
      .returning({ id: schema.reviewLogs.presentationId });
    if (inserted.length === 0) return false;

    const [existing] = await tx
      .select()
      .from(schema.reviewStates)
      .where(and(eq(schema.reviewStates.userId, args.userId), eq(schema.reviewStates.problemId, args.problemId)))
      .for("update");
    const card: Card = existing ? TypeConvert.card(existing.card as Card) : createEmptyCard(now);
    const next = scheduler.next(card, now, args.rating).card;
    await tx
      .insert(schema.reviewStates)
      .values({ userId: args.userId, problemId: args.problemId, card: next, due: next.due, updatedAt: now })
      .onConflictDoUpdate({
        target: [schema.reviewStates.userId, schema.reviewStates.problemId],
        set: { card: next, due: next.due, updatedAt: now },
      });
    return true;
  });
}

export type PickReason = "due" | "new" | "ahead";

export interface Pick {
  problem: Problem;
  reason: PickReason;
  stats: { due: number; new: number; total: number };
}

/**
 * Due reviews first (most overdue first), then problems the user hasn't seen,
 * then whatever is due soonest so there is always something to practice.
 */
export async function pickNext(userId: string, category?: string, excludeId?: string): Promise<Pick | null> {
  const all = [...loadCatalog().problems.values()].filter((p) => !category || p.category === category);
  if (all.length === 0) return null;
  const ids = new Set(all.map((p) => p.id));
  const now = new Date();

  const states = await db()
    .select({ problemId: schema.reviewStates.problemId, due: schema.reviewStates.due })
    .from(schema.reviewStates)
    .where(eq(schema.reviewStates.userId, userId))
    .orderBy(asc(schema.reviewStates.due));
  const mine = states.filter((s) => ids.has(s.problemId));
  const seen = new Set(mine.map((s) => s.problemId));
  const due = mine.filter((s) => s.due <= now);
  const unseen = all.filter((p) => !seen.has(p.id));
  const stats = { due: due.length, new: unseen.length, total: all.length };
  const byId = loadCatalog().problems;

  const dueChoice = due.find((s) => s.problemId !== excludeId);
  if (dueChoice) return { problem: byId.get(dueChoice.problemId)!, reason: "due", stats };

  const fresh = unseen.filter((p) => p.id !== excludeId);
  if (fresh.length) return { problem: fresh[Math.floor(Math.random() * fresh.length)], reason: "new", stats };

  const ahead = mine.find((s) => s.problemId !== excludeId) ?? mine[0];
  if (ahead) return { problem: byId.get(ahead.problemId)!, reason: "ahead", stats };
  return { problem: all[0], reason: "new", stats };
}

