import { useState } from "react";
import { Target, Pencil, Check, X } from "lucide-react";
import { useGetWeeklySessionsGoal, useSetWeeklySessionsGoal, useGetWorkoutSessions } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function getIsoWeekBounds(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

const RADIUS = 36;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function WeeklyGoalWidget() {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const queryClient = useQueryClient();

  const { data: goalData } = useGetWeeklySessionsGoal();
  const { data: sessions = [] } = useGetWorkoutSessions();
  const setGoalMutation = useSetWeeklySessionsGoal();

  const goal = goalData?.value ?? null;
  const { start, end } = getIsoWeekBounds();
  const thisWeekCount = sessions.filter((s) => s.date >= start && s.date <= end).length;

  const progress = goal ? Math.min(thisWeekCount / goal, 1) : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const pct = goal ? Math.round((thisWeekCount / goal) * 100) : null;

  function startEdit() {
    setInputVal(String(goal ?? ""));
    setEditing(true);
  }

  function saveGoal() {
    const val = parseInt(inputVal, 10);
    if (isNaN(val) || val < 1 || val > 14) return;
    setGoalMutation.mutate(
      { data: { value: val } },
      {
        onSuccess: () => {
          setEditing(false);
          queryClient.invalidateQueries({
            predicate: (q) =>
              typeof q.queryKey[0] === "string" &&
              String(q.queryKey[0]).startsWith("/api/settings/weekly"),
          });
        },
      },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-5">
      <div className="relative w-20 h-20 flex-shrink-0">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle cx="44" cy="44" r={RADIUS} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="8" />
          <circle
            cx="44"
            cy="44"
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            className={progress >= 1 ? "text-green-500" : "text-primary"}
            strokeWidth="8"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.5s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold leading-none">{thisWeekCount}</span>
          {goal && <span className="text-xs text-muted-foreground">/{goal}</span>}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-semibold text-sm">Weekly Goal</span>
          {!editing && (
            <button type="button" onClick={startEdit} className="text-muted-foreground hover:text-foreground transition-colors ml-auto">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {editing ? (
          <div className="flex items-center gap-2 mt-2">
            <Input
              type="number"
              min="1"
              max="14"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="e.g. 4"
              className="h-8 w-20 text-sm bg-background border-border"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") saveGoal(); if (e.key === "Escape") setEditing(false); }}
            />
            <span className="text-xs text-muted-foreground">sessions/week</span>
            <Button size="sm" onClick={saveGoal} disabled={setGoalMutation.isPending} className="h-7 px-2">
              <Check className="w-3.5 h-3.5" />
            </Button>
            <button type="button" onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : goal ? (
          <>
            <p className="text-sm text-muted-foreground">
              {thisWeekCount} of {goal} sessions this week
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {progress >= 1
                ? "Goal reached! Great work."
                : pct !== null
                ? `${pct}% complete`
                : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Set a weekly session target to track your consistency.
            <button type="button" onClick={startEdit} className="ml-1 text-primary hover:underline text-sm">Set goal</button>
          </p>
        )}
      </div>
    </div>
  );
}
