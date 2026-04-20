import { pgTable, serial, date, numeric, integer, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bodyMetricsTable = pgTable("body_metrics", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  weightLbs: numeric("weight_lbs", { precision: 8, scale: 2 }),
  waistInches: numeric("waist_inches", { precision: 8, scale: 2 }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [unique().on(t.userId, t.date)]);

export const insertBodyMetricSchema = createInsertSchema(bodyMetricsTable).omit({ id: true });
export type InsertBodyMetric = z.infer<typeof insertBodyMetricSchema>;
export type BodyMetric = typeof bodyMetricsTable.$inferSelect;
