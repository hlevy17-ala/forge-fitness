import { pgTable, serial, date, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const calorieLogsTable = pgTable("calorie_logs", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  caloriesConsumed: integer("calories_consumed"),
  caloriesBurned: integer("calories_burned"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [unique().on(t.userId, t.date)]);

export const insertCalorieLogSchema = createInsertSchema(calorieLogsTable).omit({ id: true });
export type InsertCalorieLog = z.infer<typeof insertCalorieLogSchema>;
export type CalorieLog = typeof calorieLogsTable.$inferSelect;
