import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useGetBodyMetrics, useCreateBodyMetric, getGetBodyMetricsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  date: z.date(),
  weightLbs: z.coerce.number().optional().nullable(),
  waistInches: z.coerce.number().optional().nullable(),
});

export function BodyMetrics() {
  const { data: metrics = [], isLoading } = useGetBodyMetrics();
  const createMetric = useCreateBodyMetric();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      weightLbs: null,
      waistInches: null,
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    createMetric.mutate(
      {
        data: {
          date: format(values.date, "yyyy-MM-dd"),
          weightLbs: values.weightLbs || null,
          waistInches: values.waistInches || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Metric logged successfully." });
          queryClient.invalidateQueries({ queryKey: getGetBodyMetricsQueryKey() });
          form.reset({ date: new Date(), weightLbs: null, waistInches: null });
        },
        onError: () => {
          toast({ title: "Failed to log metric.", variant: "destructive" });
        },
      }
    );
  };

  const chartData = useMemo(() => {
    if (!metrics.length) return [];
    return [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [metrics]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Biometrics</h2>
        <p className="text-muted-foreground">Log and monitor your body composition over time.</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="text-center">
          <CardTitle>Log Entry</CardTitle>
          <CardDescription>Record your weight and waist measurements. Re-entering the same date will update the existing entry.</CardDescription>
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
                            variant={"outline"}
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
                  name="weightLbs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (lbs)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="185.5" className="bg-background" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="waistInches"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waist (inches)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="32.5" className="bg-background" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" disabled={createMetric.isPending} className="w-full">
                {createMetric.isPending ? "Saving..." : "Save Entry"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : chartData.length === 0 ? (
        <Card className="h-[300px] flex items-center justify-center border-dashed">
          <div className="text-center text-muted-foreground">
            <p>No biometric data found.</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Body Weight</CardTitle>
              <CardDescription>Pounds (lbs)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={(val) => { const [,m,d] = val.split("-"); return `${parseInt(m,10)}/${parseInt(d,10)}`; }} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={['auto', 'auto']} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius-md)' }} />
                    <Area type="monotone" dataKey="weightLbs" stroke="hsl(var(--chart-2))" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Waist Measurement</CardTitle>
              <CardDescription>Inches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWaist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={(val) => { const [,m,d] = val.split("-"); return `${parseInt(m,10)}/${parseInt(d,10)}`; }} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={['auto', 'auto']} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: 'var(--radius-md)' }} />
                    <Area type="monotone" dataKey="waistInches" stroke="hsl(var(--chart-3))" strokeWidth={3} fillOpacity={1} fill="url(#colorWaist)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
