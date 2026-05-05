// ============================================================================
// Trainingsplan Types — V2 mit Kalender-Feldern
// ============================================================================

export type PlanStatus = 'draft' | 'active' | 'paused' | 'completed';
export type WeightType = 'kg' | 'body' | 'band';

// 0 = Montag, 1 = Dienstag, ..., 6 = Sonntag (ISO-Standard)
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAYS: { value: Weekday; short: string; long: string }[] = [
  { value: 0, short: 'Mo', long: 'Montag' },
  { value: 1, short: 'Di', long: 'Dienstag' },
  { value: 2, short: 'Mi', long: 'Mittwoch' },
  { value: 3, short: 'Do', long: 'Donnerstag' },
  { value: 4, short: 'Fr', long: 'Freitag' },
  { value: 5, short: 'Sa', long: 'Samstag' },
  { value: 6, short: 'So', long: 'Sonntag' },
];

export const REMINDER_OPTIONS = [
  { value: 0,    label: 'Pünktlich' },
  { value: 15,   label: '15 Min vorher' },
  { value: 30,   label: '30 Min vorher' },
  { value: 60,   label: '1 Std vorher' },
  { value: 120,  label: '2 Std vorher' },
  { value: 360,  label: '6 Std vorher' },
  { value: 720,  label: '12 Std vorher' },
  { value: 1440, label: '1 Tag vorher' },
];

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
  weekday: Weekday | null;
  time_of_day: string | null;
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
  start_date: string | null;
  notify_telegram: boolean;
  notify_coach_telegram: boolean;
  reminder_minutes_before: number;
  created_at: string;
  updated_at: string;
  days: TrainingDay[];
}

// ============================================================================
// Helper Functions
// ============================================================================

export function formatReps(reps_min: number, reps_max: number | null): string {
  if (reps_max && reps_max !== reps_min) {
    return `${reps_min}–${reps_max}`;
  }
  return `${reps_min}`;
}

export function formatWeight(weight_kg: number | null, weight_type: WeightType): string {
  if (weight_type === 'body') return 'Body';
  if (weight_type === 'band') return 'Band';
  if (weight_kg === null) return '—';
  return `${weight_kg} kg`;
}

export function formatWeekdayShort(weekday: Weekday | null): string {
  if (weekday === null) return '—';
  return WEEKDAYS[weekday]?.short ?? '—';
}

export function formatTime(timeOfDay: string | null): string {
  if (!timeOfDay) return '—';
  return timeOfDay.slice(0, 5);
}

export function formatTrainingSchedule(
  days: { weekday: Weekday | null; time_of_day: string | null }[]
): string {
  const scheduled = days
    .filter(d => d.weekday !== null)
    .sort((a, b) => (a.weekday ?? 0) - (b.weekday ?? 0));
  
  if (scheduled.length === 0) return 'Noch nicht geplant';
  
  const labels = scheduled.map(d => formatWeekdayShort(d.weekday!));
  return labels.join(' · ');
}
