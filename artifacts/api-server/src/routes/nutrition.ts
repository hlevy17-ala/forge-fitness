import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, calorieLogsTable } from "@workspace/db";
import {
  GetCalorieLogsResponse,
  CreateCalorieLogBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/calorie-logs", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(calorieLogsTable)
    .where(eq(calorieLogsTable.userId, req.userId!))
    .orderBy(calorieLogsTable.date);

  const normalized = rows.map((r) => ({
    id: r.id,
    date: r.date,
    caloriesConsumed: r.caloriesConsumed ?? null,
    caloriesBurned: r.caloriesBurned ?? null,
  }));

  res.json(GetCalorieLogsResponse.parse(normalized));
});

router.post("/calorie-logs", async (req, res): Promise<void> => {
  const parsed = CreateCalorieLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, caloriesConsumed, caloriesBurned } = parsed.data;
  const userId = req.userId!;

  const [log] = await db
    .insert(calorieLogsTable)
    .values({
      date,
      caloriesConsumed: caloriesConsumed ?? null,
      caloriesBurned: caloriesBurned ?? null,
      userId,
    })
    .onConflictDoUpdate({
      target: [calorieLogsTable.userId, calorieLogsTable.date],
      set: {
        caloriesConsumed: caloriesConsumed ?? null,
        caloriesBurned: caloriesBurned ?? null,
      },
    })
    .returning();

  res.status(201).json({
    id: log.id,
    date: log.date,
    caloriesConsumed: log.caloriesConsumed ?? null,
    caloriesBurned: log.caloriesBurned ?? null,
  });
});

export default router;
