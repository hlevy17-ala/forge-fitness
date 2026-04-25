import { Router, type IRouter } from "express";
import multer from "multer";
import { sql, eq, asc, and, desc } from "drizzle-orm";
import { db, workoutSetsTable, workoutTemplatesTable, templateExercisesTable, bodyMetricsTable, workoutSessionsTable, cardioSessionsTable, cardioTemplatesTable } from "@workspace/db";
import {
  UploadWorkoutCsvResponse,
  GetWorkoutsByExerciseResponse,
  GetWorkoutsByMuscleGroupResponse,
  GetAvgWeightByExerciseResponse,
  GetAvgWeightByMuscleGroupResponse,
  GetPersonalRecordsResponse,
  GetExerciseListResponse,
  GetWorkoutHeatmapResponse,
  GetMostImprovedResponse,
  GetPersonalRecordsTimelineResponse,
  LogWorkoutBody,
  LogWorkoutResponse,
  GetLastSessionResponse,
  GetWorkoutSessionsResponse,
  GetSessionSetsResponse,
  UpdateWorkoutSetBody,
  UpdateWorkoutSetResponse,
  DeleteWorkoutSetResponse,
  DeleteSessionResponse,
  UpdateSessionNotesBody,
  GetSessionComparisonResponse,
  GetEstimatedOneRmResponse,
  GetWorkoutTemplatesResponse,
  CreateWorkoutTemplateBody,
  GetWorkoutTemplateResponse,
  DeleteWorkoutTemplateResponse,
  GetWorkoutSuggestionsResponse,
  GetWorkoutSessionsCaloriesResponse,
  LogCardioBody,
  LogCardioResponse,
  CreateCardioTemplateBody,
  GetCardioTemplatesResponse,
  CardioTemplateItem,
  DeleteCardioTemplateResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const KG_TO_LBS = 2.20462;

const CARDIO_EXERCISES = new Set(["Walking - Treadmill", "Running - Treadmill"]);

const MUSCLE_GROUP_MAP: Record<string, string> = {
  "Bench Press": "Chest",
  "Machine Bench Press": "Chest",
  "Fly": "Chest",
  "Machine Fly": "Chest",
  "Chest Fly": "Chest",
  "Lat Pulldown": "Back",
  "Row": "Back",
  "Machine Row": "Back",
  "Seated Row": "Back",
  "Cable Row": "Back",
  "Seated Back Extension": "Back",
  "Back Extension": "Back",
  "Shoulder Press": "Shoulders",
  "Machine Shoulder Press": "Shoulders",
  "Overhead Press": "Shoulders",
  "Rear Delt Fly": "Shoulders",
  "Machine Rear Delt Fly": "Shoulders",
  "Tricep Dip": "Triceps",
  "Machine Tricep Dip": "Triceps",
  "Tricep Extension": "Triceps",
  "Tricep Pushdown": "Triceps",
  "Bicep Curl": "Biceps",
  "Machine Bicep Curl": "Biceps",
  "Dumbbell Bicep Curl": "Biceps",
  "Leg Press": "Legs",
  "Machine Leg Press": "Legs",
  "Calf Raise": "Legs",
  "Machine Calf Raise": "Legs",
  "Hip Adductor": "Legs",
  "Machine Hip Adductor": "Legs",
  "Hip Abductor": "Legs",
  "Machine Hip Abductor": "Legs",
  "Air Squats": "Legs",
  "Squat": "Legs",
  "Leg Extension": "Legs",
  "Leg Curl": "Legs",
  "Crunches": "Core",
  "Dead Bug": "Core",
  "Plank": "Core",
  "Ab Crunch": "Core",
};

function parseDate(raw: string): string {
  const d = new Date(raw);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

router.post("/workouts/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const text = req.file.buffer.toString("utf-8");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  if (lines.length < 2) {
    res.status(400).json({ error: "CSV file appears empty" });
    return;
  }

  let mapping: {
    date: string;
    exercise: string;
    reps: string;
    weight: string;
    weightUnit: "kg" | "lbs";
    isWarmup?: string;
    multiplier?: string;
  };
  try {
    mapping = JSON.parse(req.body?.mapping ?? "{}");
  } catch {
    res.status(400).json({ error: "Invalid column mapping — could not parse JSON" });
    return;
  }

  if (!mapping.date || !mapping.exercise || !mapping.reps || !mapping.weight) {
    res.status(400).json({ error: "Column mapping is incomplete — date, exercise, reps, and weight are required" });
    return;
  }

  const header = lines[0].split(",").map((h) => h.trim());
  const dateIdx = header.indexOf(mapping.date);
  const exerciseIdx = header.indexOf(mapping.exercise);
  const repsIdx = header.indexOf(mapping.reps);
  const weightIdx = header.indexOf(mapping.weight);
  const warmupIdx = mapping.isWarmup ? header.indexOf(mapping.isWarmup) : -1;
  const multiplierIdx = mapping.multiplier ? header.indexOf(mapping.multiplier) : -1;
  const weightUnit = mapping.weightUnit ?? "kg";

  if (dateIdx < 0 || exerciseIdx < 0 || repsIdx < 0 || weightIdx < 0) {
    res.status(400).json({ error: "One or more mapped columns were not found in the CSV header row" });
    return;
  }

  const userId = req.userId!;
  const toInsert: { date: string; exercise: string; reps: number; weightKg: string; source: string; userId: number }[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const rawDate = cols[dateIdx]?.trim() ?? "";
    const exercise = cols[exerciseIdx]?.trim() ?? "";
    const reps = parseInt(cols[repsIdx]?.trim() ?? "0", 10);
    const weightRaw = parseFloat(cols[weightIdx]?.trim() ?? "0");
    const weightKg = weightUnit === "lbs" ? weightRaw / KG_TO_LBS : weightRaw;
    const isWarmup = warmupIdx >= 0 ? cols[warmupIdx]?.trim().toLowerCase() === "true" : false;
    const multiplier = multiplierIdx >= 0 ? parseFloat(cols[multiplierIdx]?.trim() ?? "1") : 1;

    if (CARDIO_EXERCISES.has(exercise)) { skipped++; continue; }
    if (isWarmup) { skipped++; continue; }
    if (multiplier === 0) { skipped++; continue; }
    if (weightKg <= 0) { skipped++; continue; }
    if (!rawDate || !exercise) { skipped++; continue; }

    const date = parseDate(rawDate);

    toInsert.push({ date, exercise, reps, weightKg: weightKg.toFixed(6), source: "csv", userId });
  }

  if (toInsert.length === 0) {
    res.status(400).json({ error: "No valid rows found after applying your column mapping. Your existing data was not changed." });
    return;
  }

  const uniqueSessions = new Set(toInsert.map((r) => r.date)).size;
  const uniqueExercises = new Set(toInsert.map((r) => r.exercise)).size;

  const CHUNK_SIZE = 1000;

  await db.transaction(async (tx) => {
    await tx.delete(workoutSetsTable).where(
      and(eq(workoutSetsTable.source, "csv"), eq(workoutSetsTable.userId, userId))
    );
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      await tx.insert(workoutSetsTable).values(toInsert.slice(i, i + CHUNK_SIZE));
    }
  });

  const inserted = toInsert.length;
  req.log.info({ inserted, skipped, sessions: uniqueSessions, exercises: uniqueExercises }, "Workout CSV upload complete");

  res.json(UploadWorkoutCsvResponse.parse({ inserted, skipped, total: inserted + skipped, sessions: uniqueSessions, exercises: uniqueExercises }));
});

