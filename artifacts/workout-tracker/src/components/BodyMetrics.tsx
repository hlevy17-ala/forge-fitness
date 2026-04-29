import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, Ruler, ChevronDown, ChevronUp } from "lucide-react";
import {
  useGetBodyMetrics,
  useCreateBodyMetric,
  getGetBodyMetricsQueryKey,
  useGetBodyMeasurements,
  useCreateBodyMeasurement,
  useDeleteBodyMeasurement,
  getGetBodyMeasurementsQueryKey,
} from "@workspace/api-client-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const PRESET_PARTS = [
  "Arms",
  "Chest",
  "Waist",
  "Hips",
  "Thighs",
  "Calves",
  "Neck",
  "Shoulders",
  "Forearms",
];

const weightFormSchema = z.object({
  date: z.date(),
  weightLbs: z.coerce.number().optional().nullable(),
  waistInches: z.coerce.number().optional().nullable(),
});

const measurementFormSchema = z.object({
  date: z.date(),
  part: z.string().min(1, "Select or enter a body part"),
  customPart: z.string().optional(),
  inches: z.coerce.number().positive("Must be a positive number"),
});

type WeightFormValues = z.infer<typeof weightFormSchema>;
type MeasurementFormValues = z.infer<typeof measurementFormSchema>;

