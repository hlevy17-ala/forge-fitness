import { useState } from "react";
import { Trash2, ChevronDown, Dumbbell, Heart, Plus, Loader2, X } from "lucide-react";
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
import {
  useGetWorkoutTemplates,
  useGetWorkoutTemplate,
  useDeleteWorkoutTemplate,
  useCreateWorkoutTemplate,
  useGetCardioTemplates,
  useDeleteCardioTemplate,
  useCreateCardioTemplate,
  useGetExerciseList,
} from "@workspace/api-client-react";
import type { CardioTemplateItem, CardioExerciseType } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
  onUseStrengthTemplate: (id: number) => void;
  onUseCardioTemplate: (template: CardioTemplateItem) => void;
}

function CARDIO_LABEL(type: string) {
  const map: Record<string, string> = {
    treadmill: "Treadmill",
    outdoor_run: "Outdoor Run",
    bike: "Bike",
    elliptical: "Elliptical",
  };
  return map[type] ?? type;
}

const CARDIO_TYPES: { value: CardioExerciseType; label: string }[] = [
  { value: "treadmill", label: "Treadmill" },
  { value: "outdoor_run", label: "Outdoor Run" },
  { value: "bike", label: "Bike" },
  { value: "elliptical", label: "Elliptical" },
];

type ExerciseRow = { id: number; exercise: string; weightLbs: string; reps: string; sets: string };
function mkRow(): ExerciseRow {
  return { id: Date.now() + Math.random(), exercise: "", weightLbs: "", reps: "", sets: "3" };
}

type CreatingMode = null | "strength" | "cardio";

