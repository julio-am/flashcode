import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "./db";

export type Provider = "github" | "google";

const PROVIDER_ENV: Record<Provider, [id: string, secret: string]> = {
  github: ["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET"],
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
};

/** Sign-in providers whose OAuth app is configured in the environment. */
export function enabledProviders(): Provider[] {
  return (Object.keys(PROVIDER_ENV) as Provider[]).filter((p) =>
    PROVIDER_ENV[p].every((name) => process.env[name]),
  );
}

function socialProviders() {
  const out: Partial<Record<Provider, { clientId: string; clientSecret: string }>> = {};
  for (const p of enabledProviders()) {
    const [id, secret] = PROVIDER_ENV[p];
    out[p] = { clientId: process.env[id]!, clientSecret: process.env[secret]! };
  }
  return out;
}

function create() {
  return betterAuth({
    appName: "FlashCode",
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user: schema.users, session: schema.sessions, account: schema.accounts, verification: schema.verifications },
    }),
    advanced: { database: { generateId: "uuid" }, cookiePrefix: "fc" },
    socialProviders: socialProviders(),
    // The same email from GitHub and Google is one person.
    account: { accountLinking: { enabled: true, trustedProviders: ["github", "google"] } },
    plugins: [nextCookies()],
  });
}

// Built on first use so `next build` doesn't need DATABASE_URL.
const g = globalThis as unknown as { flashAuth?: ReturnType<typeof create> };

export function auth() {
  g.flashAuth ??= create();
  return g.flashAuth;
}