router.post("/workouts/log", async (req, res): Promise<void> => {
  const parsed = LogWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { date, exercises, notes, bodyWeightLbs, durationMinutes } = parsed.data;
  const userId = req.userId!;

  const toInsert = exercises.flatMap((ex) =>
    Array.from({ length: ex.sets }, () => ({
      date,
      exercise: ex.exercise.trim(),
      reps: ex.reps,
      weightKg: (ex.weightLbs / KG_TO_LBS).toFixed(6),
      source: "manual",
      notes: notes ?? null,
      userId,
    }))
  );

  if (toInsert.length === 0) {
    res.status(400).json({ error: "No valid sets to insert" });
    return;
  }

  let bodyWeightLogged = false;
  let caloriesBurned: number | null = null;

  await db.transaction(async (tx) => {
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      await tx.insert(workoutSetsTable).values(toInsert.slice(i, i + CHUNK_SIZE));
    }
    if (bodyWeightLbs != null) {
      await tx
        .insert(bodyMetricsTable)
        .values({ date, weightLbs: bodyWeightLbs.toFixed(2), userId })
        .onConflictDoUpdate({
          target: [bodyMetricsTable.userId, bodyMetricsTable.date],
          set: { weightLbs: bodyWeightLbs.toFixed(2) },
        });
      bodyWeightLogged = true;
    }

    if (durationMinutes != null && durationMinutes > 0) {
      // Get latest bodyweight for calorie calculation
      const latestMetric = await tx
        .select({ weightLbs: bodyMetricsTable.weightLbs })
        .from(bodyMetricsTable)
        .where(eq(bodyMetricsTable.userId, userId))
        .orderBy(desc(bodyMetricsTable.date))
        .limit(1);

      // Use provided bodyweight if available, fallback to stored
      const weightForCalc = bodyWeightLbs != null
        ? bodyWeightLbs / KG_TO_LBS
        : latestMetric.length > 0 && latestMetric[0].weightLbs != null
          ? Number(latestMetric[0].weightLbs) / KG_TO_LBS
          : null;

      if (weightForCalc != null) {
        const MET = 5.0;
        caloriesBurned = Math.round(MET * weightForCalc * (durationMinutes / 60) * 10) / 10;
      }

      await tx
        .insert(workoutSessionsTable)
        .values({
          userId,
          date,
          durationMinutes,
          caloriesBurned: caloriesBurned != null ? caloriesBurned.toFixed(2) : null,
        })
        .onConflictDoUpdate({
          target: [workoutSessionsTable.userId, workoutSessionsTable.date],
          set: {
            durationMinutes,
            caloriesBurned: caloriesBurned != null ? caloriesBurned.toFixed(2) : null,
          },
        });
    }
  });

  req.log.info({ inserted: toInsert.length, date, caloriesBurned }, "Manual workout log saved");
  res.json(LogWorkoutResponse.parse({ inserted: toInsert.length, bodyWeightLogged, caloriesBurned }));
});

