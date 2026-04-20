import { useState, useRef } from "react";
import { CheckCircle2, FileUp, RotateCcw, Dumbbell, ArrowLeft, AlertCircle, Download, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useUploadWorkoutCsv,
  getGetAvgWeightByExerciseQueryKey,
  getGetAvgWeightByMuscleGroupQueryKey,
  getGetWorkoutsByExerciseQueryKey,
  getGetWorkoutsByMuscleGroupQueryKey,
  getGetExerciseListQueryKey,
  getGetPersonalRecordsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

type Step = "select" | "map" | "done";

type ColumnMapping = {
  date: string;
  exercise: string;
  reps: string;
  weight: string;
  weightUnit: "kg" | "lbs";
  isWarmup: string;
  multiplier: string;
};

type UploadResult = { inserted: number; skipped: number; total: number; sessions: number; exercises: number; fileName: string };

const SAMPLE_CSV = `Date,Exercise Name,Reps,Weight,Is Warmup
2025-01-06,Machine Bench Press,10,60,false
2025-01-06,Machine Bench Press,8,65,false
2025-01-06,Lat Pulldown,12,50,false
2025-01-06,Machine Bicep Curl,12,20,false
2025-01-08,Machine Shoulder Press,10,40,false
2025-01-08,Machine Hip Adductor,15,50,false
2025-01-10,Machine Bench Press,8,67.5,false
2025-01-10,Lat Pulldown,10,55,false
`;

function downloadSampleCsv() {
  const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sample-workout.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const NONE = "__none__";

function parseHeadersFromText(text: string): string[] {
  const firstLine = text.split("\n")[0] ?? "";
  return firstLine.split(",").map((h) => h.trim()).filter(Boolean);
}

function autoDetect(headers: string[]): ColumnMapping {
  const find = (patterns: RegExp[]) =>
    headers.find((h) => patterns.some((p) => p.test(h.toLowerCase()))) ?? "";
  return {
    date: find([/\bdate\b/]),
    exercise: find([/exercise/, /movement/, /workout.?name/]),
    reps: find([/\brep/]),
    weight: find([/weight/, /\bkg\b/, /load/]),
    weightUnit: "kg",
    isWarmup: find([/warm/]),
    multiplier: find([/multipl/]),
  };
}

const REQUIRED_FIELDS: { key: keyof Pick<ColumnMapping, "date" | "exercise" | "reps" | "weight">; label: string; hint: string }[] = [
  { key: "date", label: "Date", hint: "The date of the workout session" },
  { key: "exercise", label: "Exercise Name", hint: "The name of the movement" },
  { key: "reps", label: "Reps", hint: "Number of repetitions per set" },
  { key: "weight", label: "Weight", hint: "Weight loaded per set" },
];

const OPTIONAL_FIELDS: { key: keyof Pick<ColumnMapping, "isWarmup" | "multiplier">; label: string; hint: string }[] = [
  { key: "isWarmup", label: "Warmup Flag", hint: "Rows where this is \"true\" will be skipped" },
  { key: "multiplier", label: "Multiplier", hint: "Rows where this equals 0 will be skipped" },
];

export function CsvUpload() {
  const [step, setStep] = useState<Step>("select");
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({
    date: "", exercise: "", reps: "", weight: "", weightUnit: "kg", isWarmup: "", multiplier: "",
  });
  const [result, setResult] = useState<UploadResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const uploadMutation = useUploadWorkoutCsv();

  const updateMapping = (key: keyof ColumnMapping, value: string) =>
    setMapping((m) => ({ ...m, [key]: value }));

  const handleFileSelected = async (f: File) => {
    const text = await f.text();
    const parsedHeaders = parseHeadersFromText(text);
    setFile(f);
    setHeaders(parsedHeaders);
    setMapping(autoDetect(parsedHeaders));
    setErrorMsg(null);
    setStep("map");
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileSelected(f);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFileSelected(f);
  };

  const canImport =
    mapping.date && mapping.exercise && mapping.reps && mapping.weight;

  const handleImport = () => {
    if (!file || !canImport) return;
    const fileName = file.name;
    const mappingPayload = {
      date: mapping.date,
      exercise: mapping.exercise,
      reps: mapping.reps,
      weight: mapping.weight,
      weightUnit: mapping.weightUnit,
      ...(mapping.isWarmup ? { isWarmup: mapping.isWarmup } : {}),
      ...(mapping.multiplier ? { multiplier: mapping.multiplier } : {}),
    };

    uploadMutation.mutate(
      { data: { file, mapping: JSON.stringify(mappingPayload) } },
      {
        onSuccess: (res) => {
          setResult({ inserted: res.inserted, skipped: res.skipped, total: res.total, sessions: res.sessions, exercises: res.exercises, fileName });
          setFile(null);
          setStep("done");
          queryClient.invalidateQueries({ queryKey: getGetWorkoutsByExerciseQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWorkoutsByMuscleGroupQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetExerciseListQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAvgWeightByExerciseQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetAvgWeightByMuscleGroupQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetPersonalRecordsQueryKey() });
        },
        onError: (err: unknown) => {
          const msg = (err as { message?: string })?.message ?? "Upload failed — check your column mapping and try again.";
          setErrorMsg(msg);
        },
      }
    );
  };

  const handleReset = () => {
    setResult(null);
    setFile(null);
    setHeaders([]);
    setErrorMsg(null);
    setStep("select");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-xl">Import Data</CardTitle>
        <CardDescription>
          {step === "select" && "Upload any workout CSV and map its columns to the right fields."}
          {step === "map" && `Map columns from "${file?.name}" to the required fields.`}
          {step === "done" && "Your data has been imported successfully."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === "done" && result ? (
          <div className="flex flex-col items-center justify-center gap-6 py-8">
            <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-bold text-foreground">Import Complete</h3>
              <p className="text-muted-foreground text-sm">{result.fileName}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
              <div className="bg-muted/40 rounded-xl p-3 text-center border border-border">
                <p className="text-2xl font-black text-primary tabular-nums">{result.inserted.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Sets</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center border border-border">
                <p className="text-2xl font-black text-chart-2 tabular-nums">{result.sessions.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Sessions</p>
              </div>
              <div className="bg-muted/40 rounded-xl p-3 text-center border border-border">
                <p className="text-2xl font-black text-chart-3 tabular-nums">{result.exercises.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">Exercises</p>
              </div>
            </div>
            {result.skipped > 0 && (
              <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/20 px-4 py-2 text-sm text-muted-foreground w-full max-w-sm justify-center">
                <Info className="w-4 h-4 shrink-0" />
                <span>{result.skipped.toLocaleString()} row{result.skipped !== 1 ? "s" : ""} skipped (cardio, warmup, or zero-weight sets)</span>
              </div>
            )}
            <div className="flex items-center gap-2 w-full max-w-sm justify-center">
              <Dumbbell className="w-4 h-4 text-chart-2" />
              <p className="text-xs text-muted-foreground">All charts and insights have been updated. Manually logged workouts were not affected.</p>
            </div>
            <Button variant="outline" onClick={handleReset} className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Import Another File
            </Button>
          </div>
        ) : step === "map" ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold">Required fields</p>
              </div>
              {REQUIRED_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">required</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                  <Select
                    value={mapping[key]}
                    onValueChange={(v) => updateMapping(key, v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Select column…" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* Weight unit toggle */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pl-0">
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Weight unit</span>
                  <p className="text-xs text-muted-foreground">Unit used in the weight column</p>
                </div>
                <span className="text-muted-foreground text-sm">→</span>
                <div className="flex rounded-md border border-border overflow-hidden w-full">
                  {(["kg", "lbs"] as const).map((unit, i) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => updateMapping("weightUnit", unit)}
                      className={`flex-1 py-2 text-sm font-medium transition-colors ${i > 0 ? "border-l border-border" : ""} ${mapping.weightUnit === unit ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-semibold text-muted-foreground">Optional filters</p>
              {OPTIONAL_FIELDS.map(({ key, label, hint }) => (
                <div key={key} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                  <div>
                    <span className="text-sm font-medium">{label}</span>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                  <span className="text-muted-foreground text-sm">→</span>
                  <Select
                    value={mapping[key] || NONE}
                    onValueChange={(v) => updateMapping(key, v === NONE ? "" : v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>— not in this file —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <Button
                className="flex-1"
                disabled={!canImport || uploadMutation.isPending}
                onClick={handleImport}
                data-testid="button-submit-csv"
              >
                {uploadMutation.isPending ? "Importing…" : "Import File"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-colors cursor-pointer ${
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleChange}
                className="hidden"
                data-testid="input-csv-upload"
              />
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <FileUp className="w-8 h-8" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-medium text-foreground">Click or drag a CSV file here</p>
                  <p className="text-sm text-muted-foreground">Any CSV format — you'll map the columns in the next step</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1 flex-1">
                  <p className="text-sm font-medium">Works out of the box with</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Strong", "Hevy", "FitNotes"].map((app) => (
                      <Badge key={app} variant="secondary" className="text-xs">{app}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground pt-0.5">
                    Needs columns for: date, exercise name, reps, weight. Warmup and multiplier columns are optional.
                    Workouts you've logged manually will not be overwritten.
                  </p>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-xs h-8 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); downloadSampleCsv(); }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download sample CSV
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
