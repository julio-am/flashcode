import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  return url;
}

// Reuse one pool across Next.js hot reloads in development.
const g = globalThis as unknown as { flashDb?: ReturnType<typeof create> };

function create() {
  const client = postgres(databaseUrl(), { max: 10 });
  return drizzle(client, { schema });
}

export function db() {
  g.flashDb ??= create();
  return g.flashDb;
}

export { schema };