router.get("/workouts/by-exercise", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select({
      date: workoutSetsTable.date,
      exercise: workoutSetsTable.exercise,
      totalKg: sql<number>`CAST(SUM(${workoutSetsTable.weightKg}::numeric * ${workoutSetsTable.reps}) AS float8)`,
    })
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.userId, userId))
    .groupBy(workoutSetsTable.date, workoutSetsTable.exercise)
    .orderBy(workoutSetsTable.date, workoutSetsTable.exercise);

  res.json(GetWorkoutsByExerciseResponse.parse(rows));
});

router.get("/workouts/avg-weight-by-exercise", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select({
      date: workoutSetsTable.date,
      exercise: workoutSetsTable.exercise,
      avgWeightKg: sql<number>`CAST(AVG(${workoutSetsTable.weightKg}::numeric) AS float8)`,
    })
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.userId, userId))
    .groupBy(workoutSetsTable.date, workoutSetsTable.exercise)
    .orderBy(workoutSetsTable.date, workoutSetsTable.exercise);

  res.json(GetAvgWeightByExerciseResponse.parse(rows));
});

router.get("/workouts/avg-weight-by-muscle-group", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select({
      date: workoutSetsTable.date,
      exercise: workoutSetsTable.exercise,
      avgWeightKg: sql<number>`CAST(AVG(${workoutSetsTable.weightKg}::numeric) AS float8)`,
    })
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.userId, userId))
    .groupBy(workoutSetsTable.date, workoutSetsTable.exercise)
    .orderBy(workoutSetsTable.date);

  const grouped: Map<string, Map<string, { sum: number; count: number }>> = new Map();

  for (const row of rows) {
    const muscleGroup = MUSCLE_GROUP_MAP[row.exercise] ?? "Other";
    if (!grouped.has(row.date)) grouped.set(row.date, new Map());
    const dateMap = grouped.get(row.date)!;
    if (!dateMap.has(muscleGroup)) dateMap.set(muscleGroup, { sum: 0, count: 0 });
    const entry = dateMap.get(muscleGroup)!;
    entry.sum += Number(row.avgWeightKg);
    entry.count += 1;
  }

  const result: { date: string; muscleGroup: string; avgWeightKg: number }[] = [];
  for (const [date, muscleGroups] of grouped) {
    for (const [muscleGroup, { sum, count }] of muscleGroups) {
      result.push({ date, muscleGroup, avgWeightKg: Math.round((sum / count) * 100) / 100 });
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date) || a.muscleGroup.localeCompare(b.muscleGroup));

  res.json(GetAvgWeightByMuscleGroupResponse.parse(result));
});

router.get("/workouts/by-muscle-group", async (req, res): Promise<void> => {
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : null;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : null;
  const userId = req.userId!;

  let query = db
    .select({
      date: workoutSetsTable.date,
      exercise: workoutSetsTable.exercise,
      totalKg: sql<number>`CAST(SUM(${workoutSetsTable.weightKg}::numeric * ${workoutSetsTable.reps}) AS float8)`,
    })
    .from(workoutSetsTable)
    .$dynamic();

  const userFilter = eq(workoutSetsTable.userId, userId);
  if (startDate && endDate) {
    query = query.where(and(userFilter, sql`${workoutSetsTable.date} >= ${startDate}::date AND ${workoutSetsTable.date} <= ${endDate}::date`));
  } else if (startDate) {
    query = query.where(and(userFilter, sql`${workoutSetsTable.date} >= ${startDate}::date`));
  } else if (endDate) {
    query = query.where(and(userFilter, sql`${workoutSetsTable.date} <= ${endDate}::date`));
  } else {
    query = query.where(userFilter);
  }

  const rows = await query
    .groupBy(workoutSetsTable.date, workoutSetsTable.exercise)
    .orderBy(workoutSetsTable.date);

  const grouped: Map<string, Map<string, number>> = new Map();

  for (const row of rows) {
    const muscleGroup = MUSCLE_GROUP_MAP[row.exercise] ?? "Other";
    if (!grouped.has(row.date)) {
      grouped.set(row.date, new Map());
    }
    const dateMap = grouped.get(row.date)!;
    dateMap.set(muscleGroup, (dateMap.get(muscleGroup) ?? 0) + Number(row.totalKg));
  }

  const result: { date: string; muscleGroup: string; totalKg: number }[] = [];
  for (const [date, muscleGroups] of grouped) {
    for (const [muscleGroup, totalKg] of muscleGroups) {
      result.push({ date, muscleGroup, totalKg: Math.round(totalKg * 100) / 100 });
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date) || a.muscleGroup.localeCompare(b.muscleGroup));

  res.json(GetWorkoutsByMuscleGroupResponse.parse(result));
});

router.get("/workouts/exercises", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .selectDistinct({ exercise: workoutSetsTable.exercise })
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.userId, userId))
    .orderBy(workoutSetsTable.exercise);

  res.json(GetExerciseListResponse.parse(rows.map((r) => r.exercise)));
});

