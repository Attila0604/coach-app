import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase-server';

export const TZ = 'Europe/Vienna';

export const STATUS_LABELS: Record<string, string> = {
  active: 'Aktiv',
  intake: 'Onboarding',
  paused: 'Pausiert',
  archived: 'Archiviert',
};

export const GOAL_LABELS: Record<string, string> = {
  endurance: 'Ausdauer',
  ausdauer: 'Ausdauer',
  strength: 'Kraft',
  kraft: 'Kraft',
  weight_loss: 'Abnehmen',
  abnehmen: 'Abnehmen',
  muscle_gain: 'Muskelaufbau',
  aufbau: 'Muskelaufbau',
  maintenance: 'Erhalt',
  erhalt: 'Erhalt',
  health: 'Gesundheit',
};

export function labelGoal(g: string | null): string {
  if (!g) return '—';
  return GOAL_LABELS[g.toLowerCase()] ?? g;
}

export function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function viennaDay(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

export function buildWindow() {
  const todayKey = viennaDay(new Date());
  const anchor = new Date(`${todayKey}T12:00:00Z`);
  const dayKeys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(anchor);
    d.setUTCDate(anchor.getUTCDate() - i);
    dayKeys.push(viennaDay(d));
  }
  const queryFrom = new Date();
  queryFrom.setUTCDate(queryFrom.getUTCDate() - 31);
  queryFrom.setUTCHours(0, 0, 0, 0);
  return { dayKeys, todayKey, queryFrom };
}

export function computeStreak(
  days30: Array<{ date: string; logCount: number }>
): number {
  let streak = 0;
  for (let i = days30.length - 1; i >= 0; i--) {
    if (days30[i].logCount > 0) streak++;
    else break;
  }
  return streak;
}

// Auth + Customer + Coach laden — gemeinsam für alle 4 Pages
export async function getCustomerForCoach(customerId: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!coach) notFound();

  const isAdmin = coach.role === 'admin';

  let customerQuery = supabase
    .from('customers')
    .select(
      'id, first_name, telegram_username, telegram_chat_id, status, onboarded_at, created_at, coach_id'
    )
    .eq('id', customerId);

  if (!isAdmin) {
    customerQuery = customerQuery.eq('coach_id', coach.id);
  }

  const { data: customer } = await customerQuery.maybeSingle();
  if (!customer) notFound();

  return { supabase, coach, customer, isAdmin };
}
