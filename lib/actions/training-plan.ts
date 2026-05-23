'use server';

// ============================================================================
// Server Actions: Training Plans — V3 mit KI-Generator + Approval-Workflow
// HINWEIS: In 'use server' Files dürfen nur async functions exportiert werden.
// Types und Constants sind privat (nicht-exportiert).
// ============================================================================

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { callClaude } from '@/lib/claude';
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

export async function duplicateDay(
  dayId: string,
  customerId: string,
  options?: {
    weekday?: Weekday | null;
    time_of_day?: string | null;
  }
) {
  const supabase = createClient();

  const { data: srcDay, error: dayErr } = await supabase
    .from('training_days')
    .select('*, exercises(*)')
    .eq('id', dayId)
    .single();
  if (dayErr) throw dayErr;

  const { data: existing } = await supabase
    .from('training_days')
    .select('day_number, sort_order')
    .eq('plan_id', srcDay.plan_id)
    .order('day_number', { ascending: false })
    .limit(1);

  const nextNumber = (existing?.[0]?.day_number ?? 0) + 1;
  const nextSort = (existing?.[0]?.sort_order ?? -1) + 1;

  const targetWeekday =
    options?.weekday !== undefined ? options.weekday : srcDay.weekday;
  const targetTime =
    options?.time_of_day !== undefined ? options.time_of_day : srcDay.time_of_day;

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

// ============================================================================
// AI GENERATOR + APPROVAL WORKFLOW
// ============================================================================

// PRIVATE Types — NICHT exportieren (verboten in 'use server' files)
type GenerateOpts = {
  weeks: 4 | 8 | 12;
  daysPerWeek: 2 | 3 | 4 | 5 | 6;
  focus: 'strength' | 'hypertrophy' | 'general' | 'endurance' | 'custom';
  customPrompt?: string;
};

type GenerateResult =
  | { ok: true; planId: string }
  | { ok: false; error: string };

type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

const TRAINING_MODEL = 'claude-sonnet-4-6';
const TRAINING_MAX_TOKENS = 8192;

const TRAINING_SYSTEM_PROMPT = `Du bist ein professioneller Fitness-Coach. Du erstellst Trainingspläne basierend auf:
- Customer-Profile (Erfahrung, Equipment, Verletzungen, Ziel)
- Coach-Vorgaben (Dauer in Wochen, Tage pro Woche, Fokus)

REGELN:
1. Berücksichtige Equipment-Limits (kein Equipment → Bodyweight, Bänder, Hanteln → klassisches Training)
2. Berücksichtige Erfahrung: Anfänger → einfache Übungen, weniger Sätze; Fortgeschritten → mehr Volumen, anspruchsvollere Übungen
3. Berücksichtige Verletzungen / Einschränkungen aus den Notes strikt
4. Pro Tag 4-7 Übungen
5. Realistische Sätze/Wiederholungen entsprechend dem Fokus:
   - Kraft (strength): 3-5 Sätze, 3-6 Reps, lange Pausen (120-180s)
   - Hypertrophie: 3-4 Sätze, 8-12 Reps, Pausen 60-90s
   - Ausdauer (endurance): 2-3 Sätze, 15-20 Reps, kurze Pausen (30-60s)
   - Allgemein (general): Mix aus Kraft + Hypertrophie, 3 Sätze, 8-12 Reps
6. weight_type: "kg" (klassisches Gewichtstraining), "body" (Bodyweight), "band" (Widerstandsband). Wähle den passenden Typ pro Übung.
7. weight_kg: lass NULL — der Coach kennt den Kunden und setzt das Gewicht selbst
8. notes: optionale kurze Anweisung wie "langsame Exzentrik" oder "Range of Motion priorisieren"
9. Tag-Titel: prägnant wie "Push", "Pull", "Legs", "Oberkörper", "Ganzkörper A"
10. Tag-Untertitel: Muskelgruppen, z.B. "Brust, Schulter, Trizeps"
11. summary ist NUR FÜR DEN COACH — kurze professionelle Notiz zum Plan

ANTWORTE NUR VALID JSON, KOMPAKT, OHNE MARKDOWN, OHNE VORTEXT:

{"plan":{"name":"...","weeks":4},"days":[{"day_number":1,"title":"Push","subtitle":"Brust, Schulter, Trizeps","exercises":[{"name":"Bankdrücken","sets":4,"reps_min":6,"reps_max":8,"weight_type":"kg","rest_seconds":120,"notes":"Aufwärmen 2 Sätze"}]}],"summary":"..."}

Genau daysPerWeek Einträge in days[]. day_number läuft von 1 bis daysPerWeek.`;

function focusLabel(f: GenerateOpts['focus']): string {
  switch (f) {
    case 'strength': return 'Kraft (Strength)';
    case 'hypertrophy': return 'Muskelaufbau (Hypertrophie)';
    case 'general': return 'Allgemeine Fitness';
    case 'endurance': return 'Ausdauer';
    case 'custom': return 'Spezifisch (siehe Coach-Notiz)';
  }
}

function extractJson(text: string): any {
  try { return JSON.parse(text); } catch { /* */ }
  let cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { /* */ }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    cleaned = text.slice(first, last + 1);
    try { return JSON.parse(cleaned); } catch { /* */ }
    const noTrailing = cleaned
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    try { return JSON.parse(noTrailing); } catch { /* */ }
  }
  throw new Error('Kein gültiges JSON');
}

