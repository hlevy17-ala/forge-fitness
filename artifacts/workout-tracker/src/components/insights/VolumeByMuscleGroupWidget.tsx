import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetWorkoutsByMuscleGroup, type InsightsDateParams } from "@workspace/api-client-react";

const KG_TO_LBS = 2.20462;

const MUSCLE_COLORS: Record<string, string> = {
  Chest: "hsl(20 95% 58%)",
  Back: "hsl(200 80% 55%)",
  Shoulders: "hsl(270 60% 65%)",
  Legs: "hsl(150 60% 50%)",
  Biceps: "hsl(40 90% 55%)",
  Triceps: "hsl(320 60% 60%)",
  Core: "hsl(180 60% 50%)",
  Other: "hsl(0 0% 55%)",
};

function getMondayKey(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayOfWeek);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function shortDate(dateStr: string) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

interface VolumeByMuscleGroupWidgetProps {
  dateParams?: InsightsDateParams;
}

export function VolumeByMuscleGroupWidget({ dateParams }: VolumeByMuscleGroupWidgetProps) {
  const { data, isLoading } = useGetWorkoutsByMuscleGroup(dateParams);

  const { chartData, muscleGroups } = useMemo(() => {
    const weekMap = new Map<string, Record<string, number>>();
    for (const row of data ?? []) {
      const week = getMondayKey(row.date);
      if (!weekMap.has(week)) weekMap.set(week, {});
      const entry = weekMap.get(week)!;
      entry[row.muscleGroup] = (entry[row.muscleGroup] ?? 0) + row.totalKg * KG_TO_LBS;
    }
    const sorted = [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const muscleGroups = [...new Set((data ?? []).map(r => r.muscleGroup))].sort();
    const chartData = sorted.map(([week, groups]) => ({
      week: shortDate(week),
      ...Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, Math.round(v)])),
    }));
    return { chartData, muscleGroups };
  }, [data]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Weekly Volume by Muscle</CardTitle>
        <p className="text-xs text-muted-foreground">Total lbs lifted per muscle group</p>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="h-48 bg-muted/40 rounded-lg animate-pulse" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No workout data available.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                formatter={(v: number) => [`${v.toLocaleString()} lbs`, undefined]}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              {muscleGroups.map(mg => (
                <Bar key={mg} dataKey={mg} stackId="a" fill={MUSCLE_COLORS[mg] ?? MUSCLE_COLORS.Other} radius={mg === muscleGroups[muscleGroups.length - 1] ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