router.get("/workouts/personal-records", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select({
      exercise: workoutSetsTable.exercise,
      maxWeightKg: sql<number>`CAST(MAX(${workoutSetsTable.weightKg}::numeric) AS float8)`,
    })
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.userId, userId))
    .groupBy(workoutSetsTable.exercise)
    .orderBy(workoutSetsTable.exercise);

  res.json(GetPersonalRecordsResponse.parse(rows.map((r) => ({ exercise: r.exercise, maxWeightKg: r.maxWeightKg }))));
});

router.get("/workouts/heatmap", async (req, res): Promise<void> => {
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : null;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : null;
  const userId = req.userId!;

  let whereClause: ReturnType<typeof sql>;
  if (startDate && endDate) {
    whereClause = sql`WHERE user_id = ${userId} AND "date" >= ${startDate}::date AND "date" <= ${endDate}::date`;
  } else if (startDate) {
    whereClause = sql`WHERE user_id = ${userId} AND "date" >= ${startDate}::date`;
  } else if (endDate) {
    whereClause = sql`WHERE user_id = ${userId} AND "date" <= ${endDate}::date`;
  } else {
    whereClause = sql`WHERE user_id = ${userId}`;
  }

  const { rows } = await db.execute<{ date: string; volume_kg: number }>(sql`
    SELECT
      date,
      CAST(SUM(weight_kg::numeric * reps) AS float8) AS volume_kg
    FROM workout_sets
    ${whereClause}
    GROUP BY date
    ORDER BY date
  `);

  res.json(GetWorkoutHeatmapResponse.parse(rows.map((r) => ({ date: r.date, volumeKg: r.volume_kg }))));
});

router.get("/workouts/most-improved", async (req, res): Promise<void> => {
  const startDate = typeof req.query.startDate === "string" ? req.query.startDate : null;
  const endDate = typeof req.query.endDate === "string" ? req.query.endDate : null;
  const userId = req.userId!;

  let query = db
    .select({
      date: workoutSetsTable.date,
      exercise: workoutSetsTable.exercise,
      avgWeightKg: sql<number>`CAST(AVG(${workoutSetsTable.weightKg}::numeric) AS float8)`,
    })
    .from(workoutSetsTable)
    .$dynamic();

  const userFilter = eq(workoutSetsTable.userId, userId);
  if (startDate && endDate) {
    query = query.where(and(userFilter, sql`${workoutSetsTable.date} >= ${startDate}::date AND ${workoutSetsTable.date} <= ${endDate}::date`));
  } else if (startDate) {
    query = query.where(and(userFilter, sql`${workoutSetsTable.date} >= ${startDate}::date`));
  } else if (endDate) {
    query = query.where(and(userFilter, sql`${workoutSetsTable.date} <= ${endDate}::date`));
  } else {
    query = query.where(userFilter);
  }

  const rows = await query
    .groupBy(workoutSetsTable.date, workoutSetsTable.exercise)
    .orderBy(workoutSetsTable.date);

  const byExercise = new Map<string, { date: string; avgWeightKg: number }[]>();
  for (const row of rows) {
    if (!byExercise.has(row.exercise)) byExercise.set(row.exercise, []);
    byExercise.get(row.exercise)!.push({ date: row.date, avgWeightKg: Number(row.avgWeightKg) });
  }

  const minSessions = Math.max(3, parseInt(String(req.query.minSessions ?? "3"), 10) || 3);

  const result: { exercise: string; firstDate: string; lastDate: string; firstAvgKg: number; lastAvgKg: number; absGainLbs: number; pctGain: number }[] = [];
  for (const [exercise, sessions] of byExercise) {
    if (sessions.length < minSessions) continue;
    const first = sessions[0];
    const last = sessions[sessions.length - 1];
    if (first.avgWeightKg <= 0) continue;
    const pctGain = ((last.avgWeightKg - first.avgWeightKg) / first.avgWeightKg) * 100;
    const absGainLbs = Math.round((last.avgWeightKg - first.avgWeightKg) * KG_TO_LBS * 10) / 10;
    result.push({
      exercise,
      firstDate: first.date,
      lastDate: last.date,
      firstAvgKg: Math.round(first.avgWeightKg * 100) / 100,
      lastAvgKg: Math.round(last.avgWeightKg * 100) / 100,
      absGainLbs,
      pctGain: Math.round(pctGain * 10) / 10,
    });
  }

  result.sort((a, b) => b.pctGain - a.pctGain);
  res.json(GetMostImprovedResponse.parse(result.slice(0, 10)));
});

router.get("/workouts/estimated-1rm", async (req, res): Promise<void> => {
  const userId = req.userId!;

  const { rows } = await db.execute<{ date: string; exercise: string; max_1rm_kg: number }>(sql`
    SELECT
      date,
      exercise,
      CAST(MAX(weight_kg::numeric * (1 + reps / 30.0)) AS float8) AS max_1rm_kg
    FROM workout_sets
    WHERE user_id = ${userId}
    GROUP BY date, exercise
    ORDER BY date, exercise
  `);

  const result = rows.map((r) => ({
    date: r.date,
    exercise: r.exercise,
    estimatedOneRmLbs: Math.round(r.max_1rm_kg * KG_TO_LBS * 10) / 10,
  }));

  res.json(GetEstimatedOneRmResponse.parse(result));
});

