import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, bodyMetricsTable, bodyMeasurementsTable } from "@workspace/db";
import {
  GetBodyMetricsResponse,
  CreateBodyMetricBody,
  GetBodyMeasurementsResponse,
  CreateBodyMeasurementBody,
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

// ── Custom body measurements ─────────────────────────────────────────────────

function normalizeBodyMeasurement(row: {
  id: number;
  date: string;
  part: string;
  inches: string;
}) {
  return {
    id: row.id,
    date: row.date,
    part: row.part,
    inches: parseFloat(row.inches),
  };
}

router.get("/body-measurements", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(bodyMeasurementsTable)
    .where(eq(bodyMeasurementsTable.userId, req.userId!))
    .orderBy(bodyMeasurementsTable.date);

  res.json(GetBodyMeasurementsResponse.parse(rows.map(normalizeBodyMeasurement)));
});

router.post("/body-measurements", async (req, res): Promise<void> => {
  const parsed = CreateBodyMeasurementBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, part, inches } = parsed.data;
  const userId = req.userId!;

  const [measurement] = await db
    .insert(bodyMeasurementsTable)
    .values({
      date,
      part,
      inches: String(inches),
      userId,
    })
    .onConflictDoUpdate({
      target: [bodyMeasurementsTable.userId, bodyMeasurementsTable.date, bodyMeasurementsTable.part],
      set: {
        inches: String(inches),
      },
    })
    .returning();

  res.status(201).json(normalizeBodyMeasurement(measurement));
});

router.delete("/body-measurements/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const deleted = await db
    .delete(bodyMeasurementsTable)
    .where(and(
      eq(bodyMeasurementsTable.id, id),
      eq(bodyMeasurementsTable.userId, req.userId!),
    ))
    .returning();

  if (deleted.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json({ deleted: deleted.length });
});

export default router;