export async function generateTrainingPlan(
  customerId: string,
  opts: GenerateOpts
): Promise<GenerateResult> {
  if (!customerId) return { ok: false, error: 'Kunden-ID fehlt.' };
  if (![4, 8, 12].includes(opts.weeks)) return { ok: false, error: 'Ungültige Wochenanzahl.' };
  if (opts.daysPerWeek < 2 || opts.daysPerWeek > 6) return { ok: false, error: 'Ungültige Frequenz.' };

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!coach) return { ok: false, error: 'Kein Coach-Konto.' };

  const isAdmin = coach.role === 'admin';

  let customerCheck = supabase
    .from('customers')
    .select('id, first_name, telegram_username')
    .eq('id', customerId);
  if (!isAdmin) customerCheck = customerCheck.eq('coach_id', coach.id);
  const { data: customer } = await customerCheck.maybeSingle();
  if (!customer) return { ok: false, error: 'Kunde nicht gefunden oder keine Berechtigung.' };

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('age, gender, height_cm, weight_start_kg, weight_target_kg, goal, experience_level, equipment, allergies, notes')
    .eq('customer_id', customerId)
    .maybeSingle();

  const customerName = customer.first_name || customer.telegram_username || 'Kunde';
  const userPrompt = `Erstelle einen Trainingsplan für folgenden Kunden:

KUNDE: ${customerName}
- Alter: ${profile?.age ?? '—'} J · ${profile?.gender ?? '—'}
- Größe / Gewicht: ${profile?.height_cm ?? '—'} cm / ${profile?.weight_start_kg ?? '—'} kg → Ziel ${profile?.weight_target_kg ?? '—'} kg
- Trainingsziel: ${profile?.goal ?? '—'}
- Erfahrung: ${profile?.experience_level ?? '—'}
- Equipment: ${profile?.equipment ?? '—'}
- Notizen / Verletzungen: ${profile?.notes ?? 'Keine'}

COACH-VORGABEN:
- Dauer: ${opts.weeks} Wochen
- Frequenz: ${opts.daysPerWeek} Trainingstage pro Woche
- Fokus: ${focusLabel(opts.focus)}${opts.customPrompt ? '\n- Spezifische Coach-Notiz: ' + opts.customPrompt : ''}

Erstelle den Plan mit ${opts.daysPerWeek} Tagen. Antworte mit JSON gemäß System-Prompt.`;

  let aiResponse: string;
  try {
    aiResponse = await callClaude(
      [{ role: 'user', content: userPrompt }],
      {
        model: TRAINING_MODEL,
        maxTokens: TRAINING_MAX_TOKENS,
        system: TRAINING_SYSTEM_PROMPT,
        temperature: 0.7,
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `KI-Fehler: ${msg}` };
  }

  let parsed: any;
  try {
    parsed = extractJson(aiResponse);
  } catch {
    console.error('[generateTrainingPlan] Parse failed. Raw response:', aiResponse?.slice(0, 1000));
    try {
      aiResponse = await callClaude(
        [{ role: 'user', content: userPrompt }],
        {
          model: TRAINING_MODEL,
          maxTokens: TRAINING_MAX_TOKENS,
          system: TRAINING_SYSTEM_PROMPT + '\n\nWICHTIG: Antworte JETZT NUR mit validem JSON.',
          temperature: 0.2,
        }
      );
      parsed = extractJson(aiResponse);
    } catch (e2) {
      const preview = aiResponse?.slice(0, 200) ?? '(leer)';
      return { ok: false, error: `KI-Antwort nicht parsebar. Anfang: "${preview}…"` };
    }
  }

  if (!parsed?.plan?.name || !Array.isArray(parsed?.days)) {
    return { ok: false, error: 'Ungültige Plan-Struktur (fehlende days[] oder plan.name).' };
  }
  if (parsed.days.length !== opts.daysPerWeek) {
    return { ok: false, error: `Erwartet ${opts.daysPerWeek} Tage, KI hat ${parsed.days.length} geliefert.` };
  }

  await supabase
    .from('training_plans')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('customer_id', customerId)
    .in('status', ['draft', 'active', 'paused']);

  const planName = String(parsed.plan.name).slice(0, 80);
  const { data: newPlan, error: planErr } = await supabase
    .from('training_plans')
    .insert({
      customer_id: customerId,
      coach_id: coach.id,
      name: planName,
      weeks: opts.weeks,
      current_week: 1,
      status: 'draft',
      notify_telegram: true,
      notify_coach_telegram: false,
      reminder_minutes_before: 30,
    })
    .select()
    .single();
  if (planErr || !newPlan) return { ok: false, error: planErr?.message || 'Plan-Insert fehlgeschlagen.' };

  for (let i = 0; i < parsed.days.length; i++) {
    const day = parsed.days[i];
    const { data: newDay, error: dayErr } = await supabase
      .from('training_days')
      .insert({
        plan_id: newPlan.id,
        day_number: day.day_number ?? (i + 1),
        title: String(day.title || `Tag ${i + 1}`).slice(0, 60),
        subtitle: day.subtitle ? String(day.subtitle).slice(0, 120) : null,
        sort_order: i,
      })
      .select()
      .single();
    if (dayErr || !newDay) {
      console.error('[generateTrainingPlan] Day insert failed:', dayErr);
      continue;
    }

    const exercises = Array.isArray(day.exercises) ? day.exercises : [];
    if (exercises.length > 0) {
      const exInserts = exercises.map((e: any, idx: number) => {
        const wt = ['kg', 'body', 'band'].includes(e.weight_type) ? e.weight_type : 'kg';
        const sets = Number.isFinite(Number(e.sets)) ? Math.max(1, Math.min(20, Number(e.sets))) : 3;
        const repsMin = Number.isFinite(Number(e.reps_min)) ? Math.max(1, Math.min(100, Number(e.reps_min))) : 10;
        const repsMax = e.reps_max != null && Number.isFinite(Number(e.reps_max))
          ? Math.max(repsMin, Math.min(100, Number(e.reps_max)))
          : null;
        const rest = e.rest_seconds != null && Number.isFinite(Number(e.rest_seconds))
          ? Math.max(0, Math.min(600, Number(e.rest_seconds)))
          : null;
        return {
          day_id: newDay.id,
          sort_order: idx,
          name: String(e.name || 'Übung').slice(0, 80),
          sets,
          reps_min: repsMin,
          reps_max: repsMax,
          weight_kg: null,
          weight_type: wt,
          notes: e.notes ? String(e.notes).slice(0, 200) : null,
          rest_seconds: rest,
        };
      });
      const { error: exErr } = await supabase.from('exercises').insert(exInserts);
      if (exErr) console.error('[generateTrainingPlan] Exercise insert failed:', exErr);
    }
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true, planId: newPlan.id };
}

