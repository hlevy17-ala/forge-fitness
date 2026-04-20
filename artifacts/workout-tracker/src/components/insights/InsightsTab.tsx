import { useEffect, useRef, useState } from "react";
import { Settings, ChevronDown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { WeeklySnapshotWidget } from "./WeeklySnapshotWidget";
import { MostImprovedWidget } from "./MostImprovedWidget";
import { ConsistencyHeatmapWidget } from "./ConsistencyHeatmapWidget";
import { VolumeByMuscleGroupWidget } from "./VolumeByMuscleGroupWidget";
import { BodyCompositionWidget } from "./BodyCompositionWidget";
import { CalorieAdherenceWidget } from "./CalorieAdherenceWidget";
import { PersonalRecordsTimelineWidget } from "./PersonalRecordsTimelineWidget";
import { WeeklyGoalWidget } from "./WeeklyGoalWidget";
import { StrengthStandardsWidget } from "./StrengthStandardsWidget";
import type { InsightsDateParams } from "@workspace/api-client-react";
import { getWidgetVisibility, getGetWidgetVisibilityUrl, getInsightsDateRange, setInsightsDateRange } from "@workspace/api-client-react";

type WidgetId =
  | "weeklyGoal"
  | "weeklySnapshot"
  | "mostImproved"
  | "strengthStandards"
  | "heatmap"
  | "volumeByMuscleGroup"
  | "bodyComposition"
  | "calorieAdherence"
  | "prTimeline";

const WIDGET_LABELS: Record<WidgetId, string> = {
  weeklyGoal: "Weekly Goal",
  weeklySnapshot: "Weekly Snapshot",
  mostImproved: "Most Improved Exercises",
  strengthStandards: "Strength Standards",
  heatmap: "Training Consistency",
  volumeByMuscleGroup: "Volume by Muscle Group",
  bodyComposition: "Body Composition",
  calorieAdherence: "Calorie Adherence",
  prTimeline: "Personal Records Timeline",
};

const WIDGET_ORDER: WidgetId[] = [
  "weeklyGoal",
  "weeklySnapshot",
  "mostImproved",
  "strengthStandards",
  "heatmap",
  "volumeByMuscleGroup",
  "bodyComposition",
  "calorieAdherence",
  "prTimeline",
];

const DEFAULT_STATE: Record<WidgetId, boolean> = {
  weeklyGoal: true,
  weeklySnapshot: true,
  mostImproved: true,
  strengthStandards: true,
  heatmap: true,
  volumeByMuscleGroup: true,
  bodyComposition: true,
  calorieAdherence: true,
  prTimeline: true,
};

type PresetId = "4w" | "3m" | "6m" | "1y" | "custom";

const STORAGE_KEY = "insights-widget-visibility";
const DATE_RANGE_STORAGE_KEY = "insights-date-range";

function loadVisibility(): Record<WidgetId, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...DEFAULT_STATE, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_STATE;
}

interface StoredDateRange {
  preset: PresetId | null;
  customStart: string;
  customEnd: string;
}

const VALID_PRESETS: PresetId[] = ["4w", "3m", "6m", "1y", "custom"];

function loadDateRange(): StoredDateRange {
  try {
    const stored = localStorage.getItem(DATE_RANGE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as StoredDateRange;
      const validPreset = parsed.preset && VALID_PRESETS.includes(parsed.preset) ? parsed.preset : null;
      return {
        preset: validPreset,
        customStart: typeof parsed.customStart === "string" ? parsed.customStart : "",
        customEnd: typeof parsed.customEnd === "string" ? parsed.customEnd : "",
      };
    }
  } catch {}
  return { preset: null, customStart: "", customEnd: "" };
}

interface DatePreset {
  id: PresetId;
  label: string;
}