router.get("/workouts/last-session", async (req, res): Promise<void> => {
  const userId = req.userId!;

  const { rows: dateRows } = await db.execute<{ date: string }>(sql`
    SELECT date FROM workout_sets WHERE user_id = ${userId} ORDER BY date DESC LIMIT 1
  `);
  if (dateRows.length === 0) {
    res.json(null);
    return;
  }
  const lastDate = dateRows[0].date;

  const { rows } = await db.execute<{ exercise: string; avg_weight_kg: number; set_count: number; common_reps: number }>(sql`
    SELECT
      exercise,
      CAST(AVG(weight_kg::numeric) AS float8) AS avg_weight_kg,
      COUNT(*) AS set_count,
      (
        SELECT reps FROM workout_sets w2
        WHERE w2.exercise = workout_sets.exercise AND w2.date = ${lastDate} AND w2.user_id = ${userId}
        GROUP BY reps ORDER BY COUNT(*) DESC LIMIT 1
      ) AS common_reps
    FROM workout_sets
    WHERE date = ${lastDate} AND user_id = ${userId}
    GROUP BY exercise
    ORDER BY exercise
  `);

  const exercises = rows.map((r) => ({
    exercise: r.exercise,
    weightLbs: Math.round(r.avg_weight_kg * KG_TO_LBS * 10) / 10,
    reps: r.common_reps,
    sets: Number(r.set_count),
  }));

  res.json(GetLastSessionResponse.parse({ date: lastDate, exercises }));
});

router.get("/workouts/sessions", async (req, res): Promise<void> => {
  const userId = req.userId!;

  const { rows: strengthRows } = await db.execute<{ date: string; set_count: number }>(sql`
    SELECT date, COUNT(*) AS set_count
    FROM workout_sets
    WHERE user_id = ${userId}
    GROUP BY date
  `);

  const cardioRows = await db
    .select()
    .from(cardioSessionsTable)
    .where(eq(cardioSessionsTable.userId, userId));

  const strengthSessions = strengthRows.map((r) => ({
    date: r.date,
    setCount: Number(r.set_count),
    type: "strength" as const,
    cardioType: null,
    cardioDurationMinutes: null,
    cardioDistanceMiles: null,
    cardioInclinePercent: null,
    cardioCaloriesBurned: null,
  }));

  const cardioSessions = cardioRows.map((r) => ({
    date: r.date,
    setCount: 0,
    type: "cardio" as const,
    cardioType: r.exerciseType,
    cardioDurationMinutes: r.durationMinutes,
    cardioDistanceMiles: r.distanceMiles != null ? Number(r.distanceMiles) : null,
    cardioInclinePercent: r.inclinePercent != null ? Number(r.inclinePercent) : null,
    cardioCaloriesBurned: r.caloriesBurned != null ? Number(r.caloriesBurned) : null,
  }));

  const all = [...strengthSessions, ...cardioSessions].sort((a, b) => b.date.localeCompare(a.date));
  res.json(GetWorkoutSessionsResponse.parse(all));
});

router.get("/workouts/sessions/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const userId = req.userId!;

  const rows = await db
    .select({
      id: workoutSetsTable.id,
      date: workoutSetsTable.date,
      exercise: workoutSetsTable.exercise,
      weightKg: workoutSetsTable.weightKg,
      reps: workoutSetsTable.reps,
      notes: workoutSetsTable.notes,
    })
    .from(workoutSetsTable)
    .where(and(eq(workoutSetsTable.date, date), eq(workoutSetsTable.userId, userId)))
    .orderBy(workoutSetsTable.exercise, workoutSetsTable.id);

  const result = rows.map((r) => ({
    id: r.id,
    date: r.date,
    exercise: r.exercise,
    weightLbs: Math.round(Number(r.weightKg) * KG_TO_LBS * 10) / 10,
    reps: r.reps,
    notes: r.notes ?? null,
  }));

  res.json(GetSessionSetsResponse.parse(result));
});

router.delete("/workouts/sessions/:date", async (req, res): Promise<void> => {
  const { date } = req.params;
  const userId = req.userId!;
  const result = await db.delete(workoutSetsTable).where(
    and(eq(workoutSetsTable.date, date), eq(workoutSetsTable.userId, userId))
  );
  res.json(DeleteSessionResponse.parse({ deleted: result.rowCount ?? 0 }));
});

router.patch("/workouts/sets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid set ID" });
    return;
  }

  const parsed = UpdateWorkoutSetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const { exercise, weightLbs, reps, date } = parsed.data;
  const weightKg = (weightLbs / KG_TO_LBS).toFixed(6);

  const updated = await db
    .update(workoutSetsTable)
    .set({ exercise: exercise.trim(), weightKg, reps, date })
    .where(and(eq(workoutSetsTable.id, id), eq(workoutSetsTable.userId, req.userId!)))
    .returning();

  if (updated.length === 0) {
    res.status(404).json({ error: "Set not found" });
    return;
  }

  const r = updated[0];
  res.json(UpdateWorkoutSetResponse.parse({
    id: r.id,
    date: r.date,
    exercise: r.exercise,
    weightLbs: Math.round(Number(r.weightKg) * KG_TO_LBS * 10) / 10,
    reps: r.reps,
    notes: r.notes ?? null,
  }));
});

