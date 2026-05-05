'use server';

// ============================================================================
// Server Actions: Training Plans
// 
// Alle Mutations gehen über Server Actions, damit RLS direkt vom Coach-Login
// aus greift und kein Service-Role-Key im Client liegt.
// ============================================================================

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { WeightType } from '@/lib/types/training';

// ----------------------------------------------------------------------------
// Helper: Coach-ID aus eingeloggtem User holen
// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------
// PLAN — anlegen / aktualisieren / löschen
// ----------------------------------------------------------------------------

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
  
  // Default: ein leerer Trainingstag
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
  updates: { name?: string; weeks?: number; current_week?: number; status?: string }
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

// ----------------------------------------------------------------------------
// DAY — anlegen / aktualisieren / löschen
// ----------------------------------------------------------------------------

export async function addDay(planId: string, customerId: string) {
  const supabase = createClient();
  
  // Aktuelle max day_number ermitteln
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
  updates: { title?: string; subtitle?: string | null }
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

// ----------------------------------------------------------------------------
// EXERCISE — anlegen / aktualisieren / löschen
// ----------------------------------------------------------------------------

export async function addExercise(dayId: string, customerId: string) {
  const supabase = createClient();
  
  // Aktuelle max sort_order
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