export async function activateTrainingPlan(
  planId: string,
  customerId: string
): Promise<ActionResult> {
  if (!planId || !customerId) return { ok: false, error: 'Fehlende Daten.' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!coach) return { ok: false, error: 'Kein Coach-Konto.' };

  const { data: plan } = await supabase
    .from('training_plans')
    .select('id, coach_id, customer_id, status')
    .eq('id', planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: 'Plan nicht gefunden.' };
  if (coach.role !== 'admin' && plan.coach_id !== coach.id) {
    return { ok: false, error: 'Keine Berechtigung.' };
  }
  if (plan.customer_id !== customerId) {
    return { ok: false, error: 'Plan gehört nicht zu diesem Kunden.' };
  }

  const { error } = await supabase
    .from('training_plans')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', planId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export async function discardTrainingPlan(
  planId: string,
  customerId: string
): Promise<ActionResult> {
  if (!planId || !customerId) return { ok: false, error: 'Fehlende Daten.' };

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!coach) return { ok: false, error: 'Kein Coach-Konto.' };

  const { data: plan } = await supabase
    .from('training_plans')
    .select('id, coach_id, customer_id')
    .eq('id', planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: 'Plan nicht gefunden.' };
  if (coach.role !== 'admin' && plan.coach_id !== coach.id) {
    return { ok: false, error: 'Keine Berechtigung.' };
  }
  if (plan.customer_id !== customerId) {
    return { ok: false, error: 'Plan gehört nicht zu diesem Kunden.' };
  }

  const { error } = await supabase.from('training_plans').delete().eq('id', plan.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}
