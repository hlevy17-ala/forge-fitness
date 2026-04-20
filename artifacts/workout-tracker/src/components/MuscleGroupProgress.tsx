import { useMemo, useState, useCallback } from "react";
import { useGetWorkoutsByMuscleGroup, useGetAvgWeightByMuscleGroup } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Weight, TrendingUp } from "lucide-react";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Triceps", "Biceps", "Legs", "Core"];
const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--chart-6))",
  "hsl(var(--chart-7))",
];

const KG_TO_LBS = 2.20462;

type ChartRow = { date: string } & Record<string, string | number>;

export function MuscleGroupProgress() {
  const { data: rawVolume = [], isLoading: isLoadingVolume } = useGetWorkoutsByMuscleGroup();
  const { data: rawAvg = [], isLoading: isLoadingAvg } = useGetAvgWeightByMuscleGroup();

  const [activeGroups, setActiveGroups] = useState<Set<string>>(new Set(MUSCLE_GROUPS));

  const toggleGroup = useCallback((mg: string) => {
    setActiveGroups(prev => {
      const next = new Set(prev);
      if (next.has(mg)) {
        if (next.size === 1) return prev;
        next.delete(mg);
      } else {
        next.add(mg);
      }
      return next;
    });
  }, []);

  const selectOnly = useCallback((mg: string) => {
    setActiveGroups(new Set([mg]));
  }, []);

  const selectAll = useCallback(() => {
    setActiveGroups(new Set(MUSCLE_GROUPS));
  }, []);

  const volumeData = useMemo((): ChartRow[] => {
    if (!rawVolume.length) return [];
    const byDate: Record<string, ChartRow> = {};
    for (const curr of rawVolume) {
      if (!byDate[curr.date]) byDate[curr.date] = { date: curr.date };
      byDate[curr.date][curr.muscleGroup] = Math.round(curr.totalKg * KG_TO_LBS);
    }
    return Object.values(byDate).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [rawVolume]);

  const avgWeightData = useMemo((): ChartRow[] => {
    if (!rawAvg.length) return [];
    const byDate: Record<string, ChartRow> = {};
    for (const curr of rawAvg) {
      if (!byDate[curr.date]) byDate[curr.date] = { date: curr.date };
      byDate[curr.date][curr.muscleGroup] = Math.round(curr.avgWeightKg * KG_TO_LBS * 10) / 10;
    }
    return Object.values(byDate).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
  }, [rawAvg]);

  const tickFormatter = (val: string) => {
    const [, m, d] = val.split("-");
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  };

  const axisStyle = {
    stroke: "hsl(var(--muted-foreground))",
    fontSize: 12,
    tickLine: false as const,
    axisLine: false as const,
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "hsl(var(--card))",
      borderColor: "hsl(var(--border))",
      borderRadius: "var(--radius-md)",
      color: "hsl(var(--foreground))",
    },
    labelStyle: { color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 8 },
  };

  if (isLoadingVolume || isLoadingAvg) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  const isEmpty = volumeData.length === 0;
  const allActive = activeGroups.size === MUSCLE_GROUPS.length;

  const FilterLegend = () => (
    <div className="flex flex-wrap gap-2 px-6 pb-4 pt-2">
      {MUSCLE_GROUPS.map((mg, i) => {
        const isActive = activeGroups.has(mg);
        return (
          <button
            key={mg}
            onClick={() => toggleGroup(mg)}
            onDoubleClick={() => selectOnly(mg)}
            title="Click to toggle · Double-click to isolate"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all"
            style={{
              borderColor: COLORS[i],
              backgroundColor: isActive ? COLORS[i] + "33" : "transparent",
              color: isActive ? COLORS[i] : "hsl(var(--muted-foreground))",
              opacity: isActive ? 1 : 0.45,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: isActive ? COLORS[i] : "hsl(var(--muted-foreground))" }}
            />
            {mg}
          </button>
        );
      })}
      {!allActive && (
        <button
          onClick={selectAll}
          className="px-3 py-1 rounded-full text-xs font-semibold border border-border text-muted-foreground hover:text-foreground transition-all"
        >
          Show all
        </button>
      )}
    </div>
  );

  const sharedLines = MUSCLE_GROUPS.map((mg, i) => (
    <Line
      key={mg}
      type="monotone"
      dataKey={mg}
      name={mg}
      stroke={COLORS[i % COLORS.length]}
      strokeWidth={activeGroups.has(mg) ? 2.5 : 0}
      dot={false}
      activeDot={activeGroups.has(mg) ? { r: 5, strokeWidth: 0 } : false}
      connectNulls
    />
  ));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Muscle Groups</h2>
        <p className="text-muted-foreground">Track average weight and volume distribution across primary muscle groups.</p>
      </div>

      {isEmpty ? (
        <Card className="h-[500px] flex items-center justify-center border-dashed">
          <div className="text-center text-muted-foreground">
            <p>Upload data to see your muscle group progression.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <Weight className="w-5 h-5 text-chart-2" />
                Average Weight per Set
              </CardTitle>
              <CardDescription>
                Average weight lifted per set (lbs) per muscle group. Click a group to toggle · double-click to isolate.
              </CardDescription>
            </CardHeader>
            <FilterLegend />
            <CardContent className="pt-2">
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={avgWeightData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={tickFormatter} dy={10} {...axisStyle} />
                    <YAxis tickFormatter={(val) => `${val}lbs`} {...axisStyle} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value: number, name: string) =>
                        activeGroups.has(name) ? [`${value} lbs`, name] : []
                      }
                    />
                    {sharedLines}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <CardTitle className="text-xl flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-chart-1" />
                Regional Volume History
              </CardTitle>
              <CardDescription>
                Total pounds lifted per session by muscle group. Same filter applies.
              </CardDescription>
            </CardHeader>
            <FilterLegend />
            <CardContent className="pt-2">
              <div className="h-[340px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeData} margin={{ top: 10, right: 10, left: 15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={tickFormatter} dy={10} {...axisStyle} />
                    <YAxis tickFormatter={(val) => `${val}lbs`} {...axisStyle} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value: number, name: string) =>
                        activeGroups.has(name) ? [`${value} lbs`, name] : []
                      }
                    />
                    {sharedLines}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