const DATE_PRESETS: DatePreset[] = [
  { id: "4w", label: "Last 4 weeks" },
  { id: "3m", label: "Last 3 months" },
  { id: "6m", label: "Last 6 months" },
  { id: "1y", label: "Last year" },
  { id: "custom", label: "Custom range" },
];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getPresetDates(preset: PresetId): InsightsDateParams | undefined {
  if (preset === "custom") return undefined;
  const today = new Date();
  const endDate = toDateStr(today);
  const start = new Date(today);
  if (preset === "4w") start.setDate(today.getDate() - 28);
  else if (preset === "3m") start.setMonth(today.getMonth() - 3);
  else if (preset === "6m") start.setMonth(today.getMonth() - 6);
  else if (preset === "1y") start.setFullYear(today.getFullYear() - 1);
  return { startDate: toDateStr(start), endDate };
}

function getPresetLabel(preset: PresetId, customStart: string, customEnd: string): string {
  if (preset === "custom" && customStart && customEnd) {
    return `${customStart} – ${customEnd}`;
  }
  return DATE_PRESETS.find(p => p.id === preset)?.label ?? "All time";
}

function saveDateRange(preset: PresetId | null, customStart: string, customEnd: string) {
  try {
    localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify({ preset, customStart, customEnd }));
  } catch {}
  setInsightsDateRange({ preset, customStart, customEnd }).catch(() => {});
}

async function saveVisibilityToServer(visibility: Record<WidgetId, boolean>) {
  try {
    await fetch(getGetWidgetVisibilityUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(visibility),
    });
  } catch {}
}

