'use server';

// ============================================================================
// Server Actions: Training Plans — V2.1 mit Duplizier-Dialog-Support
// ============================================================================

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { WeightType, Weekday } from '@/lib/types/training';

async function getCoachId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Nicht angemeldet');
  
  const { data: coach } = await supabase
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (!coach) throw new Error('Coach nicht gefunden');
  
  return coach.id as string;
}

// ============================================================================
// PLAN
// ============================================================================

export async function createPlan(customerId: string) {
  const supabase = createClient();
  const coachId = await getCoachId();
  
  const { data: plan, error } = await supabase
    .from('training_plans')
    .insert({
      customer_id: customerId,
      coach_id: coachId,
      name: 'Neuer Plan',
      weeks: 4,
      current_week: 1,
      status: 'draft',
    })
    .select()
    .single();
  if (error) throw error;
  
  await supabase.from('training_days').insert({
    plan_id: plan.id,
    day_number: 1,
    title: 'Tag 1',
    sort_order: 0,
  });
  
  revalidatePath(`/customers/${customerId}`);
  return plan;
}

export async function updatePlan(
  planId: string,
  customerId: string,
  updates: {
    name?: string;
    weeks?: number;
    current_week?: number;
    status?: string;
    start_date?: string | null;
    notify_telegram?: boolean;
    notify_coach_telegram?: boolean;
    reminder_minutes_before?: number;
  }
) {
  const supabase = createClient();
  const { error } = await supabase
    .from('training_plans')
    .update(updates)
    .eq('id', planId);
  if (error) throw error;
  revalidatePath(`/customers/${customerId}`);
}

export async function deletePlan(planId: string, customerId: string) {
  const supabase = createClient();
  const { error } = await supabase.from('training_plans').delete().eq('id', planId);
  if (error) throw error;
  revalidatePath(`/customers/${customerId}`);
}

// ============================================================================
// DAY
// ============================================================================

export async function addDay(planId: string, customerId: string) {
  const supabase = createClient();
  
  const { data: existing } = await supabase
    .from('training_days')
    .select('day_number, sort_order')
    .eq('plan_id', planId)
    .order('day_number', { ascending: false })
    .limit(1);
  
  const nextNumber = (existing?.[0]?.day_number ?? 0) + 1;
  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;
  
  const { data: day, error } = await supabase
    .from('training_days')
    .insert({
      plan_id: planId,
      day_number: nextNumber,
      title: `Tag ${nextNumber}`,
      sort_order: nextSort,
    })
    .select()
    .single();
  if (error) throw error;
  
  revalidatePath(`/customers/${customerId}`);
  return day;
}

export async function updateDay(
  dayId: string,
  customerId: string,
  updates: {
    title?: string;
    subtitle?: string | null;
    weekday?: Weekday | null;
    time_of_day?: string | null;
  }
) {
  const supabase = createClient();
  const { error } = await supabase.from('training_days').update(updates).eq('id', dayId);
  if (error) throw error;
  revalidatePath(`/customers/${customerId}`);
}

export async function deleteDay(dayId: string, customerId: string) {
  const supabase = createClient();
  const { error } = await supabase.from('training_days').delete().eq('id', dayId);
  if (error) throw error;
  revalidatePath(`/customers/${customerId}`);
}

