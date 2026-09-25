import { randomUUID } from "node:crypto";
import { serializeSignedCookie } from "better-call";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { mergeGuest } from "@/lib/merge-guest";

// Needs a migrated Postgres (`npm run db:migrate`); CI provides one.
describe.skipIf(!process.env.DATABASE_URL)("accounts", () => {
  afterAll(async () => {
    await (db().$client as unknown as { end(): Promise<void> }).end();
  });

  async function guest() {
    const [u] = await db().insert(schema.users).values({}).returning();
    return u.id;
  }

  async function member() {
    const [u] = await db()
      .insert(schema.users)
      .values({ name: "Ada", email: `ada-${randomUUID()}@example.com` })
      .returning();
    return u.id;
  }

  async function review(userId: string, problemId: string, updatedAt: Date, due: Date) {
    await db().insert(schema.reviewStates).values({ userId, problemId, card: { from: userId }, due, updatedAt });
  }

  it("moves a guest's attempts, logs and schedule onto the account and deletes the guest", async () => {
    const g = await guest();
    const m = await member();
    const presentationId = randomUUID();
    await db().insert(schema.attempts).values({ userId: g, problemId: "vectors/a", presentationId, code: "x" });
    await db().insert(schema.reviewLogs).values({ presentationId, userId: g, problemId: "vectors/a", rating: 3, reason: "passed" });
    // Guest-only problem, a problem the guest reviewed more recently, and one the account reviewed more recently.
    await review(g, "vectors/a", new Date("2026-09-02"), new Date("2026-09-10"));
    await review(g, "vectors/b", new Date("2026-09-03"), new Date("2026-09-11"));
    await review(m, "vectors/b", new Date("2026-09-01"), new Date("2026-09-12"));
    await review(g, "vectors/c", new Date("2026-09-01"), new Date("2026-09-13"));
    await review(m, "vectors/c", new Date("2026-09-04"), new Date("2026-09-14"));

    expect(await mergeGuest(db(), g, m)).toBe(true);

    const attempts = await db().select().from(schema.attempts).where(eq(schema.attempts.presentationId, presentationId));
    expect(attempts.map((a) => a.userId)).toEqual([m]);
    const [log] = await db().select().from(schema.reviewLogs).where(eq(schema.reviewLogs.presentationId, presentationId));
    expect(log.userId).toBe(m);
    const states = await db().select().from(schema.reviewStates).where(eq(schema.reviewStates.userId, m));
    const byProblem = Object.fromEntries(states.map((s) => [s.problemId, (s.card as { from: string }).from]));
    expect(byProblem).toEqual({ "vectors/a": g, "vectors/b": g, "vectors/c": m });
    expect(await db().select().from(schema.users).where(eq(schema.users.id, g))).toEqual([]);

    // A second request with the same stale cookie is a no-op.
    expect(await mergeGuest(db(), g, m)).toBe(false);
  });

  it("never merges a real account, even with its id", async () => {
    const a = await member();
    const b = await member();
    await review(a, "vectors/a", new Date(), new Date());
    expect(await mergeGuest(db(), a, b)).toBe(false);
    expect(await db().select().from(schema.users).where(eq(schema.users.id, a))).toHaveLength(1);
  });

  it("stores Better Auth users and sessions in our tables", async () => {
    const ctx = await auth().$context;
    const user = await ctx.internalAdapter.createUser(
      { name: "Grace", email: `grace-${randomUUID()}@example.com`, emailVerified: true },
      { method: "admin" },
    );
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "github", accountId: "12345" });
    const session = await ctx.internalAdapter.createSession(user.id);

    const [row] = await db().select().from(schema.sessions).where(eq(schema.sessions.token, session.token));
    expect(row.userId).toBe(user.id);
    const accounts = await db().select().from(schema.accounts).where(eq(schema.accounts.userId, user.id));
    expect(accounts.map((a) => a.providerId)).toEqual(["github"]);

    // The browser's session cookie resolves back to the user.
    const cookie = (await serializeSignedCookie(ctx.authCookies.sessionToken.name, session.token, ctx.secret)).split(";")[0];
    const found = await auth().api.getSession({ headers: new Headers({ cookie }) });
    expect(found?.user.id).toBe(user.id);
  });
});
