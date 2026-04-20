import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { db, userSettingsTable } from "@workspace/db";
import {
  GetCalorieDailyGoalResponse,
  SetCalorieDailyGoalBody,
  SetCalorieDailyGoalResponse,
  GetCalorieBurnGoalResponse,
  SetCalorieBurnGoalBody,
  SetCalorieBurnGoalResponse,
  SetWidgetVisibilityBody,
  SetInsightsDateRangeBody,
  SetWeeklySessionsGoalBody,
  SetWeeklySessionsGoalResponse,
  GetWeeklySessionsGoalResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const CALORIE_GOAL_KEY = "calorie_daily_goal";
const CALORIE_BURN_GOAL_KEY = "calorie_burn_goal";
const WIDGET_VISIBILITY_KEY = "insights_widget_visibility";
const INSIGHTS_DATE_RANGE_KEY = "insights_date_range";
const WEEKLY_SESSIONS_GOAL_KEY = "weekly_sessions_goal";

function userKeyFilter(userId: string, key: string) {
  return and(
    eq(userSettingsTable.userId, userId),
    eq(userSettingsTable.key, key),
  );
}

router.get("/settings/calorie-daily-goal", async (req, res): Promise<void> => {
  const userId = String(req.userId!);
  const [row] = await db.select().from(userSettingsTable).where(userKeyFilter(userId, CALORIE_GOAL_KEY));
  res.json(GetCalorieDailyGoalResponse.parse({ value: row ? parseInt(row.value, 10) : null }));
});

router.post("/settings/calorie-daily-goal", async (req, res): Promise<void> => {
  const parsed = SetCalorieDailyGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = String(req.userId!);
  const [row] = await db
    .insert(userSettingsTable)
    .values({ userId, key: CALORIE_GOAL_KEY, value: String(parsed.data.value) })
    .onConflictDoUpdate({ target: [userSettingsTable.userId, userSettingsTable.key], set: { value: String(parsed.data.value) } })
    .returning();

  res.json(SetCalorieDailyGoalResponse.parse({ value: parseInt(row.value, 10) }));
});

router.get("/settings/calorie-burn-goal", async (req, res): Promise<void> => {
  const userId = String(req.userId!);
  const [row] = await db.select().from(userSettingsTable).where(userKeyFilter(userId, CALORIE_BURN_GOAL_KEY));
  res.json(GetCalorieBurnGoalResponse.parse({ value: row ? parseInt(row.value, 10) : null }));
});

router.post("/settings/calorie-burn-goal", async (req, res): Promise<void> => {
  const parsed = SetCalorieBurnGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = String(req.userId!);
  const [row] = await db
    .insert(userSettingsTable)
    .values({ userId, key: CALORIE_BURN_GOAL_KEY, value: String(parsed.data.value) })
    .onConflictDoUpdate({ target: [userSettingsTable.userId, userSettingsTable.key], set: { value: String(parsed.data.value) } })
    .returning();

  res.json(SetCalorieBurnGoalResponse.parse({ value: parseInt(row.value, 10) }));
});

router.get("/settings/widget-visibility", async (req, res): Promise<void> => {
  const userId = String(req.userId!);
  const [row] = await db.select().from(userSettingsTable).where(userKeyFilter(userId, WIDGET_VISIBILITY_KEY));

  if (!row) { res.json(null); return; }
  try { res.json(JSON.parse(row.value)); } catch { res.json(null); }
});

router.put("/settings/widget-visibility", async (req, res): Promise<void> => {
  const parsed = SetWidgetVisibilityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = String(req.userId!);
  const [row] = await db
    .insert(userSettingsTable)
    .values({ userId, key: WIDGET_VISIBILITY_KEY, value: JSON.stringify(parsed.data) })
    .onConflictDoUpdate({ target: [userSettingsTable.userId, userSettingsTable.key], set: { value: JSON.stringify(parsed.data) } })
    .returning();

  res.json(JSON.parse(row.value));
});

router.get("/settings/insights-date-range", async (req, res): Promise<void> => {
  const userId = String(req.userId!);
  const [row] = await db.select().from(userSettingsTable).where(userKeyFilter(userId, INSIGHTS_DATE_RANGE_KEY));

  if (!row) { res.json(null); return; }
  try { res.json(JSON.parse(row.value)); } catch { res.json(null); }
});

router.put("/settings/insights-date-range", async (req, res): Promise<void> => {
  const parsed = SetInsightsDateRangeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = String(req.userId!);
  const [row] = await db
    .insert(userSettingsTable)
    .values({ userId, key: INSIGHTS_DATE_RANGE_KEY, value: JSON.stringify(parsed.data) })
    .onConflictDoUpdate({ target: [userSettingsTable.userId, userSettingsTable.key], set: { value: JSON.stringify(parsed.data) } })
    .returning();

  res.json(JSON.parse(row.value));
});

router.get("/settings/weekly-sessions-goal", async (req, res): Promise<void> => {
  const userId = String(req.userId!);
  const [row] = await db.select().from(userSettingsTable).where(userKeyFilter(userId, WEEKLY_SESSIONS_GOAL_KEY));
  res.json(GetWeeklySessionsGoalResponse.parse({ value: row ? parseInt(row.value, 10) : null }));
});

router.post("/settings/weekly-sessions-goal", async (req, res): Promise<void> => {
  const parsed = SetWeeklySessionsGoalBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const userId = String(req.userId!);
  const [row] = await db
    .insert(userSettingsTable)
    .values({ userId, key: WEEKLY_SESSIONS_GOAL_KEY, value: String(parsed.data.value) })
    .onConflictDoUpdate({ target: [userSettingsTable.userId, userSettingsTable.key], set: { value: String(parsed.data.value) } })
    .returning();

  res.json(SetWeeklySessionsGoalResponse.parse({ value: parseInt(row.value, 10) }));
});

export default router;
