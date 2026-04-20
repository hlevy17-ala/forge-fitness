import { pgTable, serial, text, numeric, integer, date } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutSetsTable = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  exercise: text("exercise").notNull(),
  reps: integer("reps").notNull(),
  weightKg: numeric("weight_kg", { precision: 12, scale: 6 }).notNull(),
  source: text("source").notNull().default("csv"),
  notes: text("notes"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
});

export const insertWorkoutSetSchema = createInsertSchema(workoutSetsTable).omit({ id: true });
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type WorkoutSet = typeof workoutSetsTable.$inferSelect;
