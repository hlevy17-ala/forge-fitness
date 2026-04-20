import { useMemo } from "react";
import { useGetEstimatedOneRm, useGetBodyMetrics } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

const KG_TO_LBS = 2.20462;

type Level = "Untrained" | "Beginner" | "Novice" | "Intermediate" | "Advanced" | "Elite";

const LEVEL_COLORS: Record<Level, string> = {
  Untrained: "bg-zinc-700 text-zinc-200",
  Beginner: "bg-blue-900/60 text-blue-300",
  Novice: "bg-teal-900/60 text-teal-300",
  Intermediate: "bg-yellow-900/60 text-yellow-300",
  Advanced: "bg-orange-900/60 text-orange-300",
  Elite: "bg-purple-900/60 text-purple-300",
};

// Strength standards as body-weight multipliers for estimated 1RM
// Source: approximate Symmetric Strength / ExRx standards for males (conservative)
const STANDARDS: Record<string, Record<Level, number>> = {
  "Bench Press":      { Untrained: 0.3, Beginner: 0.5, Novice: 0.75, Intermediate: 1.0, Advanced: 1.3, Elite: 1.6 },
  "Squat":            { Untrained: 0.5, Beginner: 0.75, Novice: 1.0, Intermediate: 1.25, Advanced: 1.6, Elite: 2.0 },
  "Deadlift":         { Untrained: 0.5, Beginner: 0.85, Novice: 1.1, Intermediate: 1.4, Advanced: 1.75, Elite: 2.1 },
  "Overhead Press":   { Untrained: 0.2, Beginner: 0.35, Novice: 0.55, Intermediate: 0.7, Advanced: 0.9, Elite: 1.1 },
  "Lat Pulldown":     { Untrained: 0.3, Beginner: 0.5, Novice: 0.7, Intermediate: 0.9, Advanced: 1.1, Elite: 1.3 },
  "Barbell Row":      { Untrained: 0.3, Beginner: 0.5, Novice: 0.75, Intermediate: 1.0, Advanced: 1.25, Elite: 1.5 },
  "Bicep Curl":       { Untrained: 0.1, Beginner: 0.2, Novice: 0.3, Intermediate: 0.4, Advanced: 0.55, Elite: 0.7 },
  "Tricep Pushdown":  { Untrained: 0.1, Beginner: 0.2, Novice: 0.3, Intermediate: 0.45, Advanced: 0.6, Elite: 0.75 },
};

const ORDERED_LEVELS: Level[] = ["Untrained", "Beginner", "Novice", "Intermediate", "Advanced", "Elite"];

function classify(oneRmLbs: number, bodyWeightLbs: number, exercise: string): Level {
  const std = STANDARDS[exercise];
  if (!std) return "Beginner";
  const ratio = oneRmLbs / bodyWeightLbs;
  let level: Level = "Untrained";
  for (const l of ORDERED_LEVELS) {
    if (ratio >= std[l]) level = l;
  }
  return level;
}

function LevelBar({ level }: { level: Level }) {
  const idx = ORDERED_LEVELS.indexOf(level);
  return (
    <div className="flex gap-0.5 mt-1">
      {ORDERED_LEVELS.filter(l => l !== "Untrained").map((l, i) => (
        <div
          key={l}
          className={`h-1.5 flex-1 rounded-full transition-colors ${i <= idx - 1 ? "bg-primary" : "bg-muted/40"}`}
        />
      ))}
    </div>
  );
}

export function StrengthStandardsWidget() {
  const { data: allOneRm = [] } = useGetEstimatedOneRm();
  const { data: bodyMetrics = [] } = useGetBodyMetrics();

  const bodyWeightLbs = useMemo(() => {
    const sorted = [...bodyMetrics].sort((a, b) => b.date.localeCompare(a.date));
    const latest = sorted.find((m) => m.weightLbs != null);
    return latest?.weightLbs ? Number(latest.weightLbs) : null;
  }, [bodyMetrics]);

  const latestOneRm = useMemo(() => {
    const byExercise = new Map<string, { date: string; lbs: number }>();
    for (const r of allOneRm) {
      const existing = byExercise.get(r.exercise);
      if (!existing || r.date > existing.date) {
        byExercise.set(r.exercise, { date: r.date, lbs: r.estimatedOneRmLbs });
      }
    }
    return byExercise;
  }, [allOneRm]);

  const standards = useMemo(() => {
    return Object.keys(STANDARDS)
      .map((exercise) => {
        const data = latestOneRm.get(exercise);
        if (!data) return null;
        const level = bodyWeightLbs ? classify(data.lbs, bodyWeightLbs, exercise) : null;
        return { exercise, oneRmLbs: data.lbs, level };
      })
      .filter(Boolean) as { exercise: string; oneRmLbs: number; level: Level | null }[];
  }, [latestOneRm, bodyWeightLbs]);

  if (standards.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4">
        <h3 className="font-bold text-base">Strength Standards</h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {bodyWeightLbs
            ? `Based on your body weight (${Math.round(bodyWeightLbs)} lbs) and estimated 1RM`
            : "Log your body weight in Biometrics to see your classification"}
        </p>
      </div>
      <div className="space-y-3">
        {standards.map(({ exercise, oneRmLbs, level }) => (
          <div key={exercise}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{exercise}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{oneRmLbs} lbs est. 1RM</span>
                {level && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLORS[level]}`}>
                    {level}
                  </span>
                )}
              </div>
            </div>
            {level && <LevelBar level={level} />}
          </div>
        ))}
      </div>
      {!bodyWeightLbs && (
        <p className="text-xs text-muted-foreground mt-4 text-center italic">
          Add a body weight entry in the Biometrics tab to unlock strength classifications.
        </p>
      )}
    </div>
  );
}
