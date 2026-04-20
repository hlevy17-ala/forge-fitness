import { useMemo, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Target } from "lucide-react";
import {
  useGetCalorieLogs,
  useCreateCalorieLog,
  useGetCalorieDailyGoal,
  useSetCalorieDailyGoal,
  useGetCalorieBurnGoal,
  useSetCalorieBurnGoal,
  getGetCalorieLogsQueryKey,
  getGetCalorieDailyGoalQueryKey,
  getGetCalorieBurnGoalQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  date: z.date(),
  caloriesConsumed: z.coerce.number().int().positive().optional().nullable(),
  caloriesBurned: z.coerce.number().int().positive().optional().nullable(),
});

export function CalorieTracker() {
  const { data: logs = [], isLoading } = useGetCalorieLogs();
  const { data: goalData, isLoading: isLoadingGoal } = useGetCalorieDailyGoal();
  const { data: burnGoalData, isLoading: isLoadingBurnGoal } = useGetCalorieBurnGoal();
  const createLog = useCreateCalorieLog();
  const setGoalMutation = useSetCalorieDailyGoal();
  const setBurnGoalMutation = useSetCalorieBurnGoal();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [goalInput, setGoalInput] = useState<string>("");
  const [goalEditing, setGoalEditing] = useState(false);
  const [burnGoalInput, setBurnGoalInput] = useState<string>("");
  const [burnGoalEditing, setBurnGoalEditing] = useState(false);

  useEffect(() => {
    if (goalData?.value != null && !goalEditing) {
      setGoalInput(String(goalData.value));
    }
  }, [goalData, goalEditing]);

  useEffect(() => {
    if (burnGoalData?.value != null && !burnGoalEditing) {
      setBurnGoalInput(String(burnGoalData.value));
    }
  }, [burnGoalData, burnGoalEditing]);

  const calorieGoal = goalData?.value ?? null;
  const calorieBurnGoal = burnGoalData?.value ?? null;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      caloriesConsumed: null,
      caloriesBurned: null,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createLog.mutate(
      {
        data: {
          date: format(values.date, "yyyy-MM-dd"),
          caloriesConsumed: values.caloriesConsumed || null,
          caloriesBurned: values.caloriesBurned || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Calorie entry logged." });
          queryClient.invalidateQueries({ queryKey: getGetCalorieLogsQueryKey() });
          form.reset({ date: new Date(), caloriesConsumed: null, caloriesBurned: null });
        },
        onError: () => {
          toast({ title: "Failed to log entry.", variant: "destructive" });
        },
      }
    );
  };

  const handleSaveGoal = () => {
    const val = parseInt(goalInput, 10);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Please enter a valid calorie goal.", variant: "destructive" });
      return;
    }
    setGoalMutation.mutate(
      { data: { value: val } },
      {
        onSuccess: () => {
          toast({ title: "Calorie goal saved." });
          setGoalEditing(false);
          queryClient.invalidateQueries({ queryKey: getGetCalorieDailyGoalQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to save goal.", variant: "destructive" });
        },
      }
    );
  };

  const handleSaveBurnGoal = () => {
    const val = parseInt(burnGoalInput, 10);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Please enter a valid burn goal.", variant: "destructive" });
      return;
    }
    setBurnGoalMutation.mutate(
      { data: { value: val } },
      {
        onSuccess: () => {
          toast({ title: "Burn goal saved." });
          setBurnGoalEditing(false);
          queryClient.invalidateQueries({ queryKey: getGetCalorieBurnGoalQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to save burn goal.", variant: "destructive" });
        },
      }
    );
  };

  const chartData = useMemo(() => {
    if (!logs.length) return [];
    return [...logs]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((log) => {
        const consumed = log.caloriesConsumed ?? 0;
        const burned = log.caloriesBurned ?? 0;
        return {
          date: log.date,
          caloriesConsumed: consumed,
          caloriesBurned: burned,
          deficit: burned - consumed,
        };
      });
  }, [logs]);

  const avgDeficit = useMemo(() => {
    if (!chartData.length) return 0;
    const total = chartData.reduce((sum, d) => sum + d.deficit, 0);
    return Math.round(total / chartData.length);
  }, [chartData]);

  const avgConsumed = useMemo(() => {
    if (!chartData.length) return 0;
    const total = chartData.reduce((sum, d) => sum + d.caloriesConsumed, 0);
    return Math.round(total / chartData.length);
  }, [chartData]);

  const avgBurned = useMemo(() => {
    if (!chartData.length) return 0;
    const total = chartData.reduce((sum, d) => sum + d.caloriesBurned, 0);
    return Math.round(total / chartData.length);
  }, [chartData]);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    borderColor: "hsl(var(--border))",
    borderRadius: "var(--radius-md)",
    color: "hsl(var(--foreground))",
  };

  const axisStyle = {
    stroke: "hsl(var(--muted-foreground))",
    fontSize: 12,
    tickLine: false,
    axisLine: false,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Nutrition</h2>
          <p className="text-muted-foreground">Log your calories to track your daily deficit over time.</p>
        </div>

        {(!isLoadingGoal || !isLoadingBurnGoal) && (
          <Card className="border-primary/30 bg-primary/5 w-full sm:w-auto">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Target className="w-4 h-4 text-primary shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Consume Goal</span>
                  <Input
                    type="number"
                    step="50"
                    placeholder="e.g. 2000"
                    value={goalInput}
                    onChange={(e) => { setGoalInput(e.target.value); setGoalEditing(true); }}
                    className="w-24 h-8 text-sm bg-background tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">kcal</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveGoal}
                    disabled={setGoalMutation.isPending || !goalInput}
                    className="h-8 px-3 text-xs"
                  >
                    {setGoalMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
              {calorieGoal != null && (
                <p className="text-xs text-muted-foreground ml-7">
                  Avg consumed: <span className={`font-semibold tabular-nums ${avgConsumed > calorieGoal ? "text-destructive" : "text-chart-2"}`}>{avgConsumed.toLocaleString()} kcal</span>
                  {" "}·{" "}
                  {avgConsumed <= calorieGoal
                    ? <span className="text-chart-2">under by {(calorieGoal - avgConsumed).toLocaleString()} kcal/day</span>
                    : <span className="text-destructive">over by {(avgConsumed - calorieGoal).toLocaleString()} kcal/day</span>
                  }
                </p>
              )}

              <div className="border-t border-border/50 pt-3 flex items-center gap-3">
                <Target className="w-4 h-4 text-chart-2 shrink-0" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Burn Goal</span>
                  <Input
                    type="number"
                    step="50"
                    placeholder="e.g. 400"
                    value={burnGoalInput}
                    onChange={(e) => { setBurnGoalInput(e.target.value); setBurnGoalEditing(true); }}
                    className="w-24 h-8 text-sm bg-background tabular-nums"
                  />
                  <span className="text-sm text-muted-foreground">kcal</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveBurnGoal}
                    disabled={setBurnGoalMutation.isPending || !burnGoalInput}
                    className="h-8 px-3 text-xs"
                  >
                    {setBurnGoalMutation.isPending ? "Saving…" : "Save"}
                  </Button>
                </div>
              </div>
              {calorieBurnGoal != null && (
                <p className="text-xs text-muted-foreground ml-7">
                  Avg burned: <span className={`font-semibold tabular-nums ${avgBurned >= calorieBurnGoal ? "text-chart-2" : "text-destructive"}`}>{avgBurned.toLocaleString()} kcal</span>
                  {" "}·{" "}
                  {avgBurned >= calorieBurnGoal
                    ? <span className="text-chart-2">above goal by {(avgBurned - calorieBurnGoal).toLocaleString()} kcal/day</span>
                    : <span className="text-destructive">below goal by {(calorieBurnGoal - avgBurned).toLocaleString()} kcal/day</span>
                  }
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="text-center">
          <CardTitle>Log Entry</CardTitle>
          <CardDescription>Enter your calories for a given day. Re-entering the same date will update the existing entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-sm mx-auto space-y-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn("w-full pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}
                          >
                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="caloriesConsumed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consumed (kcal)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          placeholder="2200"
                          className="bg-background"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="caloriesBurned"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Burned (kcal)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          placeholder="400"
                          className="bg-background"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={createLog.isPending} className="w-full">
                {createLog.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : chartData.length === 0 ? (
        <Card className="h-[300px] flex items-center justify-center border-dashed">
          <div className="text-center text-muted-foreground">
            <p>No calorie data yet. Log your first entry above.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-lg">Daily Calories</CardTitle>
                  <CardDescription>Consumed vs. burned per day{calorieGoal ? ` · goal: ${calorieGoal.toLocaleString()} kcal` : ""}</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Avg Daily Deficit</p>
                  <p className={`text-2xl font-bold tabular-nums ${avgDeficit >= 0 ? "text-chart-2" : "text-destructive"}`}>
                    {avgDeficit >= 0 ? "+" : ""}{avgDeficit.toLocaleString()} kcal
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => {
                        const [, m, d] = val.split("-");
                        return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
                      }}
                      {...axisStyle}
                      dy={10}
                    />
                    <YAxis {...axisStyle} dx={-10} tickFormatter={(val) => `${val}`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                      formatter={(value: number, name: string) => [
                        `${value.toLocaleString()} kcal`,
                        name === "caloriesConsumed" ? "Consumed" : "Burned",
                      ]}
                    />
                    <Legend
                      formatter={(value) => (value === "caloriesConsumed" ? "Consumed" : "Burned")}
                      wrapperStyle={{ paddingTop: "16px" }}
                      iconType="circle"
                    />
                    {calorieGoal != null && (
                      <ReferenceLine
                        y={calorieGoal}
                        stroke="hsl(var(--primary))"
                        strokeDasharray="6 3"
                        strokeWidth={2}
                        label={{ value: "Consume Goal", position: "insideTopRight", fill: "hsl(var(--primary))", fontSize: 11, fontWeight: 600 }}
                      />
                    )}
                    {calorieBurnGoal != null && (
                      <ReferenceLine
                        y={calorieBurnGoal}
                        stroke="hsl(var(--chart-2))"
                        strokeDasharray="6 3"
                        strokeWidth={2}
                        label={{ value: "Burn Goal", position: "insideBottomRight", fill: "hsl(var(--chart-2))", fontSize: 11, fontWeight: 600 }}
                      />
                    )}
                    <Bar dataKey="caloriesConsumed" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="caloriesBurned" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Daily Deficit</CardTitle>
              <CardDescription>Net calories burned minus consumed. Positive = deficit (fat loss).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => {
                        const [, m, d] = val.split("-");
                        return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
                      }}
                      {...axisStyle}
                      dy={10}
                    />
                    <YAxis {...axisStyle} dx={-10} tickFormatter={(val) => `${val}`} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600, marginBottom: 4 }}
                      formatter={(value: number) => [`${value.toLocaleString()} kcal`, "Net Deficit"]}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                    <Bar
                      dataKey="deficit"
                      radius={[4, 4, 0, 0]}
                      fill="hsl(var(--chart-2))"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
