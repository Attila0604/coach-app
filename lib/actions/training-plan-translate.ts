use server';

import { revalidatePath } from 'next/cache';
import { callClaude } from '@/lib/claude';
import { createClient } from '@/lib/supabase-server';

type ActionResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

type TargetLanguage = 'de' | 'it' | 'hu';

const TRANSLATE_MODEL = 'claude-sonnet-4-6';
const TRANSLATE_MAX_TOKENS = 8192;

function normalizeLanguage(value: unknown): TargetLanguage {
  return value === 'it' || value === 'hu' ? value : 'de';
}

function languageLabel(language: TargetLanguage): string {
  switch (language) {
    case 'it':
      return 'Italienisch';
    case 'hu':
      return 'Ungarisch';
    case 'de':
    default:
      return 'Deutsch';
  }
}

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // fallback below
  }

  let cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // fallback below
  }

  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');

  if (first !== -1 && last > first) {
    cleaned = text.slice(first, last + 1);

    try {
      return JSON.parse(cleaned);
    } catch {
      // fallback below
    }

    const noTrailing = cleaned
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');

    try {
      return JSON.parse(noTrailing);
    } catch {
      // final error below
    }
  }

  throw new Error('Kein gültiges JSON');
}

function compactText(value: unknown, fallback = ''): string {
  return String(value ?? fallback).trim();
}

