import { useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useGetAvgWeightByExercise, useGetEstimatedOneRm, useGetPersonalRecords } from "@workspace/api-client-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Trophy, Activity, TrendingUp } from "lucide-react";

interface Props {
  exercise: string | null;
  onClose: () => void;
}

const KG_TO_LBS = 2.20462;

function fmtDate(d: string) {
  const [, m, day] = d.split("-");
  return `${parseInt(m)}/${parseInt(day)}`;
}

export function ExerciseHistorySheet({ exercise, onClose }: Props) {
  const open = !!exercise;

  const { data: allAvgWeights = [] } = useGetAvgWeightByExercise({ query: { enabled: open } as any });
  const { data: allOneRm = [] } = useGetEstimatedOneRm({ query: { enabled: open } as any });
  const { data: prs = [] } = useGetPersonalRecords({ query: { enabled: open } as any });

  const chartData = useMemo(() => {
    if (!exercise) return [];
    const ex = exercise.toLowerCase();

    const avgByDate = new Map<string, number>();
    for (const r of allAvgWeights) {
      if (r.exercise.toLowerCase() === ex) {
        avgByDate.set(r.date, Math.round(r.avgWeightKg * KG_TO_LBS * 10) / 10);
      }
    }

    const oneRmByDate = new Map<string, number>();
    for (const r of allOneRm) {
      if (r.exercise.toLowerCase() === ex) {
        oneRmByDate.set(r.date, r.estimatedOneRmLbs);
      }
    }

    const dates = Array.from(new Set([...avgByDate.keys(), ...oneRmByDate.keys()])).sort();
    return dates.map((date) => ({
      date,
      label: fmtDate(date),
      avgLbs: avgByDate.get(date) ?? null,
      oneRmLbs: oneRmByDate.get(date) ?? null,
    }));
  }, [exercise, allAvgWeights, allOneRm]);

  const pr = useMemo(() => {
    if (!exercise) return null;
    const ex = exercise.toLowerCase();
    return prs.find((r) => r.exercise.toLowerCase() === ex) ?? null;
  }, [exercise, prs]);

  const latestOneRm = chartData.length > 0 ? chartData[chartData.length - 1].oneRmLbs : null;
  const firstOneRm = chartData.length > 1 ? chartData[0].oneRmLbs : null;
  const oneRmGain =
    latestOneRm && firstOneRm ? Math.round((latestOneRm - firstOneRm) * 10) / 10 : null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="bg-card border-border text-foreground h-[85vh] flex flex-col">
        <SheetHeader className="flex-shrink-0 pb-4 border-b border-border">
          <SheetTitle className="text-xl font-bold">{exercise}</SheetTitle>
          <div className="flex items-center gap-4 pt-1 flex-wrap">
            {pr && (
              <div className="flex items-center gap-1.5 text-sm">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <span className="text-muted-foreground">All-time PR:</span>
                <span className="font-semibold">{Math.round(pr.maxWeightKg * KG_TO_LBS * 10) / 10} lbs</span>
              </div>
            )}
            {latestOneRm && (
              <div className="flex items-center gap-1.5 text-sm">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Est. 1RM:</span>
                <span className="font-semibold">{latestOneRm} lbs</span>
              </div>
            )}
            {oneRmGain !== null && (
              <div className="flex items-center gap-1.5 text-sm">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-muted-foreground">1RM gain:</span>
                <span className={`font-semibold ${oneRmGain >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {oneRmGain >= 0 ? "+" : ""}{oneRmGain} lbs
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Sessions:</span>
              <span className="font-semibold">{chartData.length}</span>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pt-4">
          {chartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-10 text-sm">No data yet for this exercise.</p>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Avg Weight Over Time</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                      formatter={(v: number) => [`${v} lbs`, "Avg weight"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="avgLbs"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Estimated 1RM (Epley)</p>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                      formatter={(v: number) => [`${v} lbs`, "Est. 1RM"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="oneRmLbs"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
