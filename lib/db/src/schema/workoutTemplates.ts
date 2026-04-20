import { pgTable, serial, text, numeric, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const workoutTemplatesTable = pgTable("workout_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
});

export const templateExercisesTable = pgTable("template_exercises", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => workoutTemplatesTable.id, { onDelete: "cascade" }),
  exercise: text("exercise").notNull(),
  weightKg: numeric("weight_kg", { precision: 12, scale: 6 }).notNull(),
  reps: integer("reps").notNull(),
  sets: integer("sets").notNull(),
  order: integer("order").notNull().default(0),
});

export type WorkoutTemplate = typeof workoutTemplatesTable.$inferSelect;
export type TemplateExercise = typeof templateExercisesTable.$inferSelect;