export function TemplatesModal({ open, onClose, onUseStrengthTemplate, onUseCardioTemplate }: Props) {
  const [expandedStrength, setExpandedStrength] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [creating, setCreating] = useState<CreatingMode>(null);

  // Strength creation state
  const [newName, setNewName] = useState("");
  const [newRows, setNewRows] = useState<ExerciseRow[]>([mkRow()]);

  // Cardio creation state
  const [cardioName, setCardioName] = useState("");
  const [cardioType, setCardioType] = useState<CardioExerciseType>("treadmill");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioIncline, setCardioIncline] = useState("");

  const queryClient = useQueryClient();
  const { data: exerciseList = [] } = useGetExerciseList();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: strengthTemplates = [] } = useGetWorkoutTemplates({ query: { enabled: open } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: previewTemplate } = useGetWorkoutTemplate(previewId ?? 0, { query: { enabled: !!previewId } as any });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cardioTemplates = [] } = useGetCardioTemplates({ query: { enabled: open } as any });
  const deleteStrengthMutation = useDeleteWorkoutTemplate();
  const deleteCardioMutation = useDeleteCardioTemplate();
  const createStrengthMutation = useCreateWorkoutTemplate();
  const createCardioMutation = useCreateCardioTemplate();

  const invalidateStrength = () =>
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("/api/workouts/templates") });
  const invalidateCardio = () =>
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("cardio-templates") });

  const resetCreating = () => {
    setCreating(null);
    setNewName(""); setNewRows([mkRow()]);
    setCardioName(""); setCardioType("treadmill"); setCardioDuration(""); setCardioDistance(""); setCardioIncline("");
  };

  const validRows = newRows.filter(r =>
    r.exercise.trim() && parseFloat(r.weightLbs) > 0 && parseInt(r.reps) > 0 && parseInt(r.sets) > 0
  );

  const handleSaveStrength = () => {
    if (!newName.trim() || validRows.length === 0) return;
    createStrengthMutation.mutate(
      { data: { name: newName.trim(), exercises: validRows.map((r, i) => ({ exercise: r.exercise.trim(), weightLbs: parseFloat(r.weightLbs), reps: parseInt(r.reps), sets: parseInt(r.sets), order: i })) } },
      { onSuccess: () => { resetCreating(); invalidateStrength(); } }
    );
  };

  const handleSaveCardio = () => {
    if (!cardioName.trim() || !cardioDuration) return;
    createCardioMutation.mutate(
      { data: { name: cardioName.trim(), exerciseType: cardioType, durationMinutes: parseInt(cardioDuration), distanceMiles: cardioDistance ? parseFloat(cardioDistance) : null, inclinePercent: cardioIncline ? parseFloat(cardioIncline) : null } },
      { onSuccess: () => { resetCreating(); invalidateCardio(); } }
    );
  };

  const hasAny = strengthTemplates.length > 0 || cardioTemplates.length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetCreating(); onClose(); } }}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold">Workout Templates</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Build and start saved workouts in one tap.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 min-h-0">

          {/* ── Create new template form ── */}
          {creating === null && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCreating("strength")}
                className="flex-1 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Dumbbell className="w-4 h-4" /> New Strength Template
              </button>
              <button
                type="button"
                onClick={() => setCreating("cardio")}
                className="flex-1 border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary text-sm py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" /> New Cardio Template
              </button>
            </div>
          )}

          {creating === "strength" && (
            <div className="rounded-lg border border-primary/40 bg-background/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Strength Template</p>
                <button type="button" onClick={resetCreating} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Template name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Push Day A" className="bg-background border-border text-foreground text-sm" autoFocus />
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_72px_48px_48px_32px] gap-1.5 text-xs font-medium text-muted-foreground px-0.5">
                  <span>Exercise</span><span>Weight</span><span>Reps</span><span>Sets</span><span />
                </div>
                {newRows.map((row) => (
                  <div key={row.id} className="grid grid-cols-[1fr_72px_48px_48px_32px] gap-1.5 items-center">
                    <div>
                      <input
                        list="tpl-exercise-list"
                        value={row.exercise}
                        onChange={e => setNewRows(r => r.map(x => x.id === row.id ? { ...x, exercise: e.target.value } : x))}
                        placeholder="Exercise"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <datalist id="tpl-exercise-list">
                        {exerciseList.map(ex => <option key={ex} value={ex} />)}
                      </datalist>
                    </div>
                    <Input type="number" min="0" step="0.5" value={row.weightLbs} onChange={e => setNewRows(r => r.map(x => x.id === row.id ? { ...x, weightLbs: e.target.value } : x))} placeholder="135" className="bg-background border-border text-foreground text-sm px-2" />
                    <Input type="number" min="1" value={row.reps} onChange={e => setNewRows(r => r.map(x => x.id === row.id ? { ...x, reps: e.target.value } : x))} placeholder="10" className="bg-background border-border text-foreground text-sm px-2" />
                    <Input type="number" min="1" value={row.sets} onChange={e => setNewRows(r => r.map(x => x.id === row.id ? { ...x, sets: e.target.value } : x))} placeholder="3" className="bg-background border-border text-foreground text-sm px-2" />
                    <button type="button" onClick={() => setNewRows(r => r.length > 1 ? r.filter(x => x.id !== row.id) : r)} className="text-muted-foreground hover:text-destructive transition-colors flex justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => setNewRows(r => [...r, mkRow()])} className="w-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary text-xs py-1.5 rounded-md transition-colors flex items-center justify-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add exercise
                </button>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 border-border" onClick={resetCreating}>Cancel</Button>
                <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSaveStrength} disabled={!newName.trim() || validRows.length === 0 || createStrengthMutation.isPending}>
                  {createStrengthMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Template"}
                </Button>
              </div>
            </div>
          )}

          {creating === "cardio" && (
            <div className="rounded-lg border border-primary/40 bg-background/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">New Cardio Template</p>
                <button type="button" onClick={resetCreating} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Template name</Label>
                <Input value={cardioName} onChange={e => setCardioName(e.target.value)} placeholder="e.g. Morning Treadmill" className="bg-background border-border text-foreground text-sm" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CARDIO_TYPES.map(t => (
                    <button key={t.value} type="button" onClick={() => setCardioType(t.value)}
                      className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-colors ${cardioType === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-primary"}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Duration (min)</Label>
                  <Input type="number" min="1" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)} placeholder="30" className="bg-background border-border text-foreground text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Distance (mi)</Label>
                  <Input type="number" min="0" step="0.1" value={cardioDistance} onChange={e => setCardioDistance(e.target.value)} placeholder="2.5" className="bg-background border-border text-foreground text-sm" />
                </div>
                {cardioType === "treadmill" && (
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Incline (%)</Label>
                    <Input type="number" min="0" max="30" step="0.5" value={cardioIncline} onChange={e => setCardioIncline(e.target.value)} placeholder="2.0" className="bg-background border-border text-foreground text-sm" />
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="flex-1 border-border" onClick={resetCreating}>Cancel</Button>
                <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" onClick={handleSaveCardio} disabled={!cardioName.trim() || !cardioDuration || createCardioMutation.isPending}>
                  {createCardioMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Template"}
                </Button>
              </div>
            </div>
          )}

          {/* ── Existing templates ── */}
          {!hasAny && creating === null && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Dumbbell className="w-10 h-10 opacity-20" />
              <p className="text-sm">No templates yet — create one above.</p>
            </div>
          )}

          {strengthTemplates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Dumbbell className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Strength</p>
              </div>
              {strengthTemplates.map((t) => {
                const isExpanded = expandedStrength === t.id;
                return (
                  <div key={t.id} className="rounded-lg border border-border bg-background/50 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-3">
                      <button type="button" onClick={() => { const next = isExpanded ? null : t.id; setExpandedStrength(next); if (next) setPreviewId(next); }} className="flex-1 text-left flex items-center gap-2 min-w-0">
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        <span className="text-sm font-medium truncate">{t.name}</span>
                      </button>
                      <Button size="sm" onClick={() => { onUseStrengthTemplate(t.id); onClose(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 shrink-0">Start</Button>
                      <button type="button" onClick={() => deleteStrengthMutation.mutate({ id: t.id }, { onSuccess: () => { if (expandedStrength === t.id) setExpandedStrength(null); invalidateStrength(); } })} disabled={deleteStrengthMutation.isPending} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1">
                        {deleteStrengthMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    {isExpanded && previewTemplate && previewTemplate.id === t.id && (
                      <div className="border-t border-border px-3 py-2.5 space-y-1.5">
                        {previewTemplate.exercises.map((ex) => (
                          <div key={ex.id} className="flex justify-between text-xs">
                            <span className="text-foreground font-medium">{ex.exercise}</span>
                            <span className="text-muted-foreground">{ex.sets} × {ex.reps} @ {ex.weightLbs} lbs</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {isExpanded && (!previewTemplate || previewTemplate.id !== t.id) && (
                      <div className="border-t border-border px-3 py-2.5"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {cardioTemplates.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Heart className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cardio</p>
              </div>
              {cardioTemplates.map((t) => (
                <div key={t.id} className="rounded-lg border border-border bg-background/50 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {CARDIO_LABEL(t.exerciseType)} · {t.durationMinutes} min
                        {t.distanceMiles ? ` · ${t.distanceMiles} mi` : ""}
                        {t.inclinePercent ? ` · ${t.inclinePercent}% incline` : ""}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => { onUseCardioTemplate(t); onClose(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 shrink-0">Start</Button>
                    <button type="button" onClick={() => deleteCardioMutation.mutate({ id: t.id }, { onSuccess: invalidateCardio })} disabled={deleteCardioMutation.isPending} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1">
                      {deleteCardioMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
