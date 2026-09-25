import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { auth } from "./auth";
import { db, schema } from "./db";
import { mergeGuest } from "./merge-guest";

const COOKIE = "fc_uid";
const DEV_SECRET = "flashcode-dev-secret-change-me";

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set in production");
  return DEV_SECRET;
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

function verify(value: string | undefined): string | null {
  if (!value) return null;
  const [id, mac] = value.split(".");
  if (!id || !mac) return null;
  const want = Buffer.from(sign(id));
  const got = Buffer.from(mac);
  return want.length === got.length && timingSafeEqual(want, got) ? id : null;
}

/** The signed-in user, if any. Safe to call from Server Components. */
export async function signedInUser() {
  // Read headers first: it marks the page dynamic before anything touches the database.
  const h = await headers();
  const session = await auth().api.getSession({ headers: h });
  return session?.user ?? null;
}

/**
 * The signed-in user, or else a guest created on first visit. The first
 * request after signing in moves the guest's progress onto the account.
 * Call only from Route Handlers or Server Functions, since it may set a cookie.
 */
export async function currentUser(): Promise<{ id: string }> {
  const jar = await cookies();
  const id = verify(jar.get(COOKIE)?.value);
  const member = await signedInUser();
  if (member) {
    if (id) await mergeGuest(db(), id, member.id);
    if (jar.has(COOKIE)) jar.delete(COOKIE);
    return { id: member.id };
  }
  if (id) {
    const [row] = await db()
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.id, id), isNull(schema.users.email)));
    if (row) return row;
  }
  const [user] = await db().insert(schema.users).values({}).returning({ id: schema.users.id });
  jar.set(COOKIE, `${user.id}.${sign(user.id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return user;
}
