import { pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const userSettingsTable = pgTable(
  "user_settings",
  {
    userId: text("user_id").notNull().default("default"),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.key] })],
);

export type UserSetting = typeof userSettingsTable.$inferSelect;
