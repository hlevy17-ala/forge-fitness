import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetBodyMetrics } from "@workspace/api-client-react";

function shortDate(dateStr: string) {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}/${d}`;
}

export function BodyCompositionWidget() {
  const { data, isLoading } = useGetBodyMetrics();

  const chartData = useMemo(() => {
    return (data ?? [])
      .filter(r => r.weightLbs != null || r.waistInches != null)
      .map(r => ({
        date: shortDate(r.date),
        weight: r.weightLbs != null ? Math.round(r.weightLbs * 10) / 10 : null,
        waist: r.waistInches != null ? Math.round(r.waistInches * 10) / 10 : null,
      }));
  }, [data]);

  const hasWeight = chartData.some(d => d.weight != null);
  const hasWaist = chartData.some(d => d.waist != null);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Body Composition</CardTitle>
        <p className="text-xs text-muted-foreground">Weight (lbs) and waist (in) over time</p>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="h-48 bg-muted/40 rounded-lg animate-pulse" />
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No body metrics logged yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              {hasWeight && (
                <YAxis yAxisId="weight" orientation="left" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              )}
              {hasWaist && (
                <YAxis yAxisId="waist" orientation="right" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} />
              )}
              <Tooltip
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: "bold" }}
              />
              <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              {hasWeight && (
                <Line yAxisId="weight" type="monotone" dataKey="weight" name="Weight (lbs)" stroke="hsl(20 95% 58%)" strokeWidth={2} dot={false} connectNulls />
              )}
              {hasWaist && (
                <Line yAxisId="waist" type="monotone" dataKey="waist" name="Waist (in)" stroke="hsl(200 80% 55%)" strokeWidth={2} dot={false} connectNulls />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
