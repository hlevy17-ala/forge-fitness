import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, bodyMetricsTable } from "@workspace/db";
import {
  GetBodyMetricsResponse,
  CreateBodyMetricBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function normalizeBodyMetric(row: {
  id: number;
  date: string;
  weightLbs: string | null;
  waistInches: string | null;
}) {
  return {
    id: row.id,
    date: row.date,
    weightLbs: row.weightLbs != null ? parseFloat(row.weightLbs) : null,
    waistInches: row.waistInches != null ? parseFloat(row.waistInches) : null,
  };
}

router.get("/body-metrics", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(bodyMetricsTable)
    .where(eq(bodyMetricsTable.userId, req.userId!))
    .orderBy(bodyMetricsTable.date);

  res.json(GetBodyMetricsResponse.parse(rows.map(normalizeBodyMetric)));
});

router.post("/body-metrics", async (req, res): Promise<void> => {
  const parsed = CreateBodyMetricBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, weightLbs, waistInches } = parsed.data;
  const userId = req.userId!;

  const [metric] = await db
    .insert(bodyMetricsTable)
    .values({
      date,
      weightLbs: weightLbs != null ? String(weightLbs) : null,
      waistInches: waistInches != null ? String(waistInches) : null,
      userId,
    })
    .onConflictDoUpdate({
      target: [bodyMetricsTable.userId, bodyMetricsTable.date],
      set: {
        weightLbs: weightLbs != null ? String(weightLbs) : null,
        waistInches: waistInches != null ? String(waistInches) : null,
      },
    })
    .returning();

  res.status(201).json(normalizeBodyMetric(metric));
});

export default router;
