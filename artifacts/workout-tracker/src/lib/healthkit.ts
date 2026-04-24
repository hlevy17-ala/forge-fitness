import { Capacitor, registerPlugin } from "@capacitor/core";

interface HealthKitPlugin {
  requestAuthorization(): Promise<{ authorized: boolean }>;
  saveWorkout(options: {
    startDate: string;
    endDate: string;
    calories: number;
  }): Promise<{ saved: boolean }>;
}

const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");

export async function requestHealthKitAuthorization(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await HealthKit.requestAuthorization();
    return result.authorized;
  } catch {
    return false;
  }
}

export async function saveWorkoutToHealthKit(opts: {
  startDate: Date;
  endDate: Date;
  calories: number;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const result = await HealthKit.saveWorkout({
      startDate: opts.startDate.toISOString(),
      endDate: opts.endDate.toISOString(),
      calories: opts.calories,
    });
    return result.saved;
  } catch (e) {
    console.error("HealthKit save failed:", e);
    return false;
  }
}
