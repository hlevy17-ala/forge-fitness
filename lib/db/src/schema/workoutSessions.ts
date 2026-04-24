import { pgTable, serial, integer, text, numeric, timestamp, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const workoutSessionsTable = pgTable("workout_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(), // YYYY-MM-DD
  durationMinutes: integer("duration_minutes"),
  caloriesBurned: numeric("calories_burned", { precision: 8, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.date)]);

export type WorkoutSessionMeta = typeof workoutSessionsTable.$inferSelect;
