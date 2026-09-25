import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db, schema } from "./db";

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

/**
 * The current guest user, created on first visit. Call only from Route
 * Handlers or Server Functions, since it may set a cookie.
 */
export async function currentUser(): Promise<{ id: string }> {
  const jar = await cookies();
  const id = verify(jar.get(COOKIE)?.value);
  if (id) {
    const [row] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, id));
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