router.delete("/workouts/sets/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid set ID" });
    return;
  }

  const existing = await db
    .select({ id: workoutSetsTable.id })
    .from(workoutSetsTable)
    .where(and(eq(workoutSetsTable.id, id), eq(workoutSetsTable.userId, req.userId!)));

  if (existing.length === 0) {
    res.status(404).json({ error: "Set not found" });
    return;
  }

  await db.delete(workoutSetsTable).where(eq(workoutSetsTable.id, id));
  res.json(DeleteWorkoutSetResponse.parse({ deleted: 1 }));
});

router.patch("/workouts/sessions/:date/notes", async (req, res): Promise<void> => {
  const { date } = req.params;
  const parsed = UpdateSessionNotesBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const result = await db
    .update(workoutSetsTable)
    .set({ notes: parsed.data.notes ?? null })
    .where(and(eq(workoutSetsTable.date, date), eq(workoutSetsTable.userId, req.userId!)));

  res.json({ deleted: result.rowCount ?? 0 });
});

router.get("/workouts/sessions/:date/comparison", async (req, res): Promise<void> => {
  const { date } = req.params;
  const userId = req.userId!;

  const { rows: prevRows } = await db.execute<{ date: string }>(sql`
    SELECT DISTINCT date FROM workout_sets
    WHERE date < ${date} AND user_id = ${userId}
    ORDER BY date DESC LIMIT 1
  `);

  if (prevRows.length === 0) {
    res.json(GetSessionComparisonResponse.parse([]));
    return;
  }
  const prevDate = prevRows[0].date;

  const { rows: curr } = await db.execute<{ exercise: string; avg_kg: number; avg_reps: number }>(sql`
    SELECT exercise,
      CAST(AVG(weight_kg::numeric) AS float8) AS avg_kg,
      CAST(AVG(reps) AS float8) AS avg_reps
    FROM workout_sets WHERE date = ${date} AND user_id = ${userId}
    GROUP BY exercise
  `);

  const { rows: prev } = await db.execute<{ exercise: string; avg_kg: number; avg_reps: number }>(sql`
    SELECT exercise,
      CAST(AVG(weight_kg::numeric) AS float8) AS avg_kg,
      CAST(AVG(reps) AS float8) AS avg_reps
    FROM workout_sets WHERE date = ${prevDate} AND user_id = ${userId}
    GROUP BY exercise
  `);

  const prevMap = new Map(prev.map((r) => [r.exercise, r]));
  const result = curr
    .filter((r) => prevMap.has(r.exercise))
    .map((r) => {
      const p = prevMap.get(r.exercise)!;
      return {
        exercise: r.exercise,
        avgWeightLbsDelta: Math.round((r.avg_kg - p.avg_kg) * KG_TO_LBS * 10) / 10,
        avgRepsDelta: Math.round((r.avg_reps - p.avg_reps) * 10) / 10,
        prevDate,
      };
    });

  res.json(GetSessionComparisonResponse.parse(result));
});

router.get("/workouts/export.csv", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select({
      date: workoutSetsTable.date,
      exercise: workoutSetsTable.exercise,
      reps: workoutSetsTable.reps,
      weightKg: workoutSetsTable.weightKg,
      source: workoutSetsTable.source,
    })
    .from(workoutSetsTable)
    .where(eq(workoutSetsTable.userId, userId))
    .orderBy(workoutSetsTable.date, workoutSetsTable.exercise, workoutSetsTable.id);

  const header = "date,exercise,reps,weight_lbs,source";
  const lines = rows.map((r) =>
    `${r.date},${r.exercise.replace(/,/g, " ")},${r.reps},${Math.round(Number(r.weightKg) * KG_TO_LBS * 10) / 10},${r.source}`
  );
  const csv = [header, ...lines].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="workouts.csv"');
  res.send(csv);
});

router.get("/workouts/templates", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const templates = await db
    .select()
    .from(workoutTemplatesTable)
    .where(eq(workoutTemplatesTable.userId, userId))
    .orderBy(workoutTemplatesTable.createdAt);

  res.json(GetWorkoutTemplatesResponse.parse(
    templates.map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt.toISOString() }))
  ));
});

router.post("/workouts/templates", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { name, exercises } = parsed.data;
  const userId = req.userId!;

  const [template] = await db.insert(workoutTemplatesTable).values({ name, userId }).returning();

  const exerciseRows = exercises.map((ex, idx) => ({
    templateId: template.id,
    exercise: ex.exercise.trim(),
    weightKg: (ex.weightLbs / KG_TO_LBS).toFixed(6),
    reps: ex.reps,
    sets: ex.sets,
    order: ex.order ?? idx,
  }));

  const inserted = await db.insert(templateExercisesTable).values(exerciseRows).returning();

  res.status(201).json(GetWorkoutTemplateResponse.parse({
    id: template.id,
    name: template.name,
    createdAt: template.createdAt.toISOString(),
    exercises: inserted.map((e) => ({
      id: e.id,
      exercise: e.exercise,
      weightLbs: Math.round(Number(e.weightKg) * KG_TO_LBS * 10) / 10,
      reps: e.reps,
      sets: e.sets,
      order: e.order,
    })),
  }));
});

