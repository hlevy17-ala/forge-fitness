import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGetWorkoutHeatmap, type InsightsDateParams } from "@workspace/api-client-react";

const KG_TO_LBS = 2.20462;
const DEFAULT_NUM_WEEKS = 16;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toLocalStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getMondayOf(date: Date): Date {
  const dayOfWeek = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - dayOfWeek);
  return monday;
}

function buildGrid(
  volumeMap: Map<string, number>,
  startDate?: string,
  endDate?: string,
) {
  const today = new Date();
  const todayStr = toLocalStr(today);

  let gridStart: Date;
  let numWeeks: number;

  if (startDate && endDate) {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    gridStart = getMondayOf(start);
    const endMonday = getMondayOf(end);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    numWeeks = Math.max(1, Math.round((endMonday.getTime() - gridStart.getTime()) / msPerWeek) + 1);
  } else {
    const monday = getMondayOf(today);
    gridStart = new Date(monday);
    gridStart.setDate(monday.getDate() - (DEFAULT_NUM_WEEKS - 1) * 7);
    numWeeks = DEFAULT_NUM_WEEKS;
  }

  const weeks: { date: string; volumeKg: number | null; isToday: boolean; isFuture: boolean }[][] = [];
  for (let w = 0; w < numWeeks; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      const dateStr = toLocalStr(date);
      week.push({
        date: dateStr,
        volumeKg: volumeMap.get(dateStr) ?? null,
        isToday: dateStr === todayStr,
        isFuture: dateStr > todayStr,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

function getMonthLabels(weeks: ReturnType<typeof buildGrid>) {
  const labels: { weekIdx: number; label: string }[] = [];
  let lastMonth = -1;
  let lastLabelWeek = -4;
  for (let w = 0; w < weeks.length; w++) {
    const [y, m] = weeks[w][0].date.split("-").map(Number);
    if (m !== lastMonth) {
      if (w - lastLabelWeek >= 3) {
        labels.push({ weekIdx: w, label: new Date(y, m - 1, 1).toLocaleString("default", { month: "short" }) });
        lastLabelWeek = w;
      }
      lastMonth = m;
    }
  }
  return labels;
}

function getCellStyle(volumeKg: number | null, maxVolume: number, isFuture: boolean) {
  if (isFuture) return { backgroundColor: "transparent", opacity: 0.2 };
  if (!volumeKg || volumeKg === 0) return {};
  const intensity = Math.min(volumeKg / (maxVolume || 1), 1);
  const lightness = Math.round(55 - intensity * 22);
  const saturation = Math.round(60 + intensity * 35);
  return { backgroundColor: `hsl(20 ${saturation}% ${lightness}%)` };
}

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });
}

interface ConsistencyHeatmapWidgetProps {
  dateParams?: InsightsDateParams;
}

export function ConsistencyHeatmapWidget({ dateParams }: ConsistencyHeatmapWidgetProps) {
  const { data, isLoading } = useGetWorkoutHeatmap(dateParams);

  const { weeks, maxVolume, monthLabels } = useMemo(() => {
    const volumeMap = new Map((data ?? []).map(d => [d.date, d.volumeKg]));
    const maxVolume = Math.max(...(data ?? []).map(d => d.volumeKg), 1);
    const weeks = buildGrid(volumeMap, dateParams?.startDate, dateParams?.endDate);
    const monthLabels = getMonthLabels(weeks);
    return { weeks, maxVolume, monthLabels };
  }, [data, dateParams]);

  const subtitle = dateParams?.startDate && dateParams?.endDate
    ? `${dateParams.startDate} – ${dateParams.endDate} · darker = higher volume`
    : "Last 16 weeks of activity — darker = higher volume";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Training Consistency</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-28 bg-muted/40 rounded-lg animate-pulse" />
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-flex flex-col gap-1 min-w-max">
              <div className="flex gap-1 pl-8">
                {weeks.map((week, w) => {
                  const label = monthLabels.find(l => l.weekIdx === w);
                  return (
                    <div key={w} className="w-3.5 text-[9px] text-muted-foreground">
                      {label?.label ?? ""}
                    </div>
                  );
                })}
              </div>
              {DAYS.map((day, d) => (
                <div key={day} className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground w-7 text-right pr-1">{d % 2 === 0 ? day : ""}</span>
                  {weeks.map((week, w) => {
                    const cell = week[d];
                    const style = getCellStyle(cell.volumeKg, maxVolume, cell.isFuture);
                    const hasData = cell.volumeKg != null && cell.volumeKg > 0;
                    return (
                      <Tooltip key={w}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-3.5 h-3.5 rounded-sm cursor-default transition-opacity ${cell.isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : ""} ${!hasData && !cell.isFuture ? "bg-muted/60" : ""}`}
                            style={style}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium">{formatDate(cell.date)}</p>
                          {cell.isFuture
                            ? <p className="text-muted-foreground">Future</p>
                            : hasData
                              ? <p>{Math.round((cell.volumeKg! * KG_TO_LBS)).toLocaleString()} lbs lifted</p>
                              : <p className="text-muted-foreground">Rest day</p>
                          }
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
