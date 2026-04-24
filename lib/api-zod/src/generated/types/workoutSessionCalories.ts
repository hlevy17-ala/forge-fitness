export interface WorkoutSessionCalories {
  /** Workout date (YYYY-MM-DD) */
  date: string;
  /** @nullable */
  durationMinutes: number | null;
  /** @nullable */
  caloriesBurned: number | null;
}
