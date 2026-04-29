import { pgTable, serial, date, numeric, integer, text, unique } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bodyMeasurementsTable = pgTable("body_measurements", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  part: text("part").notNull(),
  inches: numeric("inches", { precision: 8, scale: 2 }).notNull(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
}, (t) => [unique().on(t.userId, t.date, t.part)]);

export const insertBodyMeasurementSchema = createInsertSchema(bodyMeasurementsTable).omit({ id: true });
export type InsertBodyMeasurement = z.infer<typeof insertBodyMeasurementSchema>;
export type BodyMeasurement = typeof bodyMeasurementsTable.$inferSelect;
