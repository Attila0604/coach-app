import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { createClient } from '@/lib/supabase-server';

const TZ = 'Europe/Vienna';

function viennaDay(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

// Wiens UTC-Offset (ms) — +1h Winter, +2h Sommer (DST-sicher)
function viennaOffsetMs(at: Date): number {
  const p: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)) {
    p[part.type] = part.value;
  }
  const hour = p.hour === '24' ? 0 : Number(p.hour);
  const asWall = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    hour,
    Number(p.minute),
    Number(p.second)
  );
  return asWall - at.getTime();
}

// UTC-Instant von Wien-Mitternacht (ersetzt hardcoded +02:00)
function viennaStartOfDayUtc(d: Date = new Date()): Date {
  const key = viennaDay(d);
  const offset = viennaOffsetMs(new Date(`${key}T12:00:00Z`));
  return new Date(new Date(`${key}T00:00:00Z`).getTime() - offset);
}

function formatRelativeTime(iso: string): string {
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

function formatTodayHeader(): string {
  return new Date().toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
}

type Customer = {
  id: string;
  first_name: string | null;
  telegram_username: string | null;
  status: string;
};

type CustomerSummary = {
  customer: Customer;
  hasWorkoutToday: boolean;
  hasMealToday: boolean;
  hasMessageToday: boolean;
  todayKcal: number;
  kcalTarget: number | null;
  todayMealCount: number;
  hasPublishedPlanToday: boolean;
  lastTodayIso: string | null;
  lastActivityEverIso: string | null;
  daysSinceActivity: number | null;
};

type StreamItem = {
  id: string;
  kind: 'workout' | 'meal' | 'message';
  customerId: string;
  customerName: string;
  timestamp: string;
  title: string;
  subtitle?: string;
  statusColor?: 'gold' | 'red' | 'muted';
};

export default async function CoachDashboardPage() {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, name, role')
    .eq('user_id', user.id)
    .maybeSingle();

  const firstName = (coach?.name ?? '').split(' ')[0] || 'Coach';
  const isAdmin = coach?.role === 'admin';

  // === Build time windows ===
  const todayKey = viennaDay(new Date());
  const startOfToday = viennaStartOfDayUtc();
  const since7d = new Date();
  since7d.setDate(since7d.getDate() - 7);
  const since3d = new Date();
  since3d.setDate(since3d.getDate() - 3);
  const since30d = new Date();
  since30d.setDate(since30d.getDate() - 30);

  // === Load active customers (scoped or all) ===
  let customersQuery = supabase
    .from('customers')
    .select('id, first_name, telegram_username, status')
    .eq('status', 'active');
  if (!isAdmin && coach) customersQuery = customersQuery.eq('coach_id', coach.id);
  const { data: customersRaw } = await customersQuery;
  const customers: Customer[] = customersRaw ?? [];
  const customerIds = customers.map((c) => c.id);
  const customerMap = new Map(customers.map((c) => [c.id, c]));

  if (customerIds.length === 0) {
    return <EmptyState firstName={firstName} isAdmin={isAdmin} hasCoach={!!coach} />;
  }

  // === Parallel queries ===
  const [
    profilesRes,
    todayFoodRes,
    todayWorkoutsRes,
    todayMessagesRes,
    todayPlansRes,
    week7WorkoutsRes,
    streamFoodRes,
    streamWorkoutsRes,
    streamMessagesRes,
    lastFood30Res,
    lastWorkout30Res,
    lastMessage30Res,
  ] = await Promise.all([
    supabase
      .from('customer_profiles')
      .select('customer_id, daily_kcal_target')
      .in('customer_id', customerIds),
    supabase
      .from('food_logs')
      .select('id, customer_id, logged_at, meal_type, raw_description, total_kcal')
      .in('customer_id', customerIds)
      .gte('logged_at', startOfToday.toISOString()),
    supabase
      .from('workout_sessions')
      .select('id, customer_id, started_at, status, training_days(day_number, title)')
      .in('customer_id', customerIds)
      .gte('started_at', startOfToday.toISOString()),
    supabase
      .from('messages')
      .select('id, customer_id, direction, content, created_at, agent_name')
      .in('customer_id', customerIds)
      .gte('created_at', startOfToday.toISOString()),
    supabase
      .from('meal_plans')
      .select('customer_id, plan_date, status, total_kcal')
      .in('customer_id', customerIds)
      .eq('plan_date', todayKey)
      .eq('status', 'published'),
    supabase
      .from('workout_sessions')
      .select('id, customer_id, started_at')
      .in('customer_id', customerIds)
      .gte('started_at', since7d.toISOString()),
    supabase
      .from('food_logs')
      .select('id, customer_id, logged_at, meal_type, raw_description, total_kcal')
      .in('customer_id', customerIds)
      .gte('logged_at', since7d.toISOString())
      .order('logged_at', { ascending: false })
      .limit(15),
    supabase
      .from('workout_sessions')
      .select('id, customer_id, started_at, status, training_days(day_number, title)')
      .in('customer_id', customerIds)
      .gte('started_at', since7d.toISOString())
      .order('started_at', { ascending: false })
      .limit(15),
    supabase
      .from('messages')
      .select('id, customer_id, direction, content, created_at, agent_name')
      .in('customer_id', customerIds)
      .gte('created_at', since7d.toISOString())
      .order('created_at', { ascending: false })
      .limit(15),
    supabase
      .from('food_logs')
      .select('customer_id, logged_at')
      .in('customer_id', customerIds)
      .gte('logged_at', since30d.toISOString())
      .order('logged_at', { ascending: false }),
    supabase
      .from('workout_sessions')
      .select('customer_id, started_at')
      .in('customer_id', customerIds)
      .gte('started_at', since30d.toISOString())
      .order('started_at', { ascending: false }),
    supabase
      .from('messages')
      .select('customer_id, created_at')
      .in('customer_id', customerIds)
      .gte('created_at', since30d.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const profiles = profilesRes.data ?? [];
  const profileByCustomer = new Map(
    profiles.map((p) => [p.customer_id, p.daily_kcal_target])
  );

  const todayFoodLogs = todayFoodRes.data ?? [];
  const todayWorkouts = todayWorkoutsRes.data ?? [];
  const todayMessages = todayMessagesRes.data ?? [];
  const todayPlans = todayPlansRes.data ?? [];
  const week7Workouts = week7WorkoutsRes.data ?? [];

  // === Build last-activity map (over 30 days) ===
  const lastActivityMap = new Map<string, string>();
  const updateLast = (customerId: string, iso: string) => {
    const prev = lastActivityMap.get(customerId);
    if (!prev || iso > prev) lastActivityMap.set(customerId, iso);
  };
  for (const f of lastFood30Res.data ?? []) updateLast(f.customer_id, f.logged_at);
  for (const w of lastWorkout30Res.data ?? []) updateLast(w.customer_id, w.started_at);
  for (const m of lastMessage30Res.data ?? []) updateLast(m.customer_id, m.created_at);

  const nowMs = Date.now();

  // === Aggregate per-customer summary ===
  const summaries: CustomerSummary[] = customers.map((c) => {
    const cFood = todayFoodLogs.filter((l) => l.customer_id === c.id);
    const cWorkouts = todayWorkouts.filter((w) => w.customer_id === c.id);
    const cMessages = todayMessages.filter((m) => m.customer_id === c.id);
    const cPlan = todayPlans.find((p) => p.customer_id === c.id);

    const todayKcal = cFood.reduce(
      (sum, l) => sum + (Number(l.total_kcal) || 0),
      0
    );

    // today's last timestamp
    const allTimes: string[] = [
      ...cFood.map((l) => l.logged_at),
      ...cWorkouts.map((w) => w.started_at),
      ...cMessages.map((m) => m.created_at),
    ];
    const lastTodayIso = allTimes.length
      ? allTimes.sort().reverse()[0]
      : null;

    // last ever
    const lastEverIso = lastActivityMap.get(c.id) ?? null;
    const daysSinceActivity =
      lastEverIso != null
        ? Math.floor((nowMs - new Date(lastEverIso).getTime()) / 86400000)
        : null;

    return {
      customer: c,
      hasWorkoutToday: cWorkouts.length > 0,
      hasMealToday: cFood.length > 0,
      hasMessageToday: cMessages.length > 0,
      todayKcal: Math.round(todayKcal),
      kcalTarget: profileByCustomer.get(c.id) ?? null,
      todayMealCount: cFood.length,
      hasPublishedPlanToday: !!cPlan,
      lastTodayIso,
      lastActivityEverIso: lastEverIso,
      daysSinceActivity,
    };
  });

  const activeToday = summaries.filter(
    (s) => s.hasWorkoutToday || s.hasMealToday || s.hasMessageToday
  );
  // Inaktiv = keine Aktivität seit 3+ Tagen (oder nie)
  const inactive = summaries.filter(
    (s) => s.daysSinceActivity == null || s.daysSinceActivity >= 3
  );

  // === Build global stream ===
  const streamItems: StreamItem[] = [
    ...(streamFoodRes.data ?? []).map((l): StreamItem => {
      const c = customerMap.get(l.customer_id);
      return {
        id: `meal-${l.id}`,
        kind: 'meal',
        customerId: l.customer_id,
        customerName:
          c?.first_name ?? c?.telegram_username ?? 'Kunde',
        timestamp: l.logged_at,
        title: l.raw_description ?? 'Mahlzeit',
        subtitle: l.total_kcal != null ? `${l.total_kcal} kcal` : undefined,
      };
    }),
    ...(streamWorkoutsRes.data ?? []).map((w: any): StreamItem => {
      const c = customerMap.get(w.customer_id);
      const day = w.training_days;
      const statusLabel =
        w.status === 'completed' ? 'abgeschlossen'
        : w.status === 'aborted' ? 'abgebrochen'
        : w.status === 'paused' ? 'pausiert'
        : 'läuft';
      const statusColor: 'gold' | 'red' | 'muted' =
        w.status === 'completed' ? 'gold'
        : w.status === 'aborted' ? 'red'
        : 'muted';
      return {
        id: `workout-${w.id}`,
        kind: 'workout',
        customerId: w.customer_id,
        customerName:
          c?.first_name ?? c?.telegram_username ?? 'Kunde',
        timestamp: w.started_at,
        title: day ? `Tag ${day.day_number} · ${day.title} ${statusLabel}` : `Workout ${statusLabel}`,
        statusColor,
      };
    }),
    ...(streamMessagesRes.data ?? []).map((m): StreamItem => {
      const c = customerMap.get(m.customer_id);
      const isOutbound = m.direction === 'outbound' || m.direction === 'out';
      return {
        id: `msg-${m.id}`,
        kind: 'message',
        customerId: m.customer_id,
        customerName:
          c?.first_name ?? c?.telegram_username ?? 'Kunde',
        timestamp: m.created_at,
        title: isOutbound
          ? `${m.agent_name ?? 'Bot'} → ${c?.first_name ?? 'Kunde'}`
          : `${c?.first_name ?? 'Kunde'} →`,
        subtitle:
          (m.content ?? '').substring(0, 80) +
          ((m.content ?? '').length > 80 ? '…' : ''),
      };
    }),
  ]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, 3);

  // === STATS ===
  const activeCount = customers.length;
  const activeTodayCount = activeToday.length;
  const workoutsWeekCount = week7Workouts.length;
  const inactiveCount = inactive.length;
  const mealPlanTodayCount = summaries.filter((s) => s.hasPublishedPlanToday).length;

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-gold/[0.07] p-6 sm:p-8 shadow-2xl shadow-black/20">
        <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-[10px] font-medium uppercase tracking-caps text-gold">
              {isAdmin ? 'Admin · Übersicht' : 'Heute'} · {formatTodayHeader()}
            </p>
            <h1 className="font-serif text-4xl leading-tight text-bone sm:text-5xl">
              Hallo {firstName}
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-bone-muted">
              {isAdmin
                ? 'Alle Kunden im Blick: Aktivität, Trainingssignale und offene Aufmerksamkeitspunkte.'
                : 'Dein kompaktes Cockpit für Kunden, Aktivität und nächste Prioritäten.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-4 py-2 text-[10px] font-medium uppercase tracking-caps text-bone-muted">
              {isAdmin ? 'Adminmodus' : 'Coachmodus'}
            </span>
            <Link
              href="/coach/customers"
              className="rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-[10px] font-medium uppercase tracking-caps text-gold transition hover:border-gold/60 hover:bg-gold/15"
            >
              Kunden öffnen →
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Aktive Kunden" value={activeCount} hint="im Coaching" />
        <StatCard
          label="Heute aktiv"
          value={activeTodayCount}
          hint={`${Math.round((activeTodayCount / Math.max(activeCount, 1)) * 100)}% Aktivitätsquote`}
          accent={activeTodayCount > 0 ? 'gold' : undefined}
        />
        <StatCard
          label="Meal-Plan heute"
          value={mealPlanTodayCount}
          hint="veröffentlicht"
          accent={mealPlanTodayCount > 0 ? 'gold' : undefined}
        />
        <StatCard label="Workouts" value={workoutsWeekCount} hint="letzte 7 Tage" />
        <StatCard
          label="Aufmerksamkeit"
          value={inactiveCount}
          hint="≥3 Tage inaktiv"
          accent={inactiveCount > 0 ? 'red' : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <DashboardPanel
          title="Brauchen Aufmerksamkeit"
          meta={
            inactive.length > 0
              ? `${inactive.length} ${inactive.length === 1 ? 'Kunde' : 'Kunden'}`
              : 'Alles ruhig'
          }
          accent={inactive.length > 0 ? 'red' : 'gold'}
        >
          {inactive.length === 0 ? (
            <EmptyPanelText>Keine Kunden sind seit 3+ Tagen inaktiv.</EmptyPanelText>
          ) : (
            <div className="space-y-2">
              {inactive.map((s) => (
                <InactiveRow key={s.customer.id} summary={s} />
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Letzte Aktivität"
          meta="7 Tage"
          action={
            <Link
              href="/coach/customers"
              className="text-[10px] font-medium uppercase tracking-caps text-bone-faint transition hover:text-gold"
            >
              alle anzeigen →
            </Link>
          }
        >
          {streamItems.length === 0 ? (
            <EmptyPanelText>Noch keine Aktivität in den letzten 7 Tagen.</EmptyPanelText>
          ) : (
            <div className="space-y-3">
              {streamItems.map((item) => (
                <StreamRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="Heute aktiv"
        meta={`${activeTodayCount} von ${activeCount}`}
        action={
          <Link
            href="/coach/customers"
            className="text-[10px] font-medium uppercase tracking-caps text-bone-faint transition hover:text-gold"
          >
            Kundenliste →
          </Link>
        }
      >
        {activeToday.length === 0 ? (
          <EmptyPanelText>Noch keine Aktivität heute.</EmptyPanelText>
        ) : (
          <div className="grid gap-2">
            {activeToday.map((s) => (
              <CustomerTodayRow key={s.customer.id} summary={s} />
            ))}
          </div>
        )}
      </DashboardPanel>

      {!coach && (
        <div className="rounded-2xl border border-red-400/40 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200">
          Hinweis: Dein Auth-Account ist nicht mit einem Coach-Eintrag verknüpft.
        </div>
      )}
    </div>
  );
}

function DashboardPanel({
  title,
  meta,
  accent = 'gold',
  action,
  children,
}: {
  title: string;
  meta?: string;
  accent?: 'gold' | 'red';
  action?: ReactNode;
  children: ReactNode;
}) {
  const accentClass = accent === 'red' ? 'bg-red-400/70' : 'bg-gold';
  const metaClass = accent === 'red' ? 'text-red-300' : 'text-gold';

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-black/20 p-4 shadow-xl shadow-black/10 sm:p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${accentClass}`} />
            <p className="text-[10px] font-medium uppercase tracking-caps text-bone-faint">
              {title}
            </p>
          </div>
          {meta && (
            <p className={`text-xs font-medium uppercase tracking-capsTight ${metaClass}`}>
              {meta}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyPanelText({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-6 text-sm italic text-bone-faint">
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number;
  hint: string;
  accent?: 'gold' | 'red';
}) {
  const borderClass =
    accent === 'gold'
      ? 'border-gold/30'
      : accent === 'red'
      ? 'border-red-400/35'
      : 'border-white/[0.08]';
  const valueClass =
    accent === 'gold' ? 'text-gold' : accent === 'red' ? 'text-red-400' : 'text-bone';

  return (
    <div className={`rounded-2xl border ${borderClass} bg-white/[0.035] px-4 py-4 transition hover:bg-white/[0.055]`}>
      <p className="mb-3 text-[9px] font-medium uppercase tracking-caps text-bone-faint">
        {label}
      </p>
      <p className={`font-serif text-3xl tabular-nums leading-none ${valueClass}`}>
        {value}
      </p>
      <p className="mt-3 text-[11px] text-bone-faint">{hint}</p>
    </div>
  );
}

function CustomerTodayRow({ summary: s }: { summary: CustomerSummary }) {
  const name =
    s.customer.first_name ?? s.customer.telegram_username ?? 'Kunde';
  const kcalText =
    s.kcalTarget != null
      ? `${s.todayKcal} / ${s.kcalTarget} kcal`
      : `${s.todayKcal} kcal`;
  return (
    <Link
      href={`/coach/customers/${s.customer.id}`}
      className="group grid gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-4 transition hover:border-gold/25 hover:bg-white/[0.045] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium text-bone">{name}</p>
          {s.hasPublishedPlanToday && (
            <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-capsTight text-gold">
              Plan
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[11px] text-bone-faint">
          {s.hasMealToday ? (
            <span className="tabular-nums">{kcalText}</span>
          ) : (
            <span className="italic">Keine Mahlzeit geloggt</span>
          )}
        </p>
      </div>
      <div className="flex gap-1.5 text-sm">
        <ActivityPill active={s.hasWorkoutToday} label="Workout" icon="💪" />
        <ActivityPill active={s.hasMealToday} label="Meal" icon="🍽" />
        <ActivityPill active={s.hasMessageToday} label="Chat" icon="💬" />
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <span className="text-[11px] text-bone-faint tabular-nums whitespace-nowrap">
          {s.lastTodayIso ? formatTime(s.lastTodayIso) : '—'}
        </span>
        <span className="text-bone-faint transition group-hover:text-gold">→</span>
      </div>
    </Link>
  );
}

function ActivityPill({
  active,
  label,
  icon,
}: {
  active: boolean;
  label: string;
  icon: string;
}) {
  return (
    <span
      title={label}
      className={`rounded-full border px-2.5 py-1 transition ${
        active
          ? 'border-gold/25 bg-gold/10 text-bone'
          : 'border-white/[0.06] bg-black/10 text-bone-faint opacity-50'
      }`}
    >
      {icon}
    </span>
  );
}

function InactiveRow({ summary: s }: { summary: CustomerSummary }) {
  const name =
    s.customer.first_name ?? s.customer.telegram_username ?? 'Kunde';
  const label =
    s.daysSinceActivity == null
      ? 'Noch keine Aktivität'
      : s.daysSinceActivity >= 30
      ? 'Über 30 Tage inaktiv'
      : `Letzte Aktivität vor ${s.daysSinceActivity} Tagen`;
  return (
    <Link
      href={`/coach/customers/${s.customer.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-red-400/15 bg-red-400/[0.035] px-4 py-3 transition hover:border-red-400/30 hover:bg-red-400/[0.055]"
    >
      <span className="h-2 w-2 rounded-full bg-red-400/80 shadow-[0_0_20px_rgba(248,113,113,0.35)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-bone">{name}</p>
        <p className="mt-0.5 truncate text-[11px] uppercase tracking-capsTight text-red-300/80">
          {label}
        </p>
      </div>
      <span className="text-bone-faint transition group-hover:text-gold">→</span>
    </Link>
  );
}

function StreamRow({ item }: { item: StreamItem }) {
  const icon =
    item.kind === 'workout' ? '💪' : item.kind === 'meal' ? '🍽' : '💬';
  const statusColorClass =
    item.statusColor === 'gold'
      ? 'text-gold/80'
      : item.statusColor === 'red'
      ? 'text-red-400/70'
      : 'text-bone-faint';
  return (
    <Link
      href={`/coach/customers/${item.customerId}`}
      className="group flex gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-3 py-3 transition hover:border-gold/20 hover:bg-white/[0.04]"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-black/20 text-base">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-bone leading-relaxed">
          <span className="font-medium">{item.customerName}</span>
          <span className={`ml-2 ${statusColorClass}`}>{item.title}</span>
        </p>
        {item.subtitle && (
          <p className="text-[11px] text-bone-muted italic mt-0.5 truncate">
            {item.subtitle}
          </p>
        )}
      </div>
      <span className="text-[11px] text-bone-faint tabular-nums whitespace-nowrap mt-1">
        {formatRelativeTime(item.timestamp)}
      </span>
    </Link>
  );
}

function EmptyState({
  firstName,
  isAdmin,
  hasCoach,
}: {
  firstName: string;
  isAdmin: boolean;
  hasCoach: boolean;
}) {
  return (
    <div className="rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-8">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-caps text-gold">
        {isAdmin ? 'Admin · Übersicht' : 'Heute'}
      </p>
      <h1 className="font-serif text-4xl leading-tight text-bone">
        Hallo {firstName}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-bone-muted">
        Aktuell hast du keine aktiven Kunden.
      </p>
      {!hasCoach && (
        <div className="mt-8 rounded-2xl border border-red-400/40 bg-red-400/[0.06] px-5 py-4 text-sm text-red-200">
          Hinweis: Dein Auth-Account ist nicht mit einem Coach-Eintrag verknüpft.
        </div>
      )}
    </div>
  );
}
