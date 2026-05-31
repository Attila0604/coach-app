import Link from 'next/link';
import {
  getCustomerForCoach,
  viennaDay,
  viennaStartOfDayUtc,
  TZ,
} from '@/lib/coach-customer-helpers';

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
  const startOfToday = viennaStartOfDayUtc();
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
      const isOutbound = m.direction === 'out';
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
    <div className="space-y-8">
      <Link
        href="/coach/customers"
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-caps text-bone-faint transition hover:text-gold"
      >
        ← Kunden
      </Link>

      <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-gold/[0.06] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="mb-3 text-[10px] font-medium uppercase tracking-caps text-gold">
              Kundenprofil
            </p>
            <h1 className="font-serif text-4xl leading-tight text-bone sm:text-5xl">
              {displayName}
            </h1>
            <p className="mt-3 text-sm text-bone-muted">
              {username && <>{username} · </>}
              {onboardedDate ? <>seit {onboardedDate}</> : 'Noch kein Startdatum'}
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] font-medium uppercase tracking-caps text-gold">
              {statusLabel}
            </span>
            {lastActivityIso && (
              <span className="text-[11px] text-bone-faint">
                letzte Aktivität: {formatRelative(lastActivityIso)}
              </span>
            )}
          </div>
        </div>
      </section>

      <section>
        <p className="mb-4 text-[10px] font-medium uppercase tracking-caps text-gold">
          Heute · {formatTodayHeader()}
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TodayCard
            label="Kalorien"
            value={todayKcal}
            suffix={kcalTarget ? `/ ${kcalTarget}` : undefined}
            meta={
              todayFood.length === 0
                ? 'keine Mahlzeit'
                : kcalPercent != null
                ? `${kcalPercent}% des Ziels · ${todayFood.length} ${
                    todayFood.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'
                  }`
                : `${todayFood.length} ${
                    todayFood.length === 1 ? 'Mahlzeit' : 'Mahlzeiten'
                  }`
            }
          />
          <TodayCard
            label="Workout"
            value={lastWorkout ? '💪' : '—'}
            meta={
              lastWorkout?.training_days
                ? `Tag ${lastWorkout.training_days.day_number} · ${
                    lastWorkout.status === 'completed'
                      ? 'abgeschlossen'
                      : lastWorkout.status === 'aborted'
                      ? 'abgebrochen'
                      : 'läuft'
                  }`
                : lastWorkout?.status ?? 'heute keins'
            }
            muted={!lastWorkout}
          />
          <TodayCard
            label="Meal-Plan"
            value={todayPlan ? '✓' : '—'}
            meta={
              todayPlan?.total_kcal != null
                ? `${todayPlan.total_kcal} kcal geplant`
                : todayPlan
                ? 'aktiv für heute'
                : 'kein Plan'
            }
            accent={!!todayPlan}
            muted={!todayPlan}
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <Panel
          title="Coach-Notiz"
          action={
            <Link
              href={`/coach/customers/${params.id}/profile`}
              className="text-[10px] font-medium uppercase tracking-caps text-bone-faint transition hover:text-gold"
            >
              bearbeiten →
            </Link>
          }
        >
          {coachNote ? (
            <p className="font-serif text-xl italic leading-relaxed text-bone-muted">
              &ldquo;{coachNote.content}&rdquo;
            </p>
          ) : (
            <EmptyText>Noch keine Notiz hinterlegt.</EmptyText>
          )}
        </Panel>

        <Panel
          title="Letzte Aktivität"
          action={
            <Link
              href={`/coach/customers/${params.id}/activity`}
              className="text-[10px] font-medium uppercase tracking-caps text-bone-faint transition hover:text-gold"
            >
              alle anzeigen →
            </Link>
          }
        >
          {recentItems.length === 0 ? (
            <EmptyText>Noch keine Aktivität.</EmptyText>
          ) : (
            <div className="space-y-3">
              {recentItems.map((item) => (
                <RecentRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <nav className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {NAV_CARDS.map((card) => (
          <Link
            key={card.href}
            href={`/coach/customers/${params.id}/${card.href}`}
            className="group rounded-3xl border border-white/[0.08] bg-white/[0.025] px-5 py-5 transition hover:border-gold/35 hover:bg-gold/[0.06]"
          >
            <p className="mb-2 font-serif text-2xl leading-tight text-bone transition-colors group-hover:text-gold">
              {card.label} →
            </p>
            <p className="text-[11px] leading-relaxed text-bone-muted">
              {card.subtitle}
            </p>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function TodayCard({
  label,
  value,
  suffix,
  meta,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  meta: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-5 py-5 ${
        accent
          ? 'border-gold/30 bg-gold/[0.07]'
          : 'border-white/[0.08] bg-white/[0.035]'
      }`}
    >
      <p className="mb-3 text-[9px] font-medium uppercase tracking-caps text-bone-faint">
        {label}
      </p>
      <p
        className={`font-serif text-3xl leading-none tabular-nums ${
          accent ? 'text-gold' : muted ? 'text-bone-faint' : 'text-bone'
        }`}
      >
        {value}
        {suffix && (
          <span className="ml-2 text-base text-bone-faint">{suffix}</span>
        )}
      </p>
      <p className="mt-3 text-[11px] text-bone-faint">{meta}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-black/20 p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[10px] font-medium uppercase tracking-caps text-gold">
          {title}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm italic text-bone-faint">
      {children}
    </p>
  );
}

function RecentRow({ item }: { item: RecentItem }) {
  const icon =
    item.kind === 'meal' ? '🍽' : item.kind === 'workout' ? '💪' : '💬';

  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-black/20 text-base">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-bone">{item.title}</p>
        {item.subtitle && (
          <p className="mt-0.5 truncate text-[11px] italic text-bone-muted">
            {item.subtitle}
          </p>
        )}
      </div>
      <span className="mt-1 whitespace-nowrap text-[11px] tabular-nums text-bone-faint">
        {formatRelative(item.iso)}
      </span>
    </div>
  );
}
