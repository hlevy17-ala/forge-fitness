import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const cardioSessionsTable = pgTable("cardio_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  date: text("date").notNull(),
  exerciseType: text("exercise_type").notNull(), // treadmill | outdoor_run | bike | elliptical
  durationMinutes: integer("duration_minutes").notNull(),
  distanceMiles: numeric("distance_miles", { precision: 6, scale: 2 }),
  inclinePercent: numeric("incline_percent", { precision: 5, scale: 1 }),
  caloriesBurned: numeric("calories_burned", { precision: 8, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CardioSession = typeof cardioSessionsTable.$inferSelect;