// Tag mit allen Übungen duplizieren — Wochentag + Uhrzeit werden vom Aufrufer gesetzt
export async function duplicateDay(
  dayId: string,
  customerId: string,
  options?: {
    weekday?: Weekday | null;
    time_of_day?: string | null;
  }
) {
  const supabase = createClient();
  
  // Quell-Tag laden
  const { data: srcDay, error: dayErr } = await supabase
    .from('training_days')
    .select('*, exercises(*)')
    .eq('id', dayId)
    .single();
  if (dayErr) throw dayErr;
  
  // Höchste day_number im Plan ermitteln
  const { data: existing } = await supabase
    .from('training_days')
    .select('day_number, sort_order')
    .eq('plan_id', srcDay.plan_id)
    .order('day_number', { ascending: false })
    .limit(1);
  
  const nextNumber = (existing?.[0]?.day_number ?? 0) + 1;
  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;
  
  // Wochentag + Uhrzeit: aus options ODER vom Quell-Tag übernehmen
  const targetWeekday =
    options?.weekday !== undefined ? options.weekday : srcDay.weekday;
  const targetTime =
    options?.time_of_day !== undefined ? options.time_of_day : srcDay.time_of_day;
  
  // Neuen Tag anlegen
  const { data: newDay, error: insErr } = await supabase
    .from('training_days')
    .insert({
      plan_id: srcDay.plan_id,
      day_number: nextNumber,
      title: srcDay.title,
      subtitle: srcDay.subtitle,
      weekday: targetWeekday,
      time_of_day: targetTime,
      sort_order: nextSort,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  
  // Alle Übungen kopieren
  const exercises = (srcDay.exercises ?? []) as any[];
  if (exercises.length > 0) {
    const exerciseInserts = exercises.map(e => ({
      day_id: newDay.id,
      sort_order: e.sort_order,
      name: e.name,
      sets: e.sets,
      reps_min: e.reps_min,
      reps_max: e.reps_max,
      weight_kg: e.weight_kg,
      weight_type: e.weight_type,
      notes: e.notes,
      rest_seconds: e.rest_seconds,
    }));
    const { error: exErr } = await supabase.from('exercises').insert(exerciseInserts);
    if (exErr) throw exErr;
  }
  
  revalidatePath(`/customers/${customerId}`);
  return newDay;
}

// ============================================================================
// EXERCISE
// ============================================================================

export async function addExercise(dayId: string, customerId: string) {
  const supabase = createClient();
  
  const { data: existing } = await supabase
    .from('exercises')
    .select('sort_order')
    .eq('day_id', dayId)
    .order('sort_order', { ascending: false })
    .limit(1);
  
  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;
  
  const { data: ex, error } = await supabase
    .from('exercises')
    .insert({
      day_id: dayId,
      sort_order: nextSort,
      name: 'Neue Übung',
      sets: 3,
      reps_min: 10,
      reps_max: null,
      weight_kg: null,
      weight_type: 'kg',
    })
    .select()
    .single();
  if (error) throw error;
  
  revalidatePath(`/customers/${customerId}`);
  return ex;
}

export async function updateExercise(
  exerciseId: string,
  customerId: string,
  updates: {
    name?: string;
    sets?: number;
    reps_min?: number;
    reps_max?: number | null;
    weight_kg?: number | null;
    weight_type?: WeightType;
    notes?: string | null;
    rest_seconds?: number | null;
  }
) {
  const supabase = createClient();
  const { error } = await supabase.from('exercises').update(updates).eq('id', exerciseId);
  if (error) throw error;
  revalidatePath(`/customers/${customerId}`);
}

export async function deleteExercise(exerciseId: string, customerId: string) {
  const supabase = createClient();
  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
  if (error) throw error;
  revalidatePath(`/customers/${customerId}`);
}

export async function duplicateExercise(exerciseId: string, customerId: string) {
  const supabase = createClient();
  
  const { data: src, error: srcErr } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', exerciseId)
    .single();
  if (srcErr) throw srcErr;
  
  const { data: laterExercises } = await supabase
    .from('exercises')
    .select('id, sort_order')
    .eq('day_id', src.day_id)
    .gt('sort_order', src.sort_order)
    .order('sort_order', { ascending: true });
  
  if (laterExercises && laterExercises.length > 0) {
    for (const ex of laterExercises) {
      await supabase
        .from('exercises')
        .update({ sort_order: ex.sort_order + 1 })
        .eq('id', ex.id);
    }
  }
  
  const { data: copy, error: insErr } = await supabase
    .from('exercises')
    .insert({
      day_id: src.day_id,
      sort_order: src.sort_order + 1,
      name: src.name,
      sets: src.sets,
      reps_min: src.reps_min,
      reps_max: src.reps_max,
      weight_kg: src.weight_kg,
      weight_type: src.weight_type,
      notes: src.notes,
      rest_seconds: src.rest_seconds,
    })
    .select()
    .single();
  if (insErr) throw insErr;
  
  revalidatePath(`/customers/${customerId}`);
  return copy;
}

export async function moveExercise(
  exerciseId: string,
  customerId: string,
  direction: 'up' | 'down'
) {
  const supabase = createClient();
  
  const { data: ex, error: exErr } = await supabase
    .from('exercises')
    .select('id, day_id, sort_order')
    .eq('id', exerciseId)
    .single();
  if (exErr) throw exErr;
  
  const { data: neighbor } = await supabase
    .from('exercises')
    .select('id, sort_order')
    .eq('day_id', ex.day_id)
    .order('sort_order', { ascending: direction === 'up' })
    [direction === 'up' ? 'lt' : 'gt']('sort_order', ex.sort_order)
    .limit(1)
    .maybeSingle();
  
  if (!neighbor) return;
  
  await supabase
    .from('exercises')
    .update({ sort_order: neighbor.sort_order })
    .eq('id', ex.id);
  await supabase
    .from('exercises')
    .update({ sort_order: ex.sort_order })
    .eq('id', neighbor.id);
  
  revalidatePath(`/customers/${customerId}`);
}