router.get("/workouts/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid template ID" }); return; }

  const [template] = await db.select().from(workoutTemplatesTable).where(
    and(eq(workoutTemplatesTable.id, id), eq(workoutTemplatesTable.userId, req.userId!))
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const exercises = await db
    .select()
    .from(templateExercisesTable)
    .where(eq(templateExercisesTable.templateId, id))
    .orderBy(asc(templateExercisesTable.order));

  res.json(GetWorkoutTemplateResponse.parse({
    id: template.id,
    name: template.name,
    createdAt: template.createdAt.toISOString(),
    exercises: exercises.map((e) => ({
      id: e.id,
      exercise: e.exercise,
      weightLbs: Math.round(Number(e.weightKg) * KG_TO_LBS * 10) / 10,
      reps: e.reps,
      sets: e.sets,
      order: e.order,
    })),
  }));
});

router.delete("/workouts/templates/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid template ID" }); return; }

  const [existing] = await db.select({ id: workoutTemplatesTable.id }).from(workoutTemplatesTable).where(
    and(eq(workoutTemplatesTable.id, id), eq(workoutTemplatesTable.userId, req.userId!))
  );
  if (!existing) { res.status(404).json({ error: "Template not found" }); return; }

  await db.delete(workoutTemplatesTable).where(eq(workoutTemplatesTable.id, id));
  res.json(DeleteWorkoutTemplateResponse.parse({ deleted: 1 }));
});

router.get("/workouts/personal-records-timeline", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const { rows } = await db.execute<{ exercise: string; max_weight_kg: number; pr_date: string }>(sql`
    SELECT DISTINCT ON (exercise)
      exercise,
      CAST(weight_kg AS FLOAT8) AS max_weight_kg,
      date AS pr_date
    FROM workout_sets
    WHERE user_id = ${userId}
    ORDER BY exercise, weight_kg::numeric DESC, date DESC
  `);

  const result = rows
    .map((r) => ({ exercise: r.exercise, maxWeightKg: r.max_weight_kg, prDate: r.pr_date }))
    .sort((a, b) => b.prDate.localeCompare(a.prDate));

  res.json(GetPersonalRecordsTimelineResponse.parse(result));
});

router.get("/workouts/suggestions", async (req, res): Promise<void> => {
  const userId = req.userId!;

  // Get the last 3 distinct session dates per exercise
  const { rows } = await db.execute<{ exercise: string; date: string; avg_reps: number; avg_weight_kg: number }>(sql`
    SELECT exercise, date,
      CAST(AVG(reps) AS float8) AS avg_reps,
      CAST(AVG(weight_kg::numeric) AS float8) AS avg_weight_kg
    FROM workout_sets
    WHERE user_id = ${userId}
    GROUP BY exercise, date
    ORDER BY exercise, date DESC
  `);

  // Group by exercise, keep last 3 sessions
  const byExercise = new Map<string, { date: string; avgReps: number; avgWeightKg: number }[]>();
  for (const row of rows) {
    if (!byExercise.has(row.exercise)) byExercise.set(row.exercise, []);
    const sessions = byExercise.get(row.exercise)!;
    if (sessions.length < 3) {
      sessions.push({ date: row.date, avgReps: Number(row.avg_reps), avgWeightKg: Number(row.avg_weight_kg) });
    }
  }

  const suggestions: { exercise: string; suggestedWeightLbs: number; currentWeightLbs: number; reason: string }[] = [];

  for (const [exercise, sessions] of byExercise) {
    if (sessions.length === 0) continue;
    const lastSession = sessions[0]; // already ordered DESC so first is most recent
    const lastAvgReps = lastSession.avgReps;
    const lastAvgWeightKg = lastSession.avgWeightKg;
    const currentWeightLbs = Math.round(lastAvgWeightKg * KG_TO_LBS * 10) / 10;

    let suggestedWeightLbs: number;
    let reason: string;

    if (lastAvgReps >= 12) {
      // Ready to increase — bump 5%, round to nearest 2.5 lbs
      const rawIncrease = currentWeightLbs * 1.05;
      suggestedWeightLbs = Math.round(rawIncrease / 2.5) * 2.5;
      reason = "Ready to increase";
    } else if (lastAvgReps < 8) {
      // Too heavy — drop 5%, round to nearest 2.5 lbs
      const rawDecrease = currentWeightLbs * 0.95;
      suggestedWeightLbs = Math.round(rawDecrease / 2.5) * 2.5;
      reason = "Too heavy";
    } else {
      // Keep going
      suggestedWeightLbs = Math.round(currentWeightLbs / 2.5) * 2.5;
      if (suggestedWeightLbs === 0) suggestedWeightLbs = currentWeightLbs;
      reason = "Keep going";
    }

    suggestions.push({ exercise, suggestedWeightLbs, currentWeightLbs, reason });
  }

  suggestions.sort((a, b) => a.exercise.localeCompare(b.exercise));
  res.json(GetWorkoutSuggestionsResponse.parse(suggestions));
});

