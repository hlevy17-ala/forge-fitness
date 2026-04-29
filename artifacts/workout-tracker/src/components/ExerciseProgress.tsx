import { useState, useMemo, useEffect } from "react";
import { useGetWorkoutsByExercise, useGetExerciseList, useGetAvgWeightByExercise, useGetPersonalRecords } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity, Weight, Trophy, Minus, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExerciseHistorySheet } from "./ExerciseHistorySheet";

export function ExerciseProgress() {
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [viewMode, setViewMode] = useState<"history" | "comparison">("history");
  const [historyExercise, setHistoryExercise] = useState<string | null>(null);

  const { data: exercises = [], isLoading: isLoadingList } = useGetExerciseList();
  const { data: allWorkouts = [], isLoading: isLoadingWorkouts } = useGetWorkoutsByExercise();
  const { data: allAvgWeights = [], isLoading: isLoadingAvg } = useGetAvgWeightByExercise();
  const { data: personalRecords = [], isLoading: isLoadingPRs } = useGetPersonalRecords();

  useEffect(() => {
    if (exercises.length > 0 && allWorkouts.length > 0 && !selectedExercise) {
      const sessionCounts: Record<string, Set<string>> = {};
      for (const w of allWorkouts) {
        if (!sessionCounts[w.exercise]) sessionCounts[w.exercise] = new Set();
        sessionCounts[w.exercise].add(w.date);
      }
      const mostLogged = exercises.reduce((best, ex) =>
        (sessionCounts[ex]?.size ?? 0) > (sessionCounts[best]?.size ?? 0) ? ex : best,
        exercises[0]
      );
      setSelectedExercise(mostLogged);
    }
  }, [exercises, allWorkouts, selectedExercise]);

  const KG_TO_LBS = 2.20462;

  const volumeData = useMemo(() => {
    if (!selectedExercise || !allWorkouts.length) return [];
    return allWorkouts
      .filter(w => w.exercise === selectedExercise)
      .map(w => ({ ...w, totalLbs: Math.round(w.totalKg * KG_TO_LBS) }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allWorkouts, selectedExercise]);

  const avgWeightData = useMemo(() => {
    if (!selectedExercise || !allAvgWeights.length) return [];
    return allAvgWeights
      .filter(w => w.exercise === selectedExercise)
      .map(w => ({
        date: w.date,
        avgLbs: Math.round(w.avgWeightKg * KG_TO_LBS * 10) / 10,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allAvgWeights, selectedExercise]);

  const maxVolume = useMemo(() => {
    if (!volumeData.length) return 0;
    return Math.max(...volumeData.map(d => d.totalLbs));
  }, [volumeData]);

  const maxAvgWeight = useMemo(() => {
    if (!avgWeightData.length) return 0;
    return Math.max(...avgWeightData.map(d => d.avgLbs));
  }, [avgWeightData]);

  const comparisonData = useMemo(() => {
    if (avgWeightData.length < 1 || volumeData.length < 1) return null;
    const lastAvg = avgWeightData[avgWeightData.length - 1];
    const prevAvg = avgWeightData.length >= 2 ? avgWeightData[avgWeightData.length - 2] : null;
    const lastVol = volumeData[volumeData.length - 1];
    const prevVol = volumeData.length >= 2 ? volumeData[volumeData.length - 2] : null;
    return { lastAvg, prevAvg, lastVol, prevVol };
  }, [avgWeightData, volumeData]);

  const tickFormatter = (val: string) => {
    const [, m, d] = val.split("-");
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  };

  const axisStyle = {
    stroke: "hsl(var(--muted-foreground))",
    fontSize: 12,
    tickLine: false,
    axisLine: false,
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: "hsl(var(--card))",
      borderColor: "hsl(var(--border))",
      borderRadius: "var(--radius-md)",
      color: "hsl(var(--foreground))",
    },
    labelStyle: { color: "hsl(var(--muted-foreground))", marginBottom: 4 },
  };

  function DeltaBadge({ current, previous }: { current: number; previous: number | null }) {
    if (previous === null || previous === 0) return <span className="text-muted-foreground text-xs">first session</span>;
    const pct = ((current - previous) / previous) * 100;
    const rounded = Math.round(Math.abs(pct) * 10) / 10;
    if (Math.abs(pct) < 0.1) return <span className="text-muted-foreground text-xs flex items-center gap-1"><Minus className="w-3 h-3" />No change</span>;
    const up = pct > 0;
    return (
      <span className={`text-xs font-semibold flex items-center gap-1 ${up ? "text-chart-2" : "text-destructive"}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? "+" : "-"}{rounded}%
      </span>
    );
  }

  function formatDate(dateStr: string) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  const isLoading = isLoadingList || isLoadingWorkouts || isLoadingAvg || isLoadingPRs;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[80px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {personalRecords.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Personal Records</h3>
          </div>
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 w-max">
              {personalRecords.map(pr => (
                <div
                  key={pr.exercise}
                  className="flex-shrink-0 rounded-lg border border-border bg-card px-4 py-3 min-w-[140px]"
                >
                  <p className="text-xs text-muted-foreground truncate max-w-[130px] mb-1">{pr.exercise}</p>
                  <p className="text-xl font-bold tabular-nums text-primary">
                    {Math.round(pr.maxWeightKg * KG_TO_LBS)} lbs
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Exercise Progress</h2>
          <p className="text-muted-foreground">Analyze your volume and average weight progression per exercise.</p>
        </div>

        <div className="flex flex-col gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 w-full">
            <div className="flex-1 sm:w-[260px]">
              <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                <SelectTrigger>
                  <SelectValue placeholder="Select exercise" />
                </SelectTrigger>
                <SelectContent>
                  {exercises.map(ex => (
                    <SelectItem key={ex} value={ex}>{ex}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedExercise && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHistoryExercise(selectedExercise)}
                className="shrink-0 gap-1.5 text-xs"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                1RM History
              </Button>
            )}
          </div>
          <div className="flex rounded-md border border-border overflow-hidden w-full sm:w-auto">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewMode("history")}
              className={`flex-1 sm:flex-none rounded-none px-3 h-9 text-xs font-medium ${viewMode === "history" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"}`}
            >
              Full History
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewMode("comparison")}
              className={`flex-1 sm:flex-none rounded-none px-3 h-9 text-xs font-medium border-l border-border ${viewMode === "comparison" ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground"}`}
            >
              Last Session
            </Button>
          </div>
        </div>
      </div>

      {!selectedExercise ? (
        <Card className="h-[400px] flex items-center justify-center border-dashed">
          <div className="text-center text-muted-foreground flex flex-col items-center">
            <Activity className="w-12 h-12 mb-4 opacity-20" />
            <p>Select an exercise to view history</p>
          </div>
        </Card>
      ) : volumeData.length === 0 ? (
        <Card className="h-[400px] flex items-center justify-center border-dashed">
          <div className="text-center text-muted-foreground">
            <p>No data found for this exercise.</p>
          </div>
        </Card>
      ) : viewMode === "comparison" ? (
        comparisonData ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase tracking-widest font-semibold">Latest Session</CardDescription>
                  <CardTitle className="text-base">{formatDate(comparisonData.lastAvg.date)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Weight className="w-3 h-3" />Avg Weight / Set</p>
                    <p className="text-3xl font-bold tabular-nums text-chart-2">{comparisonData.lastAvg.avgLbs} lbs</p>
                    <DeltaBadge
                      current={comparisonData.lastAvg.avgLbs}
                      previous={comparisonData.prevAvg?.avgLbs ?? null}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Total Volume</p>
                    <p className="text-3xl font-bold tabular-nums text-chart-1">{comparisonData.lastVol.totalLbs.toLocaleString()} lbs</p>
                    <DeltaBadge
                      current={comparisonData.lastVol.totalLbs}
                      previous={comparisonData.prevVol?.totalLbs ?? null}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="opacity-70">
                <CardHeader className="pb-2">
                  <CardDescription className="text-xs uppercase tracking-widest font-semibold">Previous Session</CardDescription>
                  <CardTitle className="text-base">
                    {comparisonData.prevAvg ? formatDate(comparisonData.prevAvg.date) : "—"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Weight className="w-3 h-3" />Avg Weight / Set</p>
                    <p className="text-3xl font-bold tabular-nums text-muted-foreground">
                      {comparisonData.prevAvg ? `${comparisonData.prevAvg.avgLbs} lbs` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Total Volume</p>
                    <p className="text-3xl font-bold tabular-nums text-muted-foreground">
                      {comparisonData.prevVol ? `${comparisonData.prevVol.totalLbs.toLocaleString()} lbs` : "—"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Comparing the two most recent sessions for <span className="font-semibold text-foreground">{selectedExercise}</span>.
              Switch to History to see the full timeline.
            </p>
          </div>
        ) : (
          <Card className="h-[300px] flex items-center justify-center border-dashed">
            <p className="text-muted-foreground text-sm">Not enough sessions to compare.</p>
          </Card>
        )
      ) : avgWeightData.length === 1 ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-2 mb-8">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Only session logged</p>
              <p className="text-sm text-muted-foreground">{formatDate(avgWeightData[0].date)}</p>
            </div>
            <div className="grid grid-cols-2 gap-8 max-w-sm mx-auto">
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><Weight className="w-3 h-3" />Avg Weight / Set</p>
                <p className="text-4xl font-black tabular-nums text-chart-2">{avgWeightData[0].avgLbs}</p>
                <p className="text-sm text-muted-foreground">lbs</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1"><TrendingUp className="w-3 h-3" />Total Volume</p>
                <p className="text-4xl font-black tabular-nums text-chart-1">{volumeData[0]?.totalLbs.toLocaleString() ?? "—"}</p>
                <p className="text-sm text-muted-foreground">lbs</p>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-8">Log more sessions to see progression charts.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Weight className="w-5 h-5 text-chart-2" />
                    Average Weight per Set
                  </CardTitle>
                  <CardDescription>Average weight lifted per set (lbs) over time</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Peak Avg</p>
                  <p className="text-2xl font-bold text-chart-2 tabular-nums">{maxAvgWeight} lbs</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-8">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={avgWeightData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={tickFormatter} dy={10} {...axisStyle} />
                    <YAxis dx={-10} tickFormatter={(val) => `${val}lbs`} {...axisStyle} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value: number) => [`${value} lbs`, "Avg Weight / Set"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgLbs"
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                      activeDot={{ r: 6, fill: "hsl(var(--chart-2))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/20 pb-4">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-chart-1" />
                    {selectedExercise}
                  </CardTitle>
                  <CardDescription>Total volume (lbs) over time</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Peak Volume</p>
                  <p className="text-2xl font-bold text-chart-1 tabular-nums">{maxVolume.toLocaleString()} lbs</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 pt-8">
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={volumeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={tickFormatter} dy={10} {...axisStyle} />
                    <YAxis dx={-10} tickFormatter={(val) => `${val}lbs`} {...axisStyle} />
                    <Tooltip
                      {...tooltipStyle}
                      formatter={(value: number) => [`${value.toLocaleString()} lbs`, "Total Volume"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="totalLbs"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorVolume)"
                      activeDot={{ r: 6, fill: "hsl(var(--chart-1))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <ExerciseHistorySheet
        exercise={historyExercise}
        onClose={() => setHistoryExercise(null)}
      />
    </div>
  );
}
