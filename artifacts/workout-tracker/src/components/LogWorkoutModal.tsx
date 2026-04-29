import { useState, useMemo } from "react";
import { saveWorkoutToHealthKit } from "@/lib/healthkit";
import { Plus, Trash2, CheckCircle2, Loader2, RotateCcw, Trophy, BookmarkPlus, ChevronDown, BarChart2, Dumbbell, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useLogWorkout,
  useLogCardio,
  useGetExerciseList,
  useGetLastSession,
  useGetPersonalRecords,
  useGetEstimatedOneRm,
  useGetWorkoutTemplates,
  useGetWorkoutTemplate,
  useCreateWorkoutTemplate,
  useDeleteWorkoutTemplate,
  useGetWorkoutSuggestions,
  useGetCardioTemplates,
  useCreateCardioTemplate,
  useDeleteCardioTemplate,
} from "@workspace/api-client-react";
import type { CardioExerciseType, CardioTemplateItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ExerciseHistorySheet } from "./ExerciseHistorySheet";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ExerciseRow = {
  id: number;
  exercise: string;
  weightLbs: string;
  reps: string;
  sets: string;
};

function mkRow(): ExerciseRow {
  return { id: Date.now() + Math.random(), exercise: "", weightLbs: "", reps: "", sets: "3" };
}