export async function translateTrainingPlan(
  planId: string,
  customerId: string
): Promise<ActionResult> {
  if (!planId || !customerId) {
    return { ok: false, error: 'Fehlende Daten.' };
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Nicht angemeldet.' };
  }

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!coach) {
    return { ok: false, error: 'Kein Coach-Konto.' };
  }

  const { data: plan } = await supabase
    .from('training_plans')
    .select('id, coach_id, customer_id, name')
    .eq('id', planId)
    .maybeSingle();

  if (!plan) {
    return { ok: false, error: 'Plan nicht gefunden.' };
  }

  if (plan.customer_id !== customerId) {
    return { ok: false, error: 'Plan gehört nicht zu diesem Kunden.' };
  }

  if (coach.role !== 'admin' && plan.coach_id !== coach.id) {
    return { ok: false, error: 'Keine Berechtigung.' };
  }

  const { data: profile } = await supabase
    .from('customer_profiles')
    .select('language')
    .eq('customer_id', customerId)
    .maybeSingle();

  const targetLanguage = normalizeLanguage(profile?.language);
  const targetLabel = languageLabel(targetLanguage);

  const { data: daysRaw, error: daysErr } = await supabase
    .from('training_days')
    .select('id, day_number, title, subtitle, sort_order')
    .eq('plan_id', planId)
    .order('sort_order', { ascending: true });

  if (daysErr) {
    return { ok: false, error: daysErr.message };
  }

  const days = daysRaw ?? [];

  if (days.length === 0) {
    return { ok: false, error: 'Plan hat keine Trainingstage.' };
  }

  const dayIds = days.map((day) => day.id);

  const { data: exercisesRaw, error: exercisesErr } = await supabase
    .from('exercises')
    .select('id, day_id, name, notes, sort_order')
    .in('day_id', dayIds)
    .order('sort_order', { ascending: true });

  if (exercisesErr) {
    return { ok: false, error: exercisesErr.message };
  }

  const exercisesByDay = new Map<string, any[]>();

  for (const exercise of exercisesRaw ?? []) {
    if (!exercisesByDay.has(exercise.day_id)) {
      exercisesByDay.set(exercise.day_id, []);
    }

    exercisesByDay.get(exercise.day_id)!.push(exercise);
  }

  const payload = {
    plan: {
      id: plan.id,
      name: plan.name,
    },
    days: days.map((day) => ({
      id: day.id,
      day_number: day.day_number,
      title: day.title,
      subtitle: day.subtitle,
      exercises: (exercisesByDay.get(day.id) ?? []).map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        notes: exercise.notes,
      })),
    })),
  };

  const system = `Du bist ein präziser Übersetzer für Fitness- und Trainingspläne.

AUFGABE:
Übersetze ausschließlich die sichtbaren Textfelder eines Trainingsplans in die Zielsprache: ${targetLabel} (${targetLanguage}).

REGELN:
- Gib NUR valides JSON zurück.
- Keine Markdown-Fences, kein Vortext, keine Erklärung.
- IDs müssen exakt gleich bleiben.
- Struktur muss exakt gleich bleiben.
- Übersetze plan.name, days[].title, days[].subtitle, days[].exercises[].name, days[].exercises[].notes.
- Wenn ein Feld null ist, bleibt es null.
- Zahlen, Sätze, Wiederholungen, Pausen, Gewichte und IDs nicht verändern.
- Fitness-Fachbegriffe natürlich und kundenverständlich übersetzen.

ANTWORTFORMAT:
{"plan":{"id":"...","name":"..."},"days":[{"id":"...","title":"...","subtitle":"...","exercises":[{"id":"...","name":"...","notes":"..."}]}]}`;

  const userPrompt = `Übersetze diesen Trainingsplan nach ${targetLabel} (${targetLanguage}):

${JSON.stringify(payload)}`;

  let parsed: any;

  try {
    const aiResponse = await callClaude(
      [{ role: 'user', content: userPrompt }],
      {
        model: TRANSLATE_MODEL,
        maxTokens: TRANSLATE_MAX_TOKENS,
        system,
        temperature: 0.1,
      }
    );

    parsed = extractJson(aiResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Übersetzung fehlgeschlagen: ${msg}` };
  }

  if (!parsed?.plan?.id || !Array.isArray(parsed?.days)) {
    return { ok: false, error: 'KI-Antwort hat keine gültige Plan-Struktur.' };
  }

  if (parsed.plan.id !== planId) {
    return { ok: false, error: 'KI-Antwort passt nicht zum Plan.' };
  }

  const translatedDays = new Map<string, any>(
    parsed.days.map((day: any) => [day.id, day])
  );

  const translatedPlanName = compactText(parsed.plan.name, plan.name).slice(0, 80);

  if (translatedPlanName) {
    const { error } = await supabase
      .from('training_plans')
      .update({
        name: translatedPlanName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  for (const day of days) {
    const translatedDay = translatedDays.get(day.id);

    if (!translatedDay) continue;

    const { error: dayUpdateErr } = await supabase
      .from('training_days')
      .update({
        title: compactText(translatedDay.title, day.title).slice(0, 60),
        subtitle:
          translatedDay.subtitle == null
            ? null
            : compactText(translatedDay.subtitle, day.subtitle ?? '').slice(0, 120),
      })
      .eq('id', day.id);

    if (dayUpdateErr) {
      return { ok: false, error: dayUpdateErr.message };
    }

    const translatedExercises = new Map<string, any>(
      (Array.isArray(translatedDay.exercises)
        ? translatedDay.exercises
        : []
      ).map((exercise: any) => [exercise.id, exercise])
    );

    for (const exercise of exercisesByDay.get(day.id) ?? []) {
      const translatedExercise = translatedExercises.get(exercise.id);

      if (!translatedExercise) continue;

      const { error: exerciseUpdateErr } = await supabase
        .from('exercises')
        .update({
          name: compactText(translatedExercise.name, exercise.name).slice(0, 80),
          notes:
            translatedExercise.notes == null
              ? null
              : compactText(translatedExercise.notes, exercise.notes ?? '').slice(
                  0,
                  200
                ),
        })
        .eq('id', exercise.id);

      if (exerciseUpdateErr) {
        return { ok: false, error: exerciseUpdateErr.message };
      }
    }
  }

  revalidatePath(`/customers/${customerId}`);
  revalidatePath(`/coach/customers/${customerId}`);

  return {
    ok: true,
    message: `Trainingsplan wurde nach ${targetLabel} übersetzt.`,
  };
}
