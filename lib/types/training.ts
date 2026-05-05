// ============================================================================
// Trainingsplan Types
// ============================================================================

export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed';
export type WeightType = 'kg' | 'body' | 'band';

export interface Exercise {
  id: string;
  day_id: string;
  sort_order: number;
  name: string;
  sets: number;
  reps_min: number;
  reps_max: number | null;
  weight_kg: number | null;
  weight_type: WeightType;
  notes: string | null;
  rest_seconds: number | null;
  created_at: string;
}

export interface TrainingDay {
  id: string;
  plan_id: string;
  day_number: number;
  title: string;
  subtitle: string | null;
  sort_order: number;
  created_at: string;
  exercises: Exercise[];
}

export interface TrainingPlan {
  id: string;
  customer_id: string;
  coach_id: string;
  name: string;
  weeks: number;
  current_week: number;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
  days: TrainingDay[];
}

// Helper: Reps als String formatieren (z.B. "8-10" oder "8")
export function formatReps(reps_min: number, reps_max: number | null): string {
  if (reps_max && reps_max !== reps_min) {
    return `${reps_min}–${reps_max}`;
  }
  return `${reps_min}`;
}

// Helper: Gewicht formatieren
export function formatWeight(weight_kg: number | null, weight_type: WeightType): string {
  if (weight_type === 'body') return 'Body';
  if (weight_type === 'band') return 'Band';
  if (weight_kg === null) return '—';
  return `${weight_kg} kg`;
}