function isRowValid(r: ExerciseRow): boolean {
  return (
    r.exercise.trim().length > 0 &&
    parseFloat(r.weightLbs) > 0 &&
    parseInt(r.reps, 10) > 0 &&
    parseInt(r.sets, 10) > 0
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialStrengthTemplateId?: number | null;
  initialCardioTemplate?: CardioTemplateItem | null;
}

const CARDIO_TYPES: { value: CardioExerciseType; label: string }[] = [
  { value: "treadmill", label: "Treadmill" },
  { value: "outdoor_run", label: "Outdoor Run" },
  { value: "bike", label: "Bike" },
  { value: "elliptical", label: "Elliptical" },
];

export function LogWorkoutModal({ open, onClose, initialStrengthTemplateId, initialCardioTemplate }: Props) {
  const [mode, setMode] = useState<"strength" | "cardio">("strength");
  const [date, setDate] = useState(todayIso);
  const [rows, setRows] = useState<ExerciseRow[]>([mkRow()]);
  const [notes, setNotes] = useState("");
  const [bodyWeightLbs, setBodyWeightLbs] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [savedCalories, setSavedCalories] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [expandedTemplateId, setExpandedTemplateId] = useState<number | null>(null);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [historyExercise, setHistoryExercise] = useState<string | null>(null);
  // Cardio state
  const [cardioType, setCardioType] = useState<CardioExerciseType>("treadmill");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioIncline, setCardioIncline] = useState("");
  const [savingCardioTemplate, setSavingCardioTemplate] = useState(false);
  const [cardioTemplateName, setCardioTemplateName] = useState("");

  const queryClient = useQueryClient();
  const { data: exerciseList = [] } = useGetExerciseList();
  const { data: lastSession } = useGetLastSession({ query: { enabled: open } });
  const { data: personalRecords = [] } = useGetPersonalRecords({ query: { enabled: open } });
  const { data: estimatedOneRm = [] } = useGetEstimatedOneRm({ query: { enabled: open } });
  const { data: templates = [] } = useGetWorkoutTemplates({ query: { enabled: open } });
  const { data: selectedTemplate } = useGetWorkoutTemplate(selectedTemplateId ?? 0, {
    query: { enabled: !!selectedTemplateId },
  });
  const { data: suggestions = [] } = useGetWorkoutSuggestions({ query: { enabled: open } });
  const mutation = useLogWorkout();
  const cardioMutation = useLogCardio();
  const createTemplateMutation = useCreateWorkoutTemplate();
  const deleteTemplateMutation = useDeleteWorkoutTemplate();
  const { data: cardioTemplates = [] } = useGetCardioTemplates({ query: { enabled: open && mode === "cardio" } });
  const createCardioTemplateMutation = useCreateCardioTemplate();
  const deleteCardioTemplateMutation = useDeleteCardioTemplate();

  const prMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of personalRecords) {
      map.set(r.exercise.toLowerCase(), r.maxWeightKg * 2.20462);
    }
    return map;
  }, [personalRecords]);

  const lastSessionMap = useMemo(() => {
    const map = new Map<string, { weightLbs: number; reps: number; sets: number }>();
    if (lastSession) {
      for (const ex of lastSession.exercises) {
        map.set(ex.exercise.toLowerCase(), { weightLbs: ex.weightLbs, reps: ex.reps, sets: ex.sets });
      }
    }
    return map;
  }, [lastSession]);

  const currentOneRmPrMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of estimatedOneRm) {
      const ex = r.exercise.toLowerCase();
      const existing = map.get(ex) ?? 0;
      if (r.estimatedOneRmLbs > existing) map.set(ex, r.estimatedOneRmLbs);
    }
    return map;
  }, [estimatedOneRm]);

  const suggestionMap = useMemo(() => {
    const map = new Map<string, { suggestedWeightLbs: number; currentWeightLbs: number; reason: string }>();
    for (const s of suggestions) {
      map.set(s.exercise.toLowerCase(), { suggestedWeightLbs: s.suggestedWeightLbs, currentWeightLbs: s.currentWeightLbs, reason: s.reason });
    }
    return map;
  }, [suggestions]);

  const addRow = () => setRows((r) => [...r, mkRow()]);
  const removeRow = (id: number) =>
    setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== id) : r));
  const updateRow = (id: number, key: keyof ExerciseRow, value: string) =>
    setRows((r) => r.map((x) => {
      if (x.id !== id) return x;
      const updated = { ...x, [key]: value };
      // Auto-fill weight from suggestion when exercise is set and weight is empty
      if (key === "exercise" && !x.weightLbs) {
        const suggestion = suggestionMap.get(value.toLowerCase().trim());
        if (suggestion) {
          updated.weightLbs = String(suggestion.suggestedWeightLbs);
        }
      }
      return updated;
    }));

  const validRows = rows.filter(isRowValid);
  const canSave = validRows.length > 0 && !mutation.isPending;

  const handleSave = () => {
    if (!canSave) return;
    setErrorMsg(null);

    mutation.mutate(
      {
        data: {
          date,
          exercises: validRows.map((r) => ({
            exercise: r.exercise.trim(),
            weightLbs: parseFloat(r.weightLbs),
            reps: parseInt(r.reps, 10),
            sets: parseInt(r.sets, 10),
          })),
          notes: notes.trim() || null,
          bodyWeightLbs: bodyWeightLbs ? parseFloat(bodyWeightLbs) : null,
          durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
        },
      },
      {
        onSuccess: (result) => {
          setSavedCount(result.inserted);
          setSavedCalories(result.caloriesBurned ?? null);
          // Sync to Apple Health if calories available
          if (result.caloriesBurned && durationMinutes) {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - parseInt(durationMinutes, 10) * 60 * 1000);
            saveWorkoutToHealthKit({
              startDate: startTime,
              endDate: endTime,
              calories: result.caloriesBurned,
            }).catch(console.error);
          }
          queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === "string" &&
              String(q.queryKey[0]).startsWith("/api/workouts"),
          });
          if (result.bodyWeightLogged) {
            queryClient.invalidateQueries({
              predicate: (q) =>
                typeof q.queryKey[0] === "string" &&
                String(q.queryKey[0]).startsWith("/api/body-metrics"),
            });
          }
        },
        onError: (err: unknown) => {
          const msg =
            err instanceof Error ? err.message : "Something went wrong. Please try again.";
          setErrorMsg(msg);
        },
      },
    );
  };

  const handleSaveTemplate = () => {
    const name = templateName.trim();
    if (!name || validRows.length === 0) return;
    createTemplateMutation.mutate(
      {
        data: {
          name,
          exercises: validRows.map((r, idx) => ({
            exercise: r.exercise.trim(),
            weightLbs: parseFloat(r.weightLbs),
            reps: parseInt(r.reps, 10),
            sets: parseInt(r.sets, 10),
            order: idx,
          })),
        },
      },
      {
        onSuccess: () => {
          setSavingTemplate(false);
          setTemplateName("");
          queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === "string" &&
              String(q.queryKey[0]).startsWith("/api/workouts/templates"),
          });
        },
      },
    );
  };

  const handleLoadTemplate = (id: number) => {
    setSelectedTemplateId(id);
    setExpandedTemplateId(null);
  };

  const handleCardioSave = () => {
    if (!cardioDuration || cardioMutation.isPending) return;
    setErrorMsg(null);
    cardioMutation.mutate(
      {
        data: {
          date,
          exerciseType: cardioType,
          durationMinutes: parseInt(cardioDuration, 10),
          distanceMiles: cardioDistance ? parseFloat(cardioDistance) : null,
          inclinePercent: cardioIncline ? parseFloat(cardioIncline) : null,
          bodyWeightLbs: bodyWeightLbs ? parseFloat(bodyWeightLbs) : null,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: (result) => {
          setSavedCalories(result.caloriesBurned ?? null);
          setSavedCount(0); // reuse success screen
          if (result.caloriesBurned && cardioDuration) {
            const endTime = new Date();
            const startTime = new Date(endTime.getTime() - parseInt(cardioDuration, 10) * 60 * 1000);
            saveWorkoutToHealthKit({
              startDate: startTime,
              endDate: endTime,
              calories: result.caloriesBurned,
              activityType: cardioType,
            }).catch(console.error);
          }
          queryClient.invalidateQueries({
            predicate: (q) => typeof q.queryKey[0] === "string" && String(q.queryKey[0]).startsWith("/api/workouts"),
          });
        },
        onError: (err: unknown) => {
          setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
        },
      },
    );
  };

  const handleClose = () => {
    setMode("strength");
    setDate(todayIso());
    setRows([mkRow()]);
    setNotes("");
    setBodyWeightLbs("");
    setDurationMinutes("");
    setSavedCount(null);
    setSavedCalories(null);
    setErrorMsg(null);
    setSavingTemplate(false);
    setTemplateName("");
    setSelectedTemplateId(null);
    setExpandedTemplateId(null);
    setTemplateDropdownOpen(false);
    setHistoryExercise(null);
    setCardioType("treadmill");
    setCardioDuration("");
    setCardioDistance("");
    setCardioIncline("");
    setSavingCardioTemplate(false);
    setCardioTemplateName("");
    mutation.reset();
    cardioMutation.reset();
    onClose();
  };

  // When template data loads, fill rows
  if (selectedTemplate && selectedTemplateId) {
    const templateRows = selectedTemplate.exercises.map((ex) => ({
      id: Date.now() + Math.random(),
      exercise: ex.exercise,
      weightLbs: String(ex.weightLbs),
      reps: String(ex.reps),
      sets: String(ex.sets),
    }));
    if (templateRows.length > 0 && rows.length === 1 && !rows[0].exercise) {
      setRows(templateRows);
      setSelectedTemplateId(null);
    }
  }

  // Apply initial template passed from Templates modal
  if (initialStrengthTemplateId && !selectedTemplateId && rows.length === 1 && !rows[0].exercise) {
    setSelectedTemplateId(initialStrengthTemplateId);
  }
  if (initialCardioTemplate && mode === "strength" && rows.length === 1 && !rows[0].exercise) {
    setMode("cardio");
    setCardioType(initialCardioTemplate.exerciseType as CardioExerciseType);
    setCardioDuration(String(initialCardioTemplate.durationMinutes));
    setCardioDistance(initialCardioTemplate.distanceMiles != null ? String(initialCardioTemplate.distanceMiles) : "");
    setCardioIncline(initialCardioTemplate.inclinePercent != null ? String(initialCardioTemplate.inclinePercent) : "");
  }

  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold">Log Workout</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Record a training session directly — no CSV needed.
          </DialogDescription>
        </DialogHeader>

        {savedCount !== null ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle2 className="w-12 h-12 text-primary" />
            <div>
              <p className="text-lg font-semibold">Session saved!</p>
              <p className="text-muted-foreground text-sm mt-1">
                {savedCount > 0
                  ? `${savedCount} set${savedCount !== 1 ? "s" : ""} logged for ${date}. Charts updated.`
                  : `Cardio session logged for ${date}.`}
              </p>
              {savedCalories !== null && (
                <p className="text-orange-400 text-sm mt-2 font-medium">
                  🔥 ~{savedCalories} calories burned
                </p>
              )}
            </div>
            <Button onClick={handleClose} className="mt-2 bg-primary hover:bg-primary/90 text-primary-foreground">
              Done
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
            <div className="space-y-1.5">
              <Label htmlFor="workout-date" className="text-sm font-medium">Date</Label>
              <Input
                id="workout-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-background border-border text-foreground [color-scheme:dark]"
              />
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                type="button"
                onClick={() => setMode("strength")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${mode === "strength" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                <Dumbbell className="w-4 h-4" /> Strength
              </button>
              <button
                type="button"
                onClick={() => setMode("cardio")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium transition-colors ${mode === "cardio" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              >
                <Heart className="w-4 h-4" /> Cardio
              </button>
            </div>

            {mode === "cardio" && (
              <div className="space-y-3">
                {cardioTemplates.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Load template</Label>
                    <div className="flex flex-wrap gap-2">
                      {cardioTemplates.map((t) => (
                        <div key={t.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setCardioType(t.exerciseType as CardioExerciseType);
                              setCardioDuration(String(t.durationMinutes));
                              setCardioDistance(t.distanceMiles != null ? String(t.distanceMiles) : "");
                              setCardioIncline(t.inclinePercent != null ? String(t.inclinePercent) : "");
                            }}
                            className="text-xs px-2 py-1 rounded border border-border hover:border-primary hover:text-primary transition-colors"
                          >
                            {t.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCardioTemplateMutation.mutate({ id: t.id }, { onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("cardio-templates") }) })}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {CARDIO_TYPES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setCardioType(t.value)}
                        className={`py-2 px-3 rounded-md text-sm font-medium border transition-colors ${cardioType === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Duration (min)</Label>
                    <Input
                      type="number" min="1" step="1"
                      value={cardioDuration}
                      onChange={(e) => setCardioDuration(e.target.value)}
                      placeholder="30"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Distance (mi) <span className="text-muted-foreground font-normal">optional</span></Label>
                    <Input
                      type="number" min="0" step="0.1"
                      value={cardioDistance}
                      onChange={(e) => setCardioDistance(e.target.value)}
                      placeholder="2.5"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                  {cardioType === "treadmill" && (
                    <div className="space-y-1.5">
                      <Label className="text-sm font-medium">Incline (%) <span className="text-muted-foreground font-normal">optional</span></Label>
                      <Input
                        type="number" min="0" max="30" step="0.5"
                        value={cardioIncline}
                        onChange={(e) => setCardioIncline(e.target.value)}
                        placeholder="2.0"
                        className="bg-background border-border text-foreground"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Body weight (lbs) <span className="text-muted-foreground font-normal">optional</span></Label>
                    <Input
                      type="number" min="0" step="0.1"
                      value={bodyWeightLbs}
                      onChange={(e) => setBodyWeightLbs(e.target.value)}
                      placeholder="175"
                      className="bg-background border-border text-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">optional</span></Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="How did it feel?"
                    rows={2}
                    className="bg-background border-border text-foreground resize-none text-sm"
                  />
                </div>
                {cardioDuration && !savingCardioTemplate && (
                  <button
                    type="button"
                    onClick={() => setSavingCardioTemplate(true)}
                    className="w-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary text-xs py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" /> Save as template
                  </button>
                )}
                {savingCardioTemplate && (
                  <div className="flex gap-2">
                    <Input
                      value={cardioTemplateName}
                      onChange={(e) => setCardioTemplateName(e.target.value)}
                      placeholder="Template name (e.g. Morning Run)"
                      className="bg-background border-border text-foreground text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setSavingCardioTemplate(false); setCardioTemplateName(""); }
                        if (e.key === "Enter" && cardioTemplateName.trim()) {
                          createCardioTemplateMutation.mutate(
                            { data: { name: cardioTemplateName.trim(), exerciseType: cardioType, durationMinutes: parseInt(cardioDuration, 10), distanceMiles: cardioDistance ? parseFloat(cardioDistance) : null, inclinePercent: cardioIncline ? parseFloat(cardioIncline) : null } },
                            { onSuccess: () => { setSavingCardioTemplate(false); setCardioTemplateName(""); queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("cardio-templates") }); } }
                          );
                        }
                      }}
                    />
                    <Button size="sm" onClick={() => {
                      if (!cardioTemplateName.trim()) return;
                      createCardioTemplateMutation.mutate(
                        { data: { name: cardioTemplateName.trim(), exerciseType: cardioType, durationMinutes: parseInt(cardioDuration, 10), distanceMiles: cardioDistance ? parseFloat(cardioDistance) : null, inclinePercent: cardioIncline ? parseFloat(cardioIncline) : null } },
                        { onSuccess: () => { setSavingCardioTemplate(false); setCardioTemplateName(""); queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("cardio-templates") }); } }
                      );
                    }} disabled={!cardioTemplateName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setSavingCardioTemplate(false); setCardioTemplateName(""); }} className="shrink-0">Cancel</Button>
                  </div>
                )}
                {errorMsg && (
                  <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{errorMsg}</p>
                )}
                <div className="flex gap-3 pt-1">
                  <Button variant="outline" className="flex-1 border-border" onClick={handleClose} disabled={cardioMutation.isPending}>Cancel</Button>
                  <Button
                    className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                    onClick={handleCardioSave}
                    disabled={!cardioDuration || cardioMutation.isPending}
                  >
                    {cardioMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Session"}
                  </Button>
                </div>
              </div>
            )}

            {mode === "strength" && <><div className="space-y-2">
              {lastSession && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRows(
                      lastSession.exercises.map((ex) => ({
                        id: Date.now() + Math.random(),
                        exercise: ex.exercise,
                        weightLbs: String(ex.weightLbs),
                        reps: String(ex.reps),
                        sets: String(ex.sets),
                      })),
                    )
                  }
                  className="w-full border-dashed border-primary/50 text-primary hover:bg-primary/10 gap-2 text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Repeat last session ({lastSession.date})
                </Button>
              )}

              {templates.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved templates</p>
                  <div className="flex flex-col gap-2">
                    {templates.map((t) => {
                      const isExpanded = expandedTemplateId === t.id;
                      return (
                        <div key={t.id} className="rounded-lg border border-border bg-background/50 overflow-hidden">
                          <div className="flex items-center gap-2 px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                const newExpanded = isExpanded ? null : t.id;
                                setExpandedTemplateId(newExpanded);
                                if (newExpanded) setSelectedTemplateId(t.id);
                              }}
                              className="flex-1 text-left flex items-center gap-2 min-w-0"
                            >
                              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              <span className="text-sm font-medium truncate">{t.name}</span>
                            </button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleLoadTemplate(t.id)}
                              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 shrink-0"
                            >
                              Use
                            </Button>
                            <button
                              type="button"
                              onClick={() => deleteTemplateMutation.mutate({ id: t.id }, {
                                onSuccess: () => {
                                  if (expandedTemplateId === t.id) setExpandedTemplateId(null);
                                  queryClient.invalidateQueries({
                                    predicate: (q) => String(q.queryKey[0]).includes("/api/workouts/templates"),
                                  });
                                },
                              })}
                              className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1"
                              aria-label="Delete template"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {isExpanded && selectedTemplate && selectedTemplate.id === t.id && (
                            <div className="border-t border-border px-3 py-2 space-y-1">
                              {selectedTemplate.exercises.map((ex) => (
                                <div key={ex.id} className="flex justify-between text-xs text-muted-foreground">
                                  <span>{ex.exercise}</span>
                                  <span>{ex.sets} × {ex.reps} @ {ex.weightLbs} lbs</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_80px_56px_56px_52px] gap-2 text-xs font-medium text-muted-foreground px-0.5">
                <span>Exercise</span>
                <span>Weight (lbs)</span>
                <span>Reps</span>
                <span>Sets</span>
                <span />
              </div>

              {rows.map((row) => {
                const exKey = row.exercise.toLowerCase().trim();
                const prLbs = prMap.get(exKey);
                const enteredWeight = parseFloat(row.weightLbs);
                const enteredReps = parseInt(row.reps, 10);
                const isWeightPr = prLbs !== undefined && enteredWeight > prLbs && !isNaN(enteredWeight);
                const estimatedOneRmNow = !isNaN(enteredWeight) && !isNaN(enteredReps) && enteredWeight > 0 && enteredReps > 0
                  ? Math.round(enteredWeight * (1 + enteredReps / 30) * 10) / 10
                  : null;
                const currentOneRmPr = currentOneRmPrMap.get(exKey);
                const isOneRmPr = estimatedOneRmNow !== null && currentOneRmPr !== undefined && estimatedOneRmNow > currentOneRmPr;
                const lastEx = lastSessionMap.get(exKey);
                const weightDelta = lastEx && !isNaN(enteredWeight) && enteredWeight > 0
                  ? Math.round((enteredWeight - lastEx.weightLbs) * 10) / 10
                  : null;
                const suggestion = exKey.length > 0 ? suggestionMap.get(exKey) : undefined;

                return (
                  <div key={row.id} className="space-y-1">
                    <div className="grid grid-cols-[1fr_80px_56px_56px_52px] gap-2 items-center">
                      <div>
                        <input
                          list="exercise-list"
                          value={row.exercise}
                          onChange={(e) => updateRow(row.id, "exercise", e.target.value)}
                          placeholder="e.g. Bench Press"
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <datalist id="exercise-list">
                          {exerciseList.map((ex) => (
                            <option key={ex} value={ex} />
                          ))}
                        </datalist>
                      </div>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          step="0.5"
                          value={row.weightLbs}
                          onChange={(e) => updateRow(row.id, "weightLbs", e.target.value)}
                          placeholder="135"
                          className={`bg-background border-border text-foreground ${isWeightPr ? "border-yellow-500/70 pr-6" : ""}`}
                        />
                        {isWeightPr && (
                          <Trophy className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-yellow-500" />
                        )}
                      </div>
                      <Input
                        type="number"
                        min="1"
                        value={row.reps}
                        onChange={(e) => updateRow(row.id, "reps", e.target.value)}
                        placeholder="10"
                        className="bg-background border-border text-foreground"
                      />
                      <Input
                        type="number"
                        min="1"
                        value={row.sets}
                        onChange={(e) => updateRow(row.id, "sets", e.target.value)}
                        placeholder="3"
                        className="bg-background border-border text-foreground"
                      />
                      <div className="flex gap-1 justify-end">
                        {exKey.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setHistoryExercise(row.exercise.trim())}
                            className="text-muted-foreground hover:text-primary transition-colors"
                            aria-label="View exercise history"
                          >
                            <BarChart2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                          aria-label="Remove exercise"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {(lastEx || isOneRmPr) && (
                      <div className="flex items-center gap-3 px-1 text-xs">
                        {lastEx && (
                          <span className="text-muted-foreground">
                            Last: {lastEx.weightLbs} lbs × {lastEx.reps}
                            {weightDelta !== null && weightDelta !== 0 && (
                              <span className={`ml-1 font-semibold ${weightDelta > 0 ? "text-green-500" : "text-red-400"}`}>
                                ({weightDelta > 0 ? "+" : ""}{weightDelta} lbs)
                              </span>
                            )}
                          </span>
                        )}
                        {isOneRmPr && (
                          <span className="text-yellow-500 font-semibold flex items-center gap-1">
                            <Trophy className="w-3 h-3" />
                            New est. 1RM: {estimatedOneRmNow} lbs
                          </span>
                        )}
                      </div>
                    )}
                    {suggestion && (
                      <div className="px-1 text-xs">
                        {suggestion.reason === "Ready to increase" && (
                          <span className="inline-flex items-center gap-1 text-green-500 font-medium">
                            💡 +{Math.round((suggestion.suggestedWeightLbs - suggestion.currentWeightLbs) * 10) / 10} lbs suggested
                          </span>
                        )}
                        {suggestion.reason === "Too heavy" && (
                          <span className="inline-flex items-center gap-1 text-yellow-500 font-medium">
                            ⬇ -{Math.round((suggestion.currentWeightLbs - suggestion.suggestedWeightLbs) * 10) / 10} lbs suggested
                          </span>
                        )}
                        {suggestion.reason === "Keep going" && (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            ✓ Hold — keep current weight
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRow}
                className="w-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary mt-1"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add exercise
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Body weight (lbs) <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input
                  type="number"
                  min="0"
                  step="0.1"
                  value={bodyWeightLbs}
                  onChange={(e) => setBodyWeightLbs(e.target.value)}
                  placeholder="175"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Duration (min) <span className="text-muted-foreground font-normal">optional</span></Label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  placeholder="45"
                  className="bg-background border-border text-foreground"
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">optional</span></Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How did it feel? Any PRs or injuries?"
                  rows={2}
                  className="bg-background border-border text-foreground resize-none text-sm"
                />
              </div>
            </div>

            {validRows.length > 0 && !savingTemplate && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSavingTemplate(true)}
                className="w-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary text-xs"
              >
                <BookmarkPlus className="w-3.5 h-3.5 mr-1.5" />
                Save as template
              </Button>
            )}

            {savingTemplate && (
              <div className="flex gap-2">
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Template name (e.g. Push Day A)"
                  className="bg-background border-border text-foreground text-sm"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); if (e.key === "Escape") { setSavingTemplate(false); setTemplateName(""); } }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleSaveTemplate}
                  disabled={!templateName.trim() || createTemplateMutation.isPending}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0"
                >
                  {createTemplateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSavingTemplate(false); setTemplateName(""); }} className="shrink-0">
                  Cancel
                </Button>
              </div>
            )}

            {errorMsg && (
              <p className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1 border-border text-foreground hover:bg-muted"
                onClick={handleClose}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                onClick={handleSave}
                disabled={!canSave}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save Session"
                )}
              </Button>
            </div>
            </>}
          </div>
        )}
      </DialogContent>
    </Dialog>

    <ExerciseHistorySheet
      exercise={historyExercise}
      onClose={() => setHistoryExercise(null)}
    />
    </>
  );
}