export function InsightsTab() {
  const [visibility, setVisibility] = useState<Record<WidgetId, boolean>>(loadVisibility);
  const [selectedPreset, setSelectedPreset] = useState<PresetId | null>(() => loadDateRange().preset);
  const [customStart, setCustomStart] = useState(() => loadDateRange().customStart);
  const [customEnd, setCustomEnd] = useState(() => loadDateRange().customEnd);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const serverLoaded = useRef(false);
  const dirtyAfterMount = useRef(false);
  const dateRangeServerLoaded = useRef(false);
  const dateRangeDirtyAfterMount = useRef(false);

  useEffect(() => {
    if (serverLoaded.current) return;
    getWidgetVisibility().then((serverData) => {
      serverLoaded.current = true;
      if (!serverData || dirtyAfterMount.current) return;
      const merged = { ...DEFAULT_STATE, ...serverData } as Record<WidgetId, boolean>;
      setVisibility(merged);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
    }).catch(() => {
      serverLoaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (dateRangeServerLoaded.current) return;
    getInsightsDateRange().then((serverData) => {
      dateRangeServerLoaded.current = true;
      if (!serverData || dateRangeDirtyAfterMount.current) return;
      const preset = serverData.preset && VALID_PRESETS.includes(serverData.preset) ? serverData.preset : null;
      const start = typeof serverData.customStart === "string" ? serverData.customStart : "";
      const end = typeof serverData.customEnd === "string" ? serverData.customEnd : "";
      setSelectedPreset(preset);
      setCustomStart(start);
      setCustomEnd(end);
      try { localStorage.setItem(DATE_RANGE_STORAGE_KEY, JSON.stringify({ preset, customStart: start, customEnd: end })); } catch {}
    }).catch(() => {
      dateRangeServerLoaded.current = true;
    });
  }, []);

  const toggle = (id: WidgetId) => {
    dirtyAfterMount.current = true;
    setVisibility((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      saveVisibilityToServer(next);
      return next;
    });
  };

  const on = (id: WidgetId) => visibility[id];
  const both = (a: WidgetId, b: WidgetId) => on(a) && on(b);
  const either = (a: WidgetId, b: WidgetId) => on(a) || on(b);

  const activeDateParams: InsightsDateParams | undefined = (() => {
    if (!selectedPreset) return undefined;
    if (selectedPreset === "custom") {
      if (customStart && customEnd) return { startDate: customStart, endDate: customEnd };
      return undefined;
    }
    return getPresetDates(selectedPreset);
  })();

  const dateLabel = selectedPreset
    ? getPresetLabel(selectedPreset, customStart, customEnd)
    : "All time";

  const handlePresetClick = (preset: PresetId) => {
    dateRangeDirtyAfterMount.current = true;
    setSelectedPreset(preset);
    saveDateRange(preset, customStart, customEnd);
    if (preset !== "custom") setDatePickerOpen(false);
  };

  const handleClearRange = () => {
    dateRangeDirtyAfterMount.current = true;
    setSelectedPreset(null);
    setCustomStart("");
    setCustomEnd("");
    saveDateRange(null, "", "");
    setDatePickerOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Insights</h2>
          <p className="text-muted-foreground text-sm mt-1">Your progress at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={selectedPreset ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <Calendar className="w-4 h-4" />
                {dateLabel}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <p className="text-sm font-semibold mb-3">Date range</p>
              <div className="space-y-1">
                <button
                  onClick={handleClearRange}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${!selectedPreset ? "bg-accent font-medium" : "hover:bg-accent/60"}`}
                >
                  All time
                </button>
                {DATE_PRESETS.filter(p => p.id !== "custom").map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.id)}
                    className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${selectedPreset === preset.id ? "bg-accent font-medium" : "hover:bg-accent/60"}`}
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  onClick={() => handlePresetClick("custom")}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${selectedPreset === "custom" ? "bg-accent font-medium" : "hover:bg-accent/60"}`}
                >
                  Custom range
                </button>
              </div>
              {selectedPreset === "custom" && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Start date</Label>
                    <Input
                      type="date"
                      value={customStart}
                      onChange={(e) => { dateRangeDirtyAfterMount.current = true; setCustomStart(e.target.value); saveDateRange("custom", e.target.value, customEnd); }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">End date</Label>
                    <Input
                      type="date"
                      value={customEnd}
                      onChange={(e) => { dateRangeDirtyAfterMount.current = true; setCustomEnd(e.target.value); saveDateRange("custom", customStart, e.target.value); }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-1"
                    disabled={!customStart || !customEnd}
                    onClick={() => {
                      if (customStart && customEnd) setDatePickerOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Customize
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <p className="text-sm font-semibold mb-4">Visible widgets</p>
              <div className="space-y-3">
                {WIDGET_ORDER.map((id) => (
                  <div key={id} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`w-${id}`} className="text-sm font-normal cursor-pointer leading-tight">
                      {WIDGET_LABELS[id]}
                    </Label>
                    <Switch id={`w-${id}`} checked={visibility[id]} onCheckedChange={() => toggle(id)} />
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {on("weeklyGoal") && <WeeklyGoalWidget />}

      {on("weeklySnapshot") && <WeeklySnapshotWidget />}

      {on("strengthStandards") && <StrengthStandardsWidget />}

      {either("mostImproved", "volumeByMuscleGroup") && (
        <div className={`grid gap-6 ${both("mostImproved", "volumeByMuscleGroup") ? "md:grid-cols-2" : "grid-cols-1"}`}>
          {on("mostImproved") && <MostImprovedWidget dateParams={activeDateParams} />}
          {on("volumeByMuscleGroup") && <VolumeByMuscleGroupWidget dateParams={activeDateParams} />}
        </div>
      )}

      {on("heatmap") && <ConsistencyHeatmapWidget dateParams={activeDateParams} />}

      {either("bodyComposition", "calorieAdherence") && (
        <div className={`grid gap-6 ${both("bodyComposition", "calorieAdherence") ? "md:grid-cols-2" : "grid-cols-1"}`}>
          {on("bodyComposition") && <BodyCompositionWidget />}
          {on("calorieAdherence") && <CalorieAdherenceWidget />}
        </div>
      )}

      {on("prTimeline") && <PersonalRecordsTimelineWidget />}
    </div>
  );
}
