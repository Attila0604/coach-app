import Link from 'next/link';
import {
  KcalLast7Chart,
  StreakHeatmap,
  MacroBreakdown,
  WeightProgress,
} from './charts';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { MacroBar } from '@/components/ui/MacroBar';
import { StatStrip, StatCell } from '@/components/ui/StatStrip';
import { MealRow } from '@/components/ui/MealRow';
import { MessageRow } from '@/components/ui/MessageRow';
import {
  getCustomerForCoach,
  buildWindow,
  computeStreak,
  viennaDay,
  labelGoal,
  formatDate,
  STATUS_LABELS,
} from '@/lib/coach-customer-helpers';

type Params = { id: string };

export default async function CustomerDetailPage({
  params,
}: {
  params: Params;
}) {
  const { supabase, customer } = await getCustomerForCoach(params.id);
  const { dayKeys, todayKey, queryFrom } = buildWindow();

  const [
    profileRes,
    logsRes,
    msgsRes,
    activeNoteRes,
    activeTrainingPlanRes,
    activeMealPlanRes,
  ] = await Promise.all([
    supabase
      .from('customer_profiles')
      .select('*')
      .eq('customer_id', params.id)
      .maybeSingle(),
    supabase
      .from('food_logs')
      .select(
        'id, logged_at, meal_type, raw_description, total_kcal, protein_g, carbs_g, fat_g'
      )
      .eq('customer_id', params.id)
      .gte('logged_at', queryFrom.toISOString())
      .order('logged_at', { ascending: false }),
    supabase
      .from('messages')
      .select('id, direction, content, agent_name, created_at')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('coach_notes')
      .select('id, content, created_at')
      .eq('customer_id', params.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('training_plans')
      .select('id, name, weeks, current_week, status, start_date')
      .eq('customer_id', params.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('meal_plans')
      .select('id, plan_date, status, total_kcal')
      .eq('customer_id', params.id)
      .gte('plan_date', todayKey)
      .eq('status', 'published')
      .order('plan_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data;
  const logs30 = logsRes.data ?? [];
  const messages = msgsRes.data ?? [];
  const activeNote = activeNoteRes.data;
  const activeTrainingPlan = activeTrainingPlanRes.data;
  const activeMealPlan = activeMealPlanRes.data;

  const recentLogs = logs30.slice(0, 8);

  type DayBucket = {
    kcal: number;
    logCount: number;
    protein: number;
    carbs: number;
    fat: number;
  };

  const dailyMap = new Map<string, DayBucket>();
  for (const key of dayKeys) {
    dailyMap.set(key, { kcal: 0, logCount: 0, protein: 0, carbs: 0, fat: 0 });
  }
  for (const log of logs30) {
    if (!log.logged_at) continue;
    const key = viennaDay(new Date(log.logged_at));
    const day = dailyMap.get(key);
    if (!day) continue;
    day.kcal += log.total_kcal ?? 0;
    day.logCount += 1;
    day.protein += Number(log.protein_g) || 0;
    day.carbs += Number(log.carbs_g) || 0;
    day.fat += Number(log.fat_g) || 0;
  }

  const days30 = dayKeys.map((date) => {
    const v = dailyMap.get(date)!;
    return { date, kcal: v.kcal, logCount: v.logCount };
  });
  const days7 = days30.slice(-7);
  const macro7 = dayKeys.slice(-7).reduce(
    (acc, key) => {
      const v = dailyMap.get(key)!;
      acc.protein += v.protein;
      acc.carbs += v.carbs;
      acc.fat += v.fat;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0 }
  );

  const today = dailyMap.get(todayKey) ?? {
    kcal: 0,
    logCount: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  const streak = computeStreak(days30);
  const avg7 = Math.round(days7.reduce((s, d) => s + d.kcal, 0) / 7);

  const weightDelta =
    profile?.weight_start_kg != null && profile?.weight_target_kg != null
      ? Number(profile.weight_target_kg) - Number(profile.weight_start_kg)
      : null;

  const displayName =
    customer.first_name || customer.telegram_username || 'Kunde';

  const planTargets = {
    kcal: profile?.daily_kcal_target ?? null,
    protein: profile?.protein_target_g ?? null,
    carbs: profile?.carbs_target_g ?? null,
    fat: profile?.fat_target_g ?? null,
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href="/coach"
        className="text-[11px] uppercase tracking-caps text-bone-faint hover:text-bone-muted transition-colors mb-6 inline-flex items-center gap-2"
      >
        <span>←</span>
        <span>Zurück zur Kundenliste</span>
      </Link>

      <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
        <div>
          <h1 className="font-serif text-4xl text-bone leading-tight mb-2">
            {displayName}
          </h1>
          {customer.telegram_username && (
            <p className="text-sm text-bone-muted">
              @{customer.telegram_username}
            </p>
          )}
        </div>
        <StatusBadge status={customer.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 md:gap-12 items-center py-10 border-y border-white/[0.06] mb-0">
        <ProgressRing
          value={today.kcal}
          target={planTargets.kcal ?? 2000}
          label="kcal heute"
        />
        <div className="flex flex-col gap-5 w-full">
          <MacroBar
            label="Kalorien"
            value={today.kcal}
            target={planTargets.kcal ?? 2000}
            unit="kcal"
          />
          <MacroBar
            label="Protein"
            value={today.protein}
            target={planTargets.protein ?? 150}
            unit="g"
          />
          <MacroBar
            label="Carbs"
            value={today.carbs}
            target={planTargets.carbs ?? 200}
            unit="g"
          />
        </div>
      </div>

      <StatStrip>
        <StatCell value={streak} label="Tage Streak" accent />
        <StatCell value={avg7} label="7-Tage Ø kcal" />
        <StatCell
          value={
            weightDelta != null
              ? `${weightDelta > 0 ? '+' : ''}${weightDelta} kg`
              : '—'
          }
          label="Gewichtsziel"
        />
      </StatStrip>

      {/* AKTIVE PLÄNE — Quick-Übersicht mit Links */}
      <Section title="Aktive Pläne" topMargin>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.06]">
          <Panel title="Ernährung">
            {activeMealPlan ? (
              <p className="text-sm text-bone">
                Heutiger Plan veröffentlicht ·{' '}
                <span className="text-bone-muted tabular-nums">
                  {activeMealPlan.total_kcal ?? '—'} kcal
                </span>
              </p>
            ) : (
              <Empty>Kein veröffentlichter Plan für heute</Empty>
            )}
            <Link
              href={`/coach/customers/${params.id}/nutrition`}
              className="inline-block mt-4 text-[10px] uppercase tracking-caps text-gold/80 hover:text-gold transition font-medium"
            >
              → Ernährung bearbeiten
            </Link>
          </Panel>

          <Panel title="Training">
            {activeTrainingPlan ? (
              <p className="text-sm text-bone">
                {activeTrainingPlan.name} ·{' '}
                <span className="text-bone-muted tabular-nums">
                  Woche {activeTrainingPlan.current_week ?? 1} von{' '}
                  {activeTrainingPlan.weeks ?? 4}
                </span>
              </p>
            ) : (
              <Empty>Kein aktiver Plan</Empty>
            )}
            <Link
              href={`/coach/customers/${params.id}/training`}
              className="inline-block mt-4 text-[10px] uppercase tracking-caps text-gold/80 hover:text-gold transition font-medium"
            >
              → Training bearbeiten
            </Link>
          </Panel>
        </div>
      </Section>

      {/* COACH-NOTIZ Quick-View (nur read, edit auf Profil-Page) */}
      {activeNote && (
        <Section title="Coach-Notiz" topMargin>
          <div className="bg-ink-900 p-7">
            <p className="text-sm text-bone italic leading-relaxed">
              &ldquo;{activeNote.content}&rdquo;
            </p>
            <Link
              href={`/coach/customers/${params.id}/profile`}
              className="inline-block mt-4 text-[10px] uppercase tracking-caps text-gold/80 hover:text-gold transition font-medium"
            >
              → Notiz bearbeiten
            </Link>
          </div>
        </Section>
      )}

      <Section title="Verlauf · 30 Tage" topMargin>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <KcalLast7Chart data={days7} target={planTargets.kcal} />
          <MacroBreakdown macros={macro7} />
          <StreakHeatmap data={days30} />
          <WeightProgress
            start={profile?.weight_start_kg ?? null}
            target={profile?.weight_target_kg ?? null}
            current={profile?.weight_current_kg ?? null}
          />
        </div>
      </Section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.06] mt-12">
        <Panel title="Profil">
          <dl className="divide-y divide-white/[0.06]">
            <ProfileRow label="Status">
              {STATUS_LABELS[customer.status] ?? customer.status}
            </ProfileRow>
            <ProfileRow label="Onboarded">
              {formatDate(customer.onboarded_at)}
            </ProfileRow>
            <ProfileRow label="Ziel">{labelGoal(profile?.goal ?? null)}</ProfileRow>
            <ProfileRow label="Erfahrung">
              {profile?.experience_level ?? '—'}
            </ProfileRow>
            <ProfileRow label="Equipment">
              {profile?.equipment ?? '—'}
            </ProfileRow>
            <ProfileRow label="Allergien">
              {profile?.allergies ?? '—'}
            </ProfileRow>
            <ProfileRow label="Größe">
              {profile?.height_cm ? `${profile.height_cm} cm` : '—'}
            </ProfileRow>
            <ProfileRow label="Gewicht">
              {profile?.weight_start_kg
                ? `${profile.weight_start_kg} kg → ${profile?.weight_target_kg ?? '—'} kg`
                : '—'}
            </ProfileRow>
          </dl>
          <Link
            href={`/coach/customers/${params.id}/profile`}
            className="inline-block mt-5 text-[10px] uppercase tracking-caps text-gold/80 hover:text-gold transition font-medium"
          >
            → Profil bearbeiten
          </Link>
        </Panel>

        <Panel title={`Letzte Mahlzeiten · ${recentLogs.length}`}>
          {recentLogs.length === 0 ? (
            <Empty>Noch keine Logs.</Empty>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {recentLogs.map((log) => (
                <MealRow
                  key={log.id}
                  meal_type={log.meal_type}
                  description={log.raw_description}
                  kcal={log.total_kcal}
                  logged_at={log.logged_at}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Letzte Nachrichten · ${messages.length}`}>
          {messages.length === 0 ? (
            <Empty>Noch keine Nachrichten.</Empty>
          ) : (
            <ul className="divide-y divide-white/[0.06]">
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  direction={m.direction}
                  content={m.content}
                  agent_name={m.agent_name}
                  created_at={m.created_at}
                />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* GROßE NAV-BUTTONS unten */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.06] mt-12">
        <NavCard
          href={`/coach/customers/${params.id}/profile`}
          title="Profil"
          subtitle="Ziele, Equipment, Notizen"
        />
        <NavCard
          href={`/coach/customers/${params.id}/nutrition`}
          title="Ernährung"
          subtitle="Food-Library + Wochenplan"
        />
        <NavCard
          href={`/coach/customers/${params.id}/training`}
          title="Training"
          subtitle="KI-Generator + Editor"
        />
      </div>
    </div>
  );
}

/* ============== local helpers ============== */

function Section({
  title,
  topMargin = false,
  children,
}: {
  title: string;
  topMargin?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={topMargin ? 'mt-12' : ''}>
      <h2 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-6">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ink-900 p-7">
      <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-5">
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProfileRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-[10px] tracking-capsTight uppercase text-bone-muted shrink-0 font-medium">
        {label}
      </dt>
      <dd className="text-bone text-sm text-right">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-bone-muted italic">{children}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'border-gold/40 text-gold',
    intake: 'border-bone/30 text-bone',
    paused: 'border-bone-muted/30 text-bone-muted',
    archived: 'border-bone-faint text-bone-faint',
  };
  const style = styles[status] ?? styles.paused;
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`text-[10px] px-3 py-1.5 border ${style} tracking-caps uppercase font-medium`}
    >
      {label}
    </span>
  );
}

function NavCard({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="bg-ink-900 p-7 hover:bg-ink-800 transition-colors group"
    >
      <p className="font-serif text-2xl text-bone leading-tight mb-2 group-hover:text-gold transition-colors">
        {title} →
      </p>
      <p className="text-sm text-bone-muted">{subtitle}</p>
    </Link>
  );
}
