import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useGetMostImproved, type InsightsDateParams } from "@workspace/api-client-react";

const KG_TO_LBS = 2.20462;

interface MostImprovedWidgetProps {
  dateParams?: InsightsDateParams;
}

export function MostImprovedWidget({ dateParams }: MostImprovedWidgetProps) {
  const { data, isLoading } = useGetMostImproved(dateParams);

  const items = data?.slice(0, 5) ?? [];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Most Improved</CardTitle>
        <p className="text-xs text-muted-foreground">First vs. most recent avg weight · min 3 sessions</p>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Not enough data yet — upload more sessions to see improvements.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item, i) => {
              const isGain = item.pctGain >= 0;
              const firstLbs = Math.round(item.firstAvgKg * KG_TO_LBS * 10) / 10;
              const lastLbs = Math.round(item.lastAvgKg * KG_TO_LBS * 10) / 10;
              const absGainLbs = item.absGainLbs;
              return (
                <div key={item.exercise} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-4 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.exercise}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {firstLbs} → {lastLbs} lbs avg
                    </p>
                  </div>
                  <Badge
                    variant={isGain ? "default" : "destructive"}
                    className={`tabular-nums font-bold shrink-0 text-right ${isGain ? "bg-green-500/20 text-green-500 hover:bg-green-500/20 border-green-500/30" : "bg-red-500/20 text-red-400 hover:bg-red-500/20 border-red-500/30"}`}
                  >
                    {isGain ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                    {absGainLbs > 0 ? "+" : ""}{absGainLbs} lbs · {item.pctGain > 0 ? "+" : ""}{item.pctGain}%
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
