import { useState } from "react";
import { ChevronLeft, Trash2, Pencil, Check, X, AlertTriangle, Loader2, TrendingUp, TrendingDown, Minus, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useGetWorkoutSessions,
  useGetSessionSets,
  useUpdateWorkoutSet,
  useDeleteWorkoutSet,
  useDeleteSession,
  useUpdateSessionNotes,
  useGetSessionComparison,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
}

type View = { kind: "list" } | { kind: "session"; date: string };

type EditState = {
  id: number;
  exercise: string;
  weightLbs: string;
  reps: string;
  date: string;
};

function fmt(date: string) {
  const [y, m, d] = date.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DeltaBadge({ value, unit }: { value: number; unit: string }) {
  if (Math.abs(value) < 0.05) return <span className="text-xs text-muted-foreground">=</span>;
  const pos = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${pos ? "text-green-500" : "text-red-500"}`}>
      {pos ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {pos ? "+" : ""}{value}{unit}
    </span>
  );
}

export function SessionHistoryModal({ open, onClose }: Props) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [editState, setEditState] = useState<EditState | null>(null);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);
  const [deletingSetId, setDeletingSetId] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [showComparison, setShowComparison] = useState(false);

  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sessions = [], isLoading: sessionsLoading } = useGetWorkoutSessions({ query: { enabled: open } as any });

  const sessionDate = view.kind === "session" ? view.date : undefined;
  const { data: sets = [], isLoading: setsLoading } = useGetSessionSets(
    sessionDate ?? "",
    { query: { enabled: !!sessionDate } as any },
  );

  const { data: comparison = [] } = useGetSessionComparison(
    sessionDate ?? "",
    { query: { enabled: !!sessionDate && showComparison } as any },
  );

  const updateMutation = useUpdateWorkoutSet();
  const deleteSetMutation = useDeleteWorkoutSet();
  const deleteSessionMutation = useDeleteSession();
  const updateNotesMutation = useUpdateSessionNotes();

  function invalidate() {
    queryClient.invalidateQueries({
      predicate: (q) =>
        typeof q.queryKey[0] === "string" &&
        String(q.queryKey[0]).startsWith("/api/workouts"),
    });
  }

  function handleClose() {
    setView({ kind: "list" });
    setEditState(null);
    setConfirmDeleteSession(false);
    setDeletingSetId(null);
    setEditingNotes(false);
    setNotesValue("");
    setShowComparison(false);
    onClose();
  }

  function startEdit(set: { id: number; date: string; exercise: string; weightLbs: number; reps: number }) {
    setEditState({
      id: set.id,
      exercise: set.exercise,
      weightLbs: String(set.weightLbs),
      reps: String(set.reps),
      date: set.date,
    });
  }

  function cancelEdit() {
    setEditState(null);
  }

  function saveEdit() {
    if (!editState) return;
    const wLbs = parseFloat(editState.weightLbs);
    const reps = parseInt(editState.reps, 10);
    if (!editState.exercise.trim() || isNaN(wLbs) || wLbs <= 0 || isNaN(reps) || reps <= 0) return;

    updateMutation.mutate(
      {
        id: editState.id,
        data: {
          exercise: editState.exercise.trim(),
          weightLbs: wLbs,
          reps,
          date: editState.date,
        },
      },
      {
        onSuccess: () => {
          setEditState(null);
          invalidate();
        },
      },
    );
  }

  function deleteSet(id: number) {
    setDeletingSetId(id);
    deleteSetMutation.mutate(
      { id },
      {
        onSuccess: () => {
          setDeletingSetId(null);
          invalidate();
          if (sets.length === 1) {
            setView({ kind: "list" });
          }
        },
        onError: () => setDeletingSetId(null),
      },
    );
  }

  function deleteSession() {
    if (view.kind !== "session") return;
    deleteSessionMutation.mutate(
      { date: view.date },
      {
        onSuccess: () => {
          invalidate();
          setView({ kind: "list" });
          setConfirmDeleteSession(false);
        },
      },
    );
  }

  function startEditNotes() {
    const currentNotes = sets[0]?.notes ?? "";
    setNotesValue(currentNotes);
    setEditingNotes(true);
  }

  function saveNotes() {
    if (view.kind !== "session") return;
    updateNotesMutation.mutate(
      { date: view.date, data: { notes: notesValue.trim() || null } },
      {
        onSuccess: () => {
          setEditingNotes(false);
          invalidate();
        },
      },
    );
  }

  const currentNotes = sets[0]?.notes ?? null;
  const comparisonMap = new Map(comparison.map((c) => [c.exercise, c]));
  const currentSession = sessions.find((s) => s.date === sessionDate);
  const isCardioSession = currentSession?.type === "cardio";

  const groupedSets = sets.reduce<Record<string, typeof sets>>((acc, s) => {
    (acc[s.exercise] ??= []).push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            {view.kind === "session" && (
              <button
                type="button"
                onClick={() => { setView({ kind: "list" }); setEditState(null); setConfirmDeleteSession(false); setEditingNotes(false); setShowComparison(false); }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1">
              <DialogTitle className="text-xl font-bold">
                {view.kind === "list" ? "Session History" : fmt(view.date)}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-sm">
                {view.kind === "list"
                  ? "Select a session to view or edit its sets."
                  : `${sets.length} set${sets.length !== 1 ? "s" : ""} logged`}
              </DialogDescription>
            </div>
            {view.kind === "session" && !setsLoading && sets.length > 0 && (
              <button
                type="button"
                onClick={() => setShowComparison((v) => !v)}
                title="Toggle comparison with previous session"
                className={`text-xs px-2 py-1 rounded-md border transition-colors ${showComparison ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                vs prev
              </button>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {view.kind === "list" ? (
            sessionsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">No sessions logged yet.</p>
            ) : (
              <div className="space-y-1">
                {sessions.map((s) => (
                  <button
                    key={`${s.date}-${s.type}`}
                    type="button"
                    onClick={() => setView({ kind: "session", date: s.date })}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{fmt(s.date)}</span>
                      {s.type === "cardio" && (
                        <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium capitalize">
                          {s.cardioType?.replace("_", " ") ?? "Cardio"}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.type === "cardio"
                        ? `${s.cardioDurationMinutes} min${s.cardioDistanceMiles ? ` · ${s.cardioDistanceMiles} mi` : ""}`
                        : `${s.setCount} sets`}
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : isCardioSession ? (
            <div className="space-y-4 px-1 py-2">
              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
                <p className="text-sm font-semibold capitalize">{currentSession?.cardioType?.replace("_", " ")}</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Duration</p><p className="font-medium">{currentSession?.cardioDurationMinutes} min</p></div>
                  {currentSession?.cardioDistanceMiles != null && (
                    <div><p className="text-muted-foreground text-xs">Distance</p><p className="font-medium">{currentSession.cardioDistanceMiles} mi</p></div>
                  )}
                  {currentSession?.cardioInclinePercent != null && (
                    <div><p className="text-muted-foreground text-xs">Incline</p><p className="font-medium">{currentSession.cardioInclinePercent}%</p></div>
                  )}
                  {currentSession?.cardioCaloriesBurned != null && (
                    <div><p className="text-muted-foreground text-xs">Calories</p><p className="font-medium text-orange-400">🔥 {currentSession.cardioCaloriesBurned}</p></div>
                  )}
                </div>
              </div>
            </div>
          ) : setsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Notes section */}
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    placeholder="Session notes…"
                    rows={3}
                    className="bg-background border-border text-foreground resize-none text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveNotes} disabled={updateNotesMutation.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      {updateNotesMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save notes"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotes(false)}>Cancel</Button>
                  </div>
                </div>
              ) : currentNotes ? (
                <div className="flex items-start gap-2 px-1 py-2 rounded-md bg-muted/20 border border-border">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground flex-1 leading-relaxed">{currentNotes}</p>
                  <button type="button" onClick={startEditNotes} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={startEditNotes}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Add session notes
                </button>
              )}

              {Object.entries(groupedSets).map(([exercise, exerciseSets]) => {
                const comp = comparisonMap.get(exercise);
                return (
                  <div key={exercise}>
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {exercise}
                      </p>
                      {showComparison && comp && (
                        <div className="flex items-center gap-1.5 ml-auto">
                          <DeltaBadge value={comp.avgWeightLbsDelta} unit="lbs" />
                          <DeltaBadge value={comp.avgRepsDelta} unit="reps" />
                        </div>
                      )}
                      {showComparison && !comp && (
                        <span className="ml-auto text-xs text-muted-foreground italic">new</span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {exerciseSets.map((s, idx) => {
                        const isEditing = editState?.id === s.id;
                        const isDeleting = deletingSetId === s.id;
                        return (
                          <div
                            key={s.id}
                            className="grid grid-cols-[auto_1fr_80px_56px_64px] gap-2 items-center px-1 py-1.5 rounded-md hover:bg-muted/30"
                          >
                            <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                            {isEditing ? (
                              <>
                                <Input
                                  value={editState.exercise}
                                  onChange={(e) => setEditState((s) => s && { ...s, exercise: e.target.value })}
                                  className="h-7 text-sm bg-background border-border"
                                />
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.5"
                                  value={editState.weightLbs}
                                  onChange={(e) => setEditState((s) => s && { ...s, weightLbs: e.target.value })}
                                  className="h-7 text-sm bg-background border-border"
                                />
                                <Input
                                  type="number"
                                  min="1"
                                  value={editState.reps}
                                  onChange={(e) => setEditState((s) => s && { ...s, reps: e.target.value })}
                                  className="h-7 text-sm bg-background border-border"
                                />
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={saveEdit}
                                    disabled={updateMutation.isPending}
                                    className="text-primary hover:text-primary/80 disabled:opacity-50"
                                  >
                                    {updateMutation.isPending ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Check className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <button type="button" onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <span className="text-sm">{s.exercise}</span>
                                <span className="text-sm text-right">{s.weightLbs} lbs</span>
                                <span className="text-sm text-center">{s.reps} reps</span>
                                <div className="flex gap-1 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(s)}
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Edit set"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteSet(s.id)}
                                    disabled={isDeleting}
                                    className="text-muted-foreground hover:text-destructive disabled:opacity-50 transition-colors"
                                    aria-label="Delete set"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {view.kind === "session" && !setsLoading && sets.length > 0 && (
          <div className="flex-shrink-0 pt-3 border-t border-border mt-3">
            {confirmDeleteSession ? (
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                <span className="text-sm text-destructive flex-1">Delete all {sets.length} sets?</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={deleteSession}
                  disabled={deleteSessionMutation.isPending}
                  className="h-7"
                >
                  {deleteSessionMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Delete"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmDeleteSession(false)}
                  className="h-7"
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDeleteSession(true)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete entire session
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
