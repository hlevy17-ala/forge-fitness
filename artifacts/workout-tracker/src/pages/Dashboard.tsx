import { useState } from "react";
import { Dumbbell, Activity, Scale, Upload, Flame, BarChart2, Plus, History, AlertTriangle, Download, LogOut, BookMarked } from "lucide-react";
import { ForgeIcon } from "@/components/ForgeIcon";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CsvUpload } from "@/components/CsvUpload";
import { ExerciseProgress } from "@/components/ExerciseProgress";
import { MuscleGroupProgress } from "@/components/MuscleGroupProgress";
import { BodyMetrics } from "@/components/BodyMetrics";
import { CalorieTracker } from "@/components/CalorieTracker";
import { InsightsTab } from "@/components/insights/InsightsTab";
import { LogWorkoutModal } from "@/components/LogWorkoutModal";
import { SessionHistoryModal } from "@/components/SessionHistoryModal";
import { TemplatesModal } from "@/components/TemplatesModal";
import { useGetWorkoutSessions } from "@workspace/api-client-react";
import type { CardioTemplateItem } from "@workspace/api-client-react";

function daysSince(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export default function Dashboard() {
  const [logOpen, setLogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [initialStrengthTemplateId, setInitialStrengthTemplateId] = useState<number | null>(null);
  const [initialCardioTemplate, setInitialCardioTemplate] = useState<CardioTemplateItem | null>(null);
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const handleUseStrengthTemplate = (id: number) => {
    setInitialStrengthTemplateId(id);
    setInitialCardioTemplate(null);
    setLogOpen(true);
  };

  const handleUseCardioTemplate = (template: CardioTemplateItem) => {
    setInitialCardioTemplate(template);
    setInitialStrengthTemplateId(null);
    setLogOpen(true);
  };

  const { data: sessions = [] } = useGetWorkoutSessions();
  const lastDate = sessions[0]?.date ?? null;
  const restDays = lastDate ? daysSince(lastDate) : null;
  const showRestBanner = restDays !== null && restDays > 5;

  const handleExportCsv = () => {
    window.open("/api/workouts/export.csv", "_blank");
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ForgeIcon className="w-7 h-7 text-primary" />
            <span className="font-sans font-extrabold text-xl tracking-widest uppercase text-foreground">Forge</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={logout}
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              title="Log out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setTemplatesOpen(true)}
              variant="outline"
              className="border-border text-foreground hover:bg-muted gap-2"
              size="sm"
              title="Templates"
            >
              <BookMarked className="w-4 h-4" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
            <Button
              onClick={() => setHistoryOpen(true)}
              variant="outline"
              className="border-border text-foreground hover:bg-muted gap-2"
              size="sm"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Button>
            <Button
              onClick={() => setLogOpen(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
              size="sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Log Workout</span>
              <span className="sm:hidden">Log</span>
            </Button>
          </div>
        </div>
      </header>

      <LogWorkoutModal
        open={logOpen}
        onClose={() => { setLogOpen(false); setInitialStrengthTemplateId(null); setInitialCardioTemplate(null); }}
        initialStrengthTemplateId={initialStrengthTemplateId}
        initialCardioTemplate={initialCardioTemplate}
      />
      <SessionHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
      <TemplatesModal
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onUseStrengthTemplate={handleUseStrengthTemplate}
        onUseCardioTemplate={handleUseCardioTemplate}
      />

      <main className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8 space-y-4">
        {user?.isGuest && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-primary/30 bg-primary/10">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Your data is only on this device</p>
              <p className="text-xs text-muted-foreground mt-0.5">Create a free account to back up and sync across devices.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setLocation("/login")}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 text-xs h-7"
            >
              Back up
            </Button>
          </div>
        )}

        {showRestBanner && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <p className="text-sm font-medium">
              {restDays === 1 ? "It's been 1 day" : `It's been ${restDays} days`} since your last session ({lastDate}). Time to train!
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLogOpen(true)}
              className="ml-auto border-yellow-500/50 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 shrink-0 text-xs h-7"
            >
              Log now
            </Button>
          </div>
        )}

        <Tabs defaultValue="insights" className="w-full">
          <TabsList className="grid grid-cols-6 w-full h-auto p-1 bg-muted/40 rounded-xl border border-border">
            <TabsTrigger value="insights" className="py-3 rounded-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <BarChart2 className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Insights</span>
            </TabsTrigger>
            <TabsTrigger value="exercises" className="py-3 rounded-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Dumbbell className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Exercises</span>
            </TabsTrigger>
            <TabsTrigger value="muscles" className="py-3 rounded-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Activity className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Muscle Groups</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="py-3 rounded-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Scale className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Biometrics</span>
            </TabsTrigger>
            <TabsTrigger value="nutrition" className="py-3 rounded-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Flame className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nutrition</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="py-3 rounded-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all">
              <Upload className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="insights" className="animate-in fade-in-50 zoom-in-95 duration-200">
              <InsightsTab />
            </TabsContent>

            <TabsContent value="exercises" className="animate-in fade-in-50 zoom-in-95 duration-200">
              <ExerciseProgress />
            </TabsContent>

            <TabsContent value="muscles" className="animate-in fade-in-50 zoom-in-95 duration-200">
              <MuscleGroupProgress />
            </TabsContent>

            <TabsContent value="metrics" className="animate-in fade-in-50 zoom-in-95 duration-200">
              <BodyMetrics />
            </TabsContent>

            <TabsContent value="nutrition" className="animate-in fade-in-50 zoom-in-95 duration-200">
              <CalorieTracker />
            </TabsContent>

            <TabsContent value="upload" className="animate-in fade-in-50 zoom-in-95 duration-200">
              <div className="max-w-2xl mx-auto">
                <div className="mb-6 text-center">
                  <h2 className="text-2xl font-bold tracking-tight">Data Synchronization</h2>
                  <p className="text-muted-foreground mt-2">Import your raw training logs to update the visualization engine.</p>
                </div>
                <CsvUpload />
                <div className="mt-6 pt-6 border-t border-border text-center">
                  <p className="text-sm text-muted-foreground mb-3">Export all your workout data as a CSV file.</p>
                  <Button
                    variant="outline"
                    onClick={handleExportCsv}
                    className="border-border text-foreground hover:bg-muted gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export workouts.csv
                  </Button>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
}
