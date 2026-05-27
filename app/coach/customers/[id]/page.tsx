import Link from 'next/link';
import { getCustomerForCoach, viennaDay, TZ } from '@/lib/coach-customer-helpers';

const NAV_CARDS = [
  { href: 'profile', label: 'Profil', subtitle: 'Tagesziele & Notizen' },
  { href: 'nutrition', label: 'Ernährung', subtitle: 'Food-Library + Wochenplan' },
  { href: 'training', label: 'Training', subtitle: 'KI-Generator + Editor' },
  { href: 'activity', label: 'Aktivität', subtitle: 'Verlauf & Nachrichten' },
];

const MEAL_TYPE_LABELS: Record<string, string> = {
  fruehstueck: 'Frühstück',
  frühstück: 'Frühstück',
  breakfast: 'Frühstück',
  mittag: 'Mittag',
  lunch: 'Mittag',
  abend: 'Abend',
  abendessen: 'Abend',
  dinner: 'Abend',
  snack: 'Snack',
  snk: 'Snack',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktiv',
  onboarding: 'Im Intake',
  paused: 'Pausiert',
  inactive: 'Inaktiv',
};

function formatTodayHeader(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
}

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min`;
  if (diffH < 24) return `vor ${diffH} Std`;
  if (diffD === 1) return 'gestern';
  if (diffD < 7) return `vor ${diffD} Tagen`;
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function formatOnboardedDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  });
}

type RecentItem = {
  id: string;
  kind: 'meal' | 'workout' | 'message';
  iso: string;
  title: string;
  subtitle?: string;
};

export default async function CustomerOverviewPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, customer } = await getCustomerForCoach(params.id);

  const todayKey = viennaDay(new Date());
  const startOfToday = new Date(`${todayKey}T00:00:00+02:00`);
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);

  const [
    profileRes,
    todayFoodRes,
    todayWorkoutsRes,
    todayPlanRes,
    coachNotesRes,
    recentFoodRes,
    recentWorkoutsRes,
    recentMessagesRes,
  ] = await Promise.all([
    supabase
      .from('customer_profiles')
      .select('daily_kcal_target')
      .eq('customer_id', params.id)
      .maybeSingle(),
    supabase
      .from('food_logs')
      .select('id, logged_at, meal_type, raw_description, total_kcal')
      .eq('customer_id', params.id)
      .gte('logged_at', startOfToday.toISOString())
      .order('logged_at', { ascending: false }),
    supabase
      .from('workout_sessions')
      .select(
        'id, status, started_at, training_days(day_number, title)'
      )
      .eq('customer_id', params.id)
      .gte('started_at', startOfToday.toISOString())
      .order('started_at', { ascending: false }),
    supabase
      .from('meal_plans')
      .select('plan_date, total_kcal, status')
      .eq('customer_id', params.id)
      .eq('plan_date', todayKey)
      .eq('status', 'published')
      .maybeSingle(),
    supabase
      .from('coach_notes')
      .select('id, content, updated_at')
      .or(`customer_id.eq.${params.id},customer_id.is.null`)
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase
      .from('food_logs')
      .select('id, logged_at, meal_type, raw_description, total_kcal')
      .eq('customer_id', params.id)
      .order('logged_at', { ascending: false })
      .limit(5),
    supabase
      .from('workout_sessions')
      .select(
        'id, started_at, status, training_days(day_number, title)'
      )
      .eq('customer_id', params.id)
      .order('started_at', { ascending: false })
      .limit(5),
    supabase
      .from('messages')
      .select('id, created_at, direction, content, agent_name')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const profile = profileRes.data;
  const todayFood = todayFoodRes.data ?? [];
  const todayWorkouts = todayWorkoutsRes.data ?? [];
  const todayPlan = todayPlanRes.data;
  const coachNote = coachNotesRes.data?.[0];

  const todayKcal = Math.round(
    todayFood.reduce((sum, l) => sum + (Number(l.total_kcal) || 0), 0)
  );
  const kcalTarget = profile?.daily_kcal_target ?? null;
  const kcalPercent =
    kcalTarget && kcalTarget > 0
      ? Math.round((todayKcal / kcalTarget) * 100)
      : null;

  const lastCompletedWorkout = todayWorkouts.find(
    (w: any) => w.status === 'completed'
  );
  const lastWorkout: any = lastCompletedWorkout || todayWorkouts[0];

  // === Recent activity (merge + sort) ===
  const recentItems: RecentItem[] = [
    ...(recentFoodRes.data ?? []).map((l): RecentItem => ({
      id: `meal-${l.id}`,
      kind: 'meal',
      iso: l.logged_at,
      title: l.raw_description ?? 'Mahlzeit',
      subtitle: l.total_kcal != null ? `${l.total_kcal} kcal` : undefined,
    })),
    ...((recentWorkoutsRes.data ?? []) as any[]).map((w): RecentItem => {
      const day = w.training_days;
      const statusLabel =
        w.status === 'completed' ? 'abgeschlossen'
        : w.status === 'aborted' ? 'abgebrochen'
        : w.status === 'paused' ? 'pausiert'
        : 'läuft';
      return {
        id: `workout-${w.id}`,
        kind: 'workout',
        iso: w.started_at,
        title: day
          ? `Tag ${day.day_number} · ${day.title} ${statusLabel}`
          : `Workout ${statusLabel}`,
      };
    }),
    ...(recentMessagesRes.data ?? []).map((m): RecentItem => {
      const isOutbound =
        m.direction === 'outbound' || m.direction === 'out';
      return {
        id: `msg-${m.id}`,
        kind: 'message',
        iso: m.created_at,
        title: isOutbound
          ? `${m.agent_name ?? 'Bot'} →`
          : '← Kunde',
        subtitle:
          (m.content ?? '').substring(0, 80) +
          ((m.content ?? '').length > 80 ? '…' : ''),
      };
    }),
  ]
    .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
    .slice(0, 3);

  const lastActivityIso = recentItems[0]?.iso ?? null;

  const displayName =
    customer.first_name || customer.telegram_username || 'Kunde';
  const username = customer.telegram_username
    ? `@${customer.telegram_username}`
    : null;
  const statusLabel = STATUS_LABEL[customer.status] || customer.status;
  const onboardedDate = formatOnboardedDate(
    (customer as any).onboarded_at ?? (customer as any).created_at ?? null
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <Link
        href="/coach/customers"
        className="text-[11px] uppercase tracking-caps text-bone-faint hover:text-bone-muted transition mb-8 inline-flex items-center gap-2"
      >
        ← Kunden
      </Link>

      {/* === HEADER === */}
      <header className="mb-10 flex items-start justify-between gap-6 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-bone leading-tight mb-2">
            {displayName}
          </h1>
          <p className="text-sm text-bone-muted">
            {username && <>{username} · </>}
            {onboardedDate && <>seit {onboardedDate}</>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-right">
          <span className="text-[10px] uppercase tracking-caps text-gold font-medium px-3 py-1.5 border border-gold/40">
            {statusLabel}
          </span>
          {lastActivityIso && (
            <span className="text-[11px] text-bone-faint">
              letzte Aktivität: {formatRelative(lastActivityIso)}
            </span>
          )}
        </div>
      </header>

      {/* === HEUTE (3 Cards) === */}
      <section className="mb-12">
        <p className="text-[10px] tracking-caps uppercase text-gold font-medium mb-5">
          Heute · {formatTodayHeader()}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* KCAL */}
          <div className="border border-white/[0.08] px-5 py-5 bg-black/20">
            <p className="text-[9px] tracking-caps uppercase text-bone-faint font-medium mb-2">
              Kalorien
            </p>
            <p className="font-serif text-3xl tabular-nums text-bone">
              {todayKcal}
              {kcalTarget && (
                <span className="text-base text-bone-faint">
                  {' '}/ {kcalTarget}
                </span>
              )}
            </p>
            <p className="text-[11px] text-bone-faint mt-1 tabular-nums">
              {todayFood.length === 0
                ? 'keine Mahlzeit'
                : kcalPercent != null
                ? `${kcalPercent}% des Ziels · ${todayFood.length} ${
                    todayFood.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'
                  }`
                : `${todayFood.length} ${
                    todayFood.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'
                  }`}
            </p>
          </div>

          {/* WORKOUT */}
          <div className="border border-white/[0.08] px-5 py-5 bg-black/20">
            <p className="text-[9px] tracking-caps uppercase text-bone-faint font-medium mb-2">
              Workout
            </p>
            {lastWorkout ? (
              <>
                <p className="font-serif text-3xl tabular-nums text-bone">💪</p>
                <p className="text-[11px] text-bone-faint mt-1">
                  {lastWorkout.training_days
                    ? `Tag ${lastWorkout.training_days.day_number} · ${
                        lastWorkout.status === 'completed'
                          ? 'abgeschlossen'
                          : lastWorkout.status === 'aborted'
                          ? 'abgebrochen'
                          : 'läuft'
                      }`
                    : lastWorkout.status}
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-3xl tabular-nums text-bone-faint">
                  —
                </p>
                <p className="text-[11px] text-bone-faint mt-1 italic">
                  heute keins
                </p>
              </>
            )}
          </div>

          {/* PLAN */}
          <div
            className={`border ${
              todayPlan ? 'border-gold/40' : 'border-white/[0.08]'
            } px-5 py-5 bg-black/20`}
          >
            <p className="text-[9px] tracking-caps uppercase text-bone-faint font-medium mb-2">
              Meal-Plan
            </p>
            {todayPlan ? (
              <>
                <p className="font-serif text-3xl tabular-nums text-gold">
                  ✓
                </p>
                <p className="text-[11px] text-bone-faint mt-1 tabular-nums">
                  {todayPlan.total_kcal != null
                    ? `${todayPlan.total_kcal} kcal geplant`
                    : 'aktiv für heute'}
                </p>
              </>
            ) : (
              <>
                <p className="font-serif text-3xl tabular-nums text-bone-faint">
                  —
                </p>
                <p className="text-[11px] text-bone-faint mt-1 italic">
                  kein Plan
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* === COACH-NOTIZ === */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[10px] tracking-caps uppercase text-gold font-medium">
            Coach-Notiz
          </p>
          <Link
            href={`/coach/customers/${params.id}/profile`}
            className="text-[10px] uppercase tracking-caps text-bone-faint hover:text-gold transition font-medium"
          >
            → bearbeiten
          </Link>
        </div>
        {coachNote ? (
          <p className="font-serif text-xl text-bone-muted leading-relaxed italic">
            &ldquo;{coachNote.content}&rdquo;
          </p>
        ) : (
          <p className="text-sm text-bone-faint italic">
            Noch keine Notiz hinterlegt.
          </p>
        )}
      </section>

      {/* === LETZTE AKTIVITÄT === */}
      <section className="mb-12">
        <div className="flex items-baseline justify-between mb-5">
          <p className="text-[10px] tracking-caps uppercase text-gold font-medium">
            Letzte Aktivität
          </p>
          <Link
            href={`/coach/customers/${params.id}/activity`}
            className="text-[10px] uppercase tracking-caps text-bone-faint hover:text-gold transition font-medium"
          >
            → alle anzeigen
          </Link>
        </div>
        {recentItems.length === 0 ? (
          <p className="text-sm text-bone-faint italic">
            Noch keine Aktivität.
          </p>
        ) : (
          <ul className="space-y-3">
            {recentItems.map((item) => (
              <li key={item.id} className="flex gap-3 items-baseline">
                <span className="text-base">
                  {item.kind === 'meal'
                    ? '🍽'
                    : item.kind === 'workout'
                    ? '💪'
                    : '💬'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-bone leading-relaxed">
                    {item.title}
                  </p>
                  {item.subtitle && (
                    <p className="text-[11px] text-bone-muted italic mt-0.5 truncate">
                      {item.subtitle}
                    </p>
                  )}
                </div>
                <span className="text-[11px] text-bone-faint tabular-nums whitespace-nowrap">
                  {formatRelative(item.iso)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* === NAV-CARDS === */}
      <nav className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-12">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={`/coach/customers/${params.id}/${card.href}`}
            className="group block border border-white/[0.08] px-5 py-5 hover:border-gold/40 hover:bg-white/[0.02] transition"
          >
            <p className="font-serif text-2xl text-bone leading-tight mb-2 group-hover:text-gold transition-colors">
              {card.label} →
            </p>
            <p className="text-[11px] text-bone-muted leading-relaxed">
              {card.subtitle}
            </p>
          </Link>
        ))}
      </nav>
    </div>
  );
}