export function BodyMetrics() {
  const { data: metrics = [], isLoading: loadingMetrics } = useGetBodyMetrics();
  const { data: measurements = [], isLoading: loadingMeasurements } = useGetBodyMeasurements();
  const createMetric = useCreateBodyMetric();
  const createMeasurement = useCreateBodyMeasurement();
  const deleteMeasurement = useDeleteBodyMeasurement();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [measurementFormOpen, setMeasurementFormOpen] = useState(false);
  const [selectedPart, setSelectedPart] = useState<string>("");
  const [customPartInput, setCustomPartInput] = useState("");

  const weightForm = useForm<WeightFormValues>({
    resolver: zodResolver(weightFormSchema),
    defaultValues: {
      date: new Date(),
      weightLbs: null,
      waistInches: null,
    },
  });

  const measurementForm = useForm<MeasurementFormValues>({
    resolver: zodResolver(measurementFormSchema),
    defaultValues: {
      date: new Date(),
      part: "",
      customPart: "",
      inches: undefined,
    },
  });

  const onSubmitWeight = (values: WeightFormValues) => {
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
          toast({ title: "Logged successfully." });
          queryClient.invalidateQueries({ queryKey: getGetBodyMetricsQueryKey() });
          weightForm.reset({ date: new Date(), weightLbs: null, waistInches: null });
        },
        onError: () => {
          toast({ title: "Failed to log.", variant: "destructive" });
        },
      }
    );
  };

  const onSubmitMeasurement = (values: MeasurementFormValues) => {
    const part = values.part === "__custom__"
      ? (customPartInput.trim() || "Custom")
      : values.part;

    createMeasurement.mutate(
      {
        data: {
          date: format(values.date, "yyyy-MM-dd"),
          part,
          inches: values.inches,
        },
      },
      {
        onSuccess: () => {
          toast({ title: `${part} measurement logged.` });
          queryClient.invalidateQueries({ queryKey: getGetBodyMeasurementsQueryKey() });
          measurementForm.reset({ date: new Date(), part: "", customPart: "", inches: undefined });
          setSelectedPart("");
          setCustomPartInput("");
          setMeasurementFormOpen(false);
        },
        onError: () => {
          toast({ title: "Failed to log measurement.", variant: "destructive" });
        },
      }
    );
  };

  const handleDeleteMeasurement = (id: number, part: string) => {
    deleteMeasurement.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: `${part} entry deleted.` });
          queryClient.invalidateQueries({ queryKey: getGetBodyMeasurementsQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to delete.", variant: "destructive" });
        },
      }
    );
  };

  const weightChartData = useMemo(() => {
    if (!metrics.length) return [];
    return [...metrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [metrics]);

  // Group measurements by body part
  const measurementsByPart = useMemo(() => {
    const groups: Record<string, typeof measurements> = {};
    for (const m of measurements) {
      if (!groups[m.part]) groups[m.part] = [];
      groups[m.part].push(m);
    }
    // Sort each group by date
    for (const part of Object.keys(groups)) {
      groups[part].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    return groups;
  }, [measurements]);

  const trackedParts = Object.keys(measurementsByPart);

  const formatDate = (val: string) => {
    const [, m, d] = val.split("-");
    return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
  };

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    borderColor: "hsl(var(--border))",
    borderRadius: "var(--radius-md)",
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Biometrics</h2>
        <p className="text-muted-foreground">Log and monitor your body composition over time.</p>
      </div>

      {/* Weight & Waist form */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="text-center">
          <CardTitle>Log Weight & Waist</CardTitle>
          <CardDescription>Re-entering the same date updates the existing entry.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...weightForm}>
            <form onSubmit={weightForm.handleSubmit(onSubmitWeight)} className="max-w-sm mx-auto space-y-4">
              <FormField
                control={weightForm.control}
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
                  control={weightForm.control}
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
                  control={weightForm.control}
                  name="waistInches"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Waist (in)</FormLabel>
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

      {/* Weight & Waist Charts */}
      {loadingMetrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      ) : weightChartData.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Body Weight</CardTitle>
              <CardDescription>Pounds (lbs)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChartData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={["auto", "auto"]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="weightLbs" stroke="hsl(var(--chart-2))" strokeWidth={3} fillOpacity={1} fill="url(#colorWeight)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Waist</CardTitle>
              <CardDescription>Inches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weightChartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorWaist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tickFormatter={formatDate} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis domain={["auto", "auto"]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="waistInches" stroke="hsl(var(--chart-3))" strokeWidth={3} fillOpacity={1} fill="url(#colorWaist)" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Custom Body Measurements section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Body Measurements</h3>
            <p className="text-sm text-muted-foreground">Track arms, chest, legs, and any body part you want.</p>
          </div>
          <Button
            onClick={() => setMeasurementFormOpen((v) => !v)}
            className="gap-2"
            variant="outline"
          >
            {measurementFormOpen ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {measurementFormOpen ? "Cancel" : "Log Measurement"}
          </Button>
        </div>

        {/* Log measurement form */}
        {measurementFormOpen && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <Form {...measurementForm}>
                <form onSubmit={measurementForm.handleSubmit(onSubmitMeasurement)} className="max-w-sm mx-auto space-y-4">
                  <FormField
                    control={measurementForm.control}
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

                  <FormField
                    control={measurementForm.control}
                    name="part"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Body Part</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(val) => {
                            field.onChange(val);
                            setSelectedPart(val);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
                              <SelectValue placeholder="Select a body part..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PRESET_PARTS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                            <SelectItem value="__custom__">✏️ Custom...</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {selectedPart === "__custom__" && (
                    <FormItem>
                      <FormLabel>Custom Body Part Name</FormLabel>
                      <Input
                        placeholder="e.g. Upper Back, Ankles..."
                        className="bg-background"
                        value={customPartInput}
                        onChange={(e) => setCustomPartInput(e.target.value)}
                      />
                    </FormItem>
                  )}

                  <FormField
                    control={measurementForm.control}
                    name="inches"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Measurement (inches)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="14.5"
                            className="bg-background"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    disabled={createMeasurement.isPending}
                    className="w-full"
                  >
                    {createMeasurement.isPending ? "Saving..." : "Save Measurement"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Per-body-part charts */}
        {loadingMeasurements ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-[300px] w-full" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : trackedParts.length === 0 ? (
          <Card className="h-[180px] flex items-center justify-center border-dashed">
            <div className="text-center text-muted-foreground space-y-2">
              <Ruler className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-sm">No measurements logged yet.</p>
              <p className="text-xs">Hit "Log Measurement" to start tracking body parts.</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trackedParts.map((part, idx) => {
              const data = measurementsByPart[part];
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              const latest = data[data.length - 1];
              const gradientId = `grad-${part.replace(/\s+/g, "-").toLowerCase()}`;

              return (
                <Card key={part}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">{part}</CardTitle>
                        <CardDescription>
                          Inches · Latest: <span className="font-semibold text-foreground">{latest.inches}"</span>
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {data.length} {data.length === 1 ? "entry" : "entries"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {data.length === 1 ? (
                      // Single entry — show a simple stat + delete
                      <div className="flex items-center justify-between py-4 px-2">
                        <div className="text-center flex-1">
                          <p className="text-3xl font-bold">{latest.inches}"</p>
                          <p className="text-sm text-muted-foreground mt-1">{latest.date}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteMeasurement(latest.id, part)}
                          disabled={deleteMeasurement.isPending}
                          title="Delete this entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                            <defs>
                              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color} stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis dataKey="date" tickFormatter={formatDate} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                            <YAxis domain={["auto", "auto"]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                            <Tooltip
                              contentStyle={tooltipStyle}
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const entry = payload[0].payload;
                                return (
                                  <div className="bg-card border border-border rounded-lg p-2 text-sm space-y-1">
                                    <p className="text-muted-foreground">{label}</p>
                                    <p className="font-semibold">{entry.inches}"</p>
                                    <button
                                      className="text-xs text-destructive hover:underline"
                                      onClick={() => handleDeleteMeasurement(entry.id, part)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                );
                              }}
                            />
                            <Area type="monotone" dataKey="inches" stroke={color} strokeWidth={3} fillOpacity={1} fill={`url(#${gradientId})`} connectNulls dot={{ r: 3, fill: color }} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
