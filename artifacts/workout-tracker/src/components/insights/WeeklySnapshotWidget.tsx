import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus, Dumbbell, Calendar, Flame, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetWorkoutsByExercise, useGetBodyMetrics, useGetCalorieLogs } from "@workspace/api-client-react";

const KG_TO_LBS = 2.20462;

function toLocalDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getRollingBounds(anchor: string) {
  const anchorDate = new Date(anchor + "T00:00:00");
  const d7 = new Date(anchorDate); d7.setDate(anchorDate.getDate() - 7);
  const d14 = new Date(anchorDate); d14.setDate(anchorDate.getDate() - 14);
  return {
    anchorStr: anchor,
    thisWeekStart: toLocalDateStr(d7),
    lastWeekStart: toLocalDateStr(d14),
  };
}

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
};

function StatCard({ icon, label, value, delta, deltaLabel }: StatCardProps) {
  const sign = delta == null ? null : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <div className="bg-muted/40 rounded-xl p-4 border border-border flex flex-col gap-2">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider font-medium">
        {icon}
        {label}
      </div>
      <p className="text-2xl font-black tabular-nums text-foreground">{value}</p>
      {delta != null && (
        <div className={`flex items-center gap-1 text-xs font-medium ${sign === "up" ? "text-green-500" : sign === "down" ? "text-red-400" : "text-muted-foreground"}`}>
          {sign === "up" ? <TrendingUp className="w-3 h-3" /> : sign === "down" ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          {delta > 0 ? "+" : ""}{deltaLabel ?? `${delta}`} vs last week
        </div>
      )}
    </div>
  );
}

export function WeeklySnapshotWidget() {
  const { data: workoutData } = useGetWorkoutsByExercise();
  const { data: bodyMetrics } = useGetBodyMetrics();
  const { data: calorieLogs } = useGetCalorieLogs();

  const stats = useMemo(() => {
    const todayStr = toLocalDateStr(new Date());

    const workoutDates = workoutData?.map(r => r.date) ?? [];
    const mostRecentWorkoutDate = workoutDates.length > 0 ? [...workoutDates].sort().at(-1)! : todayStr;
    const anchor = mostRecentWorkoutDate <= todayStr ? mostRecentWorkoutDate : todayStr;

    const { anchorStr, thisWeekStart, lastWeekStart } = getRollingBounds(anchor);

    const thisWeekRows = workoutData?.filter(r => r.date > thisWeekStart && r.date <= anchorStr) ?? [];
    const lastWeekRows = workoutData?.filter(r => r.date > lastWeekStart && r.date <= thisWeekStart) ?? [];

    const thisWeekDates = new Set(thisWeekRows.map(r => r.date));
    const lastWeekDates = new Set(lastWeekRows.map(r => r.date));
    const sessions = thisWeekDates.size;
    const sessionsDelta = sessions - lastWeekDates.size;

    const thisVolumeLbs = thisWeekRows.reduce((s, r) => s + r.totalKg * KG_TO_LBS, 0);
    const lastVolumeLbs = lastWeekRows.reduce((s, r) => s + r.totalKg * KG_TO_LBS, 0);
    const volumeDeltaPct = lastVolumeLbs > 0 ? Math.round(((thisVolumeLbs - lastVolumeLbs) / lastVolumeLbs) * 100) : null;

    const recentWeight = bodyMetrics?.at(-1)?.weightLbs ?? null;
    const prevWeight = bodyMetrics?.at(-2)?.weightLbs ?? null;
    const weightDelta = recentWeight != null && prevWeight != null ? Math.round((recentWeight - prevWeight) * 10) / 10 : null;

    const thisWeekCals = (calorieLogs ?? []).filter(l => l.date > thisWeekStart && l.date <= anchorStr);
    const deficits = thisWeekCals.map(l => (l.caloriesBurned ?? 0) - (l.caloriesConsumed ?? 0)).filter(d => d !== 0);
    const avgDeficit = deficits.length > 0 ? Math.round(deficits.reduce((a, b) => a + b, 0) / deficits.length) : null;

    return { sessions, sessionsDelta, thisVolumeLbs, volumeDeltaPct, recentWeight, weightDelta, avgDeficit };
  }, [workoutData, bodyMetrics, calorieLogs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Last 7 Days</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<Calendar className="w-3.5 h-3.5" />}
            label="Sessions"
            value={String(stats.sessions)}
            delta={stats.sessionsDelta}
            deltaLabel={`${stats.sessionsDelta > 0 ? "+" : ""}${stats.sessionsDelta}`}
          />
          <StatCard
            icon={<Dumbbell className="w-3.5 h-3.5" />}
            label="Volume"
            value={stats.thisVolumeLbs > 0 ? `${Math.round(stats.thisVolumeLbs).toLocaleString()} lbs` : "—"}
            delta={stats.volumeDeltaPct}
            deltaLabel={`${stats.volumeDeltaPct != null && stats.volumeDeltaPct > 0 ? "+" : ""}${stats.volumeDeltaPct}%`}
          />
          <StatCard
            icon={<Scale className="w-3.5 h-3.5" />}
            label="Body Weight"
            value={stats.recentWeight != null ? `${stats.recentWeight} lbs` : "—"}
            delta={stats.weightDelta}
            deltaLabel={`${stats.weightDelta != null && stats.weightDelta > 0 ? "+" : ""}${stats.weightDelta} lbs`}
          />
          <StatCard
            icon={<Flame className="w-3.5 h-3.5" />}
            label="Avg Deficit"
            value={stats.avgDeficit != null ? `${stats.avgDeficit > 0 ? "+" : ""}${stats.avgDeficit} kcal` : "—"}
          />
        </div>
      </CardContent>
    </Card>
  );
}
