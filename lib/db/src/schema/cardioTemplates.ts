import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const cardioTemplatesTable = pgTable("cardio_templates", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  exerciseType: text("exercise_type").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  distanceMiles: numeric("distance_miles", { precision: 6, scale: 2 }),
  inclinePercent: numeric("incline_percent", { precision: 5, scale: 1 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CardioTemplate = typeof cardioTemplatesTable.$inferSelect;
