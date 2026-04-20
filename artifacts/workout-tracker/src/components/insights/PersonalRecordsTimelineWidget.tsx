import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetPersonalRecordsTimeline } from "@workspace/api-client-react";
import { Trophy } from "lucide-react";

const KG_TO_LBS = 2.20462;

function formatDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("default", { month: "short", day: "numeric", year: "numeric" });
}

function daysAgo(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff}d ago`;
  if (diff < 30) return `${Math.round(diff / 7)}w ago`;
  if (diff < 365) return `${Math.round(diff / 30)}mo ago`;
  return `${Math.round(diff / 365)}y ago`;
}

export function PersonalRecordsTimelineWidget() {
  const { data, isLoading } = useGetPersonalRecordsTimeline();

  const recentPRs = (data ?? []).slice(0, 12);
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const newThisMonth = recentPRs.filter(r => r.prDate.startsWith(thisMonthKey)).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base font-semibold">Personal Records Timeline</CardTitle>
            <p className="text-xs text-muted-foreground">When each all-time max was set</p>
          </div>
          {newThisMonth > 0 && (
            <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20">
              <Trophy className="w-3 h-3 mr-1" />
              {newThisMonth} this month
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : recentPRs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No personal records yet — upload your workout data to see them here.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {recentPRs.map((pr) => {
              const weightLbs = Math.round(pr.maxWeightKg * KG_TO_LBS * 10) / 10;
              return (
                <div key={pr.exercise} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                  <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{pr.exercise}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">{weightLbs} lbs · {daysAgo(pr.prDate)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
