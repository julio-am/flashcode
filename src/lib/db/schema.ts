import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { GradeResult } from "../grader/types";

// Everyone who practises. A guest is a row with no email, identified by a
// signed cookie (src/lib/session.ts). Signed-in users are created by Better
// Auth (src/lib/auth.ts), which owns name, email, emailVerified and image.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Better Auth tables. Column names follow its core schema.
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

// One row per linked OAuth identity (GitHub, Google).
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

// Short-lived values such as OAuth state.
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export type AttemptStatus = "queued" | "running" | GradeResult["status"];

export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    problemId: text("problem_id").notNull(),
    // One "presentation" is one time a problem was put in front of the user.
    // Only its first graded result moves the review schedule.
    presentationId: uuid("presentation_id").notNull(),
    code: text("code").notNull(),
    status: text("status").$type<AttemptStatus>().notNull().default("queued"),
    result: jsonb("result").$type<GradeResult>(),
    elapsedMs: integer("elapsed_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("attempts_user_created_idx").on(t.userId, t.createdAt)],
);

// FSRS card per user and problem.
export const reviewStates = pgTable(
  "review_states",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    problemId: text("problem_id").notNull(),
    card: jsonb("card").notNull(),
    due: timestamp("due", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.problemId] }), index("review_states_user_due_idx").on(t.userId, t.due)],
);

// One row per presentation that has been rated; the primary key makes rating idempotent.
export const reviewLogs = pgTable("review_logs", {
  presentationId: uuid("presentation_id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  problemId: text("problem_id").notNull(),
  rating: integer("rating").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
