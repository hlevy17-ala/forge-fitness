import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetCalorieLogs, useGetCalorieDailyGoal, useGetCalorieBurnGoal } from "@workspace/api-client-react";

function shortDate(dateStr: string) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

export function CalorieAdherenceWidget() {
  const { data: logs } = useGetCalorieLogs();
  const { data: consumeGoalData } = useGetCalorieDailyGoal();
  const { data: burnGoalData } = useGetCalorieBurnGoal();

  const consumeGoal = consumeGoalData?.value ?? null;
  const burnGoal = burnGoalData?.value ?? null;
  const targetDeficit = burnGoal != null && consumeGoal != null ? burnGoal - consumeGoal : null;

  const { chartData, adherenceRate, avgDeficit, hasAnyData } = useMemo(() => {
    const logMap = new Map<string, { caloriesConsumed: number | null; caloriesBurned: number | null }>();
    for (const l of logs ?? []) {
      logMap.set(l.date, { caloriesConsumed: l.caloriesConsumed ?? null, caloriesBurned: l.caloriesBurned ?? null });
    }

    const today = new Date();
    const days: { date: string; deficit: number | null; hasData: boolean }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0"),
      ].join("-");
      const log = logMap.get(iso);
      if (log) {
        days.push({ date: shortDate(iso), deficit: (log.caloriesBurned ?? 0) - (log.caloriesConsumed ?? 0), hasData: true });
      } else {
        days.push({ date: shortDate(iso), deficit: null, hasData: false });
      }
    }

    const chartData = days.map(d => ({ date: d.date, deficit: d.deficit ?? 0, hasData: d.hasData }));
    const loggedDays = days.filter(d => d.hasData);
    const daysWithDeficit = loggedDays.filter(d => (d.deficit ?? 0) > 0).length;
    const adherenceRate = loggedDays.length > 0 ? Math.round((daysWithDeficit / loggedDays.length) * 100) : null;
    const avgDeficit = loggedDays.length > 0
      ? Math.round(loggedDays.reduce((s, d) => s + (d.deficit ?? 0), 0) / loggedDays.length)
      : null;

    return { chartData, adherenceRate, avgDeficit, hasAnyData: loggedDays.length > 0 };
  }, [logs]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Calorie Adherence</CardTitle>
            <p className="text-xs text-muted-foreground">Daily deficit (burned − consumed)</p>
          </div>
          {adherenceRate != null && (
            <div className="text-right shrink-0">
              <p className="text-xl font-black tabular-nums text-primary">{adherenceRate}%</p>
              <p className="text-xs text-muted-foreground">days in deficit</p>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        {!hasAnyData ? (
          <p className="text-sm text-muted-foreground text-center py-8">No nutrition data logged yet.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chartData} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
                  formatter={(v: number) => [`${v > 0 ? "+" : ""}${v} kcal`, "Deficit"]}
                />
                {targetDeficit != null && (
                  <ReferenceLine y={targetDeficit} stroke="hsl(20 95% 58%)" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Goal", position: "right", fontSize: 9, fill: "hsl(20 95% 58%)" }} />
                )}
                <ReferenceLine y={0} stroke="hsl(var(--border))" strokeWidth={1} />
                <Bar dataKey="deficit" radius={[3, 3, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        !entry.hasData
                          ? "hsl(var(--muted))"
                          : entry.deficit >= (targetDeficit ?? 0)
                          ? "hsl(150 60% 45%)"
                          : "hsl(20 80% 50%)"
                      }
                      opacity={entry.hasData ? 1 : 0.4}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {avgDeficit != null && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                Avg deficit: <span className={`font-semibold tabular-nums ${avgDeficit >= 0 ? "text-green-500" : "text-red-400"}`}>{avgDeficit > 0 ? "+" : ""}{avgDeficit} kcal/day</span>
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
