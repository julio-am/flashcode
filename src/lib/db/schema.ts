import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { GradeResult } from "../grader/types";

// Guest users for now: one row per browser, identified by a signed cookie.
// Real sign-in (Auth.js) attaches to this table later.
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

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
