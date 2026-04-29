import { useState } from "react";
import { Trash2, ChevronDown, Dumbbell, Heart, Plus, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useGetWorkoutTemplates,
  useGetWorkoutTemplate,
  useDeleteWorkoutTemplate,
  useGetCardioTemplates,
  useDeleteCardioTemplate,
} from "@workspace/api-client-react";
import type { CardioTemplateItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onClose: () => void;
  onUseStrengthTemplate: (id: number) => void;
  onUseCardioTemplate: (template: CardioTemplateItem) => void;
  onCreateNew: () => void;
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

export function TemplatesModal({ open, onClose, onUseStrengthTemplate, onUseCardioTemplate, onCreateNew }: Props) {
  const [expandedStrength, setExpandedStrength] = useState<number | null>(null);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { data: strengthTemplates = [] } = useGetWorkoutTemplates({ query: { enabled: open } });
  const { data: previewTemplate } = useGetWorkoutTemplate(previewId ?? 0, {
    query: { enabled: !!previewId },
  });
  const { data: cardioTemplates = [] } = useGetCardioTemplates({ query: { enabled: open } });
  const deleteStrengthMutation = useDeleteWorkoutTemplate();
  const deleteCardioMutation = useDeleteCardioTemplate();

  const handleExpandStrength = (id: number) => {
    const next = expandedStrength === id ? null : id;
    setExpandedStrength(next);
    if (next) setPreviewId(next);
  };

  const invalidateStrength = () =>
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("/api/workouts/templates") });
  const invalidateCardio = () =>
    queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("cardio-templates") });

  const hasAny = strengthTemplates.length > 0 || cardioTemplates.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-xl font-bold">Workout Templates</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Save your favourite workouts and start them in one tap.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 min-h-0">
          {!hasAny && (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <Dumbbell className="w-10 h-10 opacity-30" />
              <p className="text-sm">No templates yet.</p>
              <p className="text-xs opacity-70">Log a workout and tap "Save as template" to create one.</p>
            </div>
          )}

          {/* Strength templates */}
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
                      <button
                        type="button"
                        onClick={() => handleExpandStrength(t.id)}
                        className="flex-1 text-left flex items-center gap-2 min-w-0"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                        <span className="text-sm font-medium truncate">{t.name}</span>
                      </button>
                      <Button
                        size="sm"
                        onClick={() => { onUseStrengthTemplate(t.id); onClose(); }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 shrink-0"
                      >
                        Start
                      </Button>
                      <button
                        type="button"
                        onClick={() => deleteStrengthMutation.mutate({ id: t.id }, {
                          onSuccess: () => {
                            if (expandedStrength === t.id) setExpandedStrength(null);
                            invalidateStrength();
                          },
                        })}
                        disabled={deleteStrengthMutation.isPending}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1"
                      >
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
                      <div className="border-t border-border px-3 py-2.5">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cardio templates */}
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
                    <Button
                      size="sm"
                      onClick={() => { onUseCardioTemplate(t); onClose(); }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs h-7 px-3 shrink-0"
                    >
                      Start
                    </Button>
                    <button
                      type="button"
                      onClick={() => deleteCardioMutation.mutate({ id: t.id }, { onSuccess: invalidateCardio })}
                      disabled={deleteCardioMutation.isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors shrink-0 ml-1"
                    >
                      {deleteCardioMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create new */}
          <button
            type="button"
            onClick={() => { onCreateNew(); onClose(); }}
            className="w-full border border-dashed border-border text-muted-foreground hover:text-foreground hover:border-primary text-sm py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Log a workout to create a template
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
