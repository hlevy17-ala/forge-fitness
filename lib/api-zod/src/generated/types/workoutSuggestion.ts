export interface WorkoutSuggestion {
  /** Exercise name */
  exercise: string;
  /** Suggested weight in lbs for next session */
  suggestedWeightLbs: number;
  /** Current (last session) average weight in lbs */
  currentWeightLbs: number;
  /** Reason for the suggestion */
  reason: string;
}