router.get("/workouts/sessions-calories", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db
    .select({
      date: workoutSessionsTable.date,
      durationMinutes: workoutSessionsTable.durationMinutes,
      caloriesBurned: workoutSessionsTable.caloriesBurned,
    })
    .from(workoutSessionsTable)
    .where(eq(workoutSessionsTable.userId, userId))
    .orderBy(desc(workoutSessionsTable.date));

  const result = rows.map((r) => ({
    date: r.date,
    durationMinutes: r.durationMinutes ?? null,
    caloriesBurned: r.caloriesBurned != null ? Number(r.caloriesBurned) : null,
  }));

  res.json(GetWorkoutSessionsCaloriesResponse.parse(result));
});

router.get("/workouts/cardio-templates", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const rows = await db.select().from(cardioTemplatesTable).where(eq(cardioTemplatesTable.userId, userId)).orderBy(desc(cardioTemplatesTable.createdAt));
  res.json(GetCardioTemplatesResponse.parse(rows.map((r) => ({
    id: r.id,
    name: r.name,
    exerciseType: r.exerciseType,
    durationMinutes: r.durationMinutes,
    distanceMiles: r.distanceMiles != null ? Number(r.distanceMiles) : null,
    inclinePercent: r.inclinePercent != null ? Number(r.inclinePercent) : null,
    createdAt: r.createdAt.toISOString(),
  }))));
});

router.post("/workouts/cardio-templates", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const parsed = CreateCardioTemplateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { name, exerciseType, durationMinutes, distanceMiles, inclinePercent } = parsed.data;
  const [row] = await db.insert(cardioTemplatesTable).values({
    userId, name, exerciseType, durationMinutes,
    distanceMiles: distanceMiles != null ? String(distanceMiles) : null,
    inclinePercent: inclinePercent != null ? String(inclinePercent) : null,
  }).returning();
  res.json(CardioTemplateItem.parse({
    id: row.id, name: row.name, exerciseType: row.exerciseType,
    durationMinutes: row.durationMinutes,
    distanceMiles: row.distanceMiles != null ? Number(row.distanceMiles) : null,
    inclinePercent: row.inclinePercent != null ? Number(row.inclinePercent) : null,
    createdAt: row.createdAt.toISOString(),
  }));
});

router.delete("/workouts/cardio-templates/:id", async (req, res): Promise<void> => {
  const userId = req.userId!;
  const id = parseInt(req.params.id, 10);
  const result = await db.delete(cardioTemplatesTable).where(and(eq(cardioTemplatesTable.id, id), eq(cardioTemplatesTable.userId, userId)));
  res.json(DeleteCardioTemplateResponse.parse({ deleted: result.rowCount ?? 0 }));
});

router.post("/workouts/log-cardio", async (req, res): Promise<void> => {
  const userId = (req as any).userId as number;
  const parsed = LogCardioBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, exerciseType, durationMinutes, distanceMiles, inclinePercent, bodyWeightLbs, notes } = parsed.data;

  // Fetch body weight for calorie calc (use provided or last logged)
  let weightKg = 70; // default fallback
  if (bodyWeightLbs) {
    weightKg = bodyWeightLbs / KG_TO_LBS;
  } else {
    const bw = await db
      .select({ value: bodyMetricsTable.weightKg })
      .from(bodyMetricsTable)
      .where(eq(bodyMetricsTable.userId, userId))
      .orderBy(desc(bodyMetricsTable.date))
      .limit(1);
    if (bw[0]) weightKg = Number(bw[0].value);
  }

  // Calorie calculation
  let caloriesBurned: number | null = null;
  const hours = durationMinutes / 60;

  if (exerciseType === "treadmill" && distanceMiles) {
    const speedMph = distanceMiles / hours;
    const grade = (inclinePercent ?? 0) / 100;
    // ACSM formula: different for walking vs running
    const met = speedMph < 5
      ? 0.1 * speedMph + 1.8 * speedMph * grade + 3.5
      : 0.2 * speedMph + 0.9 * speedMph * grade + 3.5;
    caloriesBurned = Math.round(met * weightKg * hours * 10) / 10;
  } else if (exerciseType === "outdoor_run" && distanceMiles) {
    const speedMph = distanceMiles / hours;
    const met = 0.2 * speedMph + 3.5;
    caloriesBurned = Math.round(met * weightKg * hours * 10) / 10;
  } else if (exerciseType === "bike") {
    const met = distanceMiles ? Math.min(10, Math.max(4, (distanceMiles / hours) * 0.4)) : 6.0;
    caloriesBurned = Math.round(met * weightKg * hours * 10) / 10;
  } else if (exerciseType === "elliptical") {
    caloriesBurned = Math.round(6.0 * weightKg * hours * 10) / 10;
  }

  await db.insert(cardioSessionsTable).values({
    userId,
    date,
    exerciseType,
    durationMinutes,
    distanceMiles: distanceMiles != null ? String(distanceMiles) : null,
    inclinePercent: inclinePercent != null ? String(inclinePercent) : null,
    caloriesBurned: caloriesBurned != null ? String(caloriesBurned) : null,
    notes: notes ?? null,
  });

  res.json(LogCardioResponse.parse({ caloriesBurned }));
});

export default router;
