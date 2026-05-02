import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  KcalLast7Chart,
  StreakHeatmap,
  MacroBreakdown,
  WeightProgress,
} from "./charts";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { MacroBar } from "@/components/ui/MacroBar";
import { StatStrip, StatCell } from "@/components/ui/StatStrip";
import { MealRow } from "@/components/ui/MealRow";
import { MessageRow } from "@/components/ui/MessageRow";

const GOAL_LABELS: Record<string, string> = {
  endurance: "Ausdauer",
  ausdauer: "Ausdauer",
  strength: "Kraft",
  kraft: "Kraft",
  weight_loss: "Abnehmen",
  abnehmen: "Abnehmen",
  muscle_gain: "Muskelaufbau",
  aufbau: "Muskelaufbau",
  maintenance: "Erhalt",
  erhalt: "Erhalt",
  health: "Gesundheit",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  intake: "Onboarding",
  paused: "Pausiert",
  archived: "Archiviert",
};

function labelGoal(g: string | null): string {
  if (!g) return "—";
  return GOAL_LABELS[g.toLowerCase()] ?? g;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("de-DE").format(Math.round(Number(n)));
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Compute streak: consecutive days (counting backwards from today) with logCount > 0
function computeStreak(
  days30: Array<{ date: string; logCount: number }>
): number {
  let streak = 0;
  for (let i = days30.length - 1; i >= 0; i--) {
    if (days30[i].logCount > 0) streak++;
    else break;
  }
  return streak;
}

type Params = { id: string };

export default async function CustomerDetailPage({
  params,
}: {
  params: Params;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!coach) notFound();

  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, first_name, telegram_username, telegram_chat_id, status, onboarded_at, created_at, coach_id"
    )
    .eq("id", params.id)
    .eq("coach_id", coach.id)
    .maybeSingle();

  if (!customer) notFound();

  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("customer_id", params.id)
    .maybeSingle();

  const since = new Date();
  since.setDate(since.getDate() - 29);
  since.setHours(0, 0, 0, 0);

  const { data: logsRaw } = await supabase
    .from("food_logs")
    .select(
      "id, logged_at, meal_type, raw_description, total_kcal, protein_g, carbs_g, fat_g"
    )
    .eq("customer_id", params.id)
    .gte("logged_at", since.toISOString())
    .order("logged_at", { ascending: false });

  const logs30 = logsRaw ?? [];
  const recentLogs = logs30.slice(0, 8);

  const { data: msgsRaw } = await supabase
    .from("messages")
    .select("id, direction, content, agent_name, created_at")
    .eq("customer_id", params.id)
    .order("created_at", { ascending: false })
    .limit(8);

  const messages = msgsRaw ?? [];

  const dailyMap = new Map<
    string,
    {
      kcal: number;
      logCount: number;
      protein: number;
      carbs: number;
      fat: number;
    }
  >();
  for (let i = 0; i < 30; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    dailyMap.set(isoDay(d), {
      kcal: 0,
      logCount: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  }
  for (const log of logs30) {
    if (!log.logged_at) continue;
    const key = isoDay(new Date(log.logged_at));
    const day = dailyMap.get(key);
    if (!day) continue;
    day.kcal += log.total_kcal ?? 0;
    day.logCount += 1;
    day.protein += Number(log.protein_g) || 0;
    day.carbs += Number(log.carbs_g) || 0;
    day.fat += Number(log.fat_g) || 0;
  }

  const days30 = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      kcal: vals.kcal,
      logCount: vals.logCount,
    }));

  const days7 = days30.slice(-7);

  const macro7 = days30.slice(-7).reduce(
    (acc, d) => {
      const day = dailyMap.get(d.date)!;
      acc.protein += day.protein;
      acc.carbs += day.carbs;
      acc.fat += day.fat;
      return acc;
    },
    { protein: 0, carbs: 0, fat: 0 }
  );

  const todayKey = isoDay(new Date());
  const today = dailyMap.get(todayKey) ?? {
    kcal: 0,
    logCount: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  };

  const streak = computeStreak(days30);
  const avg7 = Math.round(
    days7.reduce((s, d) => s + d.kcal, 0) / 7
  );

  const weightDelta =
    profile?.weight_start_kg != null && profile?.weight_target_kg != null
      ? Number(profile.weight_target_kg) - Number(profile.weight_start_kg)
      : null;

  const displayName =
    customer.first_name || customer.telegram_username || "Kunde";

  return (
    <div>
      {/* === Back link === */}
      <Link
        href="/coach/customers"
        className="inline-flex items-center gap-2 text-xs tracking-capsTight uppercase text-bone-muted hover:text-bone mb-8 transition"
      >
        <span>←</span>
        <span>Zurück zur Kundenliste</span>
      </Link>

      {/* === Header === */}
      <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
        <div>
          <p className="text-[9px] tracking-caps uppercase text-gold font-medium mb-3">
            Kunde
          </p>
          <h1 className="font-serif text-5xl text-bone leading-tight mb-3">
            {displayName}
          </h1>
          <div className="flex items-center gap-3 text-xs text-bone-muted flex-wrap">
            {customer.telegram_username && (
              <span>@{customer.telegram_username}</span>
            )}
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span>seit {formatDate(customer.created_at)}</span>
            <span className="w-1 h-1 rounded-full bg-white/15" />
            <span className="tabular-nums">
              Telegram {customer.telegram_chat_id}
            </span>
          </div>
        </div>
        <StatusBadge status={customer.status} />
      </div>

      {/* === Hero: ring + macros === */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8 md:gap-12 items-center py-10 border-y border-white/[0.06] mb-0">
        <ProgressRing
          value={today.kcal}
          goal={profile?.daily_kcal_target ?? null}
          label="HEUTE"
          unit="kcal"
        />
        <div className="flex flex-col gap-5 w-full">
          <MacroBar
            label="Protein"
            value={today.protein}
            goal={profile?.protein_target_g ?? null}
            variant="gold"
          />
          <MacroBar
            label="Kohlenhydrate"
            value={today.carbs}
            goal={profile?.carbs_target_g ?? null}
            variant="soft"
          />
          <MacroBar
            label="Fett"
            value={today.fat}
            goal={profile?.fat_target_g ?? null}
            variant="deep"
          />
        </div>
      </div>

      {/* === Stat strip === */}
      <StatStrip>
        <StatCell value={streak} label="Tage Streak" accent />
        <StatCell value={avg7} label="7-Tage Ø kcal" />
        <StatCell
          value={
            weightDelta != null
              ? (weightDelta > 0 ? "+" : "") + weightDelta.toFixed(1)
              : "—"
          }
          label="Ziel-Delta"
          unit={weightDelta != null ? "kg" : undefined}
        />
      </StatStrip>

      {/* === Charts === */}
      <Section title="Verlauf · 30 Tage" topMargin>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <KcalLast7Chart
            data={days7}
            target={profile?.daily_kcal_target ?? null}
          />
          <MacroBreakdown
            protein={macro7.protein}
            carbs={macro7.carbs}
            fat={macro7.fat}
          />
          <StreakHeatmap data={days30} />
          <WeightProgress
            start={profile?.weight_start_kg ?? null}
            target={profile?.weight_target_kg ?? null}
          />
        </div>
      </Section>

      {/* === Two-column body === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/[0.06] mt-12">
        {/* Profile */}
        <Panel title="Profil">
          {profile ? (
            <dl className="divide-y divide-white/[0.06]">
              <ProfileRow label="Alter">{profile.age ?? "—"}</ProfileRow>
              <ProfileRow label="Geschlecht">
                {profile.gender ?? "—"}
              </ProfileRow>
              <ProfileRow label="Größe">
                {profile.height_cm ? `${profile.height_cm} cm` : "—"}
              </ProfileRow>
              <ProfileRow label="Gewicht">
                {profile.weight_start_kg
                  ? `${profile.weight_start_kg} kg`
                  : "—"}
                {profile.weight_target_kg ? (
                  <>
                    <span className="mx-2 text-bone-muted">→</span>
                    <span className="text-gold-soft">
                      {profile.weight_target_kg} kg
                    </span>
                  </>
                ) : null}
              </ProfileRow>
              <ProfileRow label="Ziel">{labelGoal(profile.goal)}</ProfileRow>
              <ProfileRow label="Erfahrung">
                {profile.experience_level ?? "—"}
              </ProfileRow>
              <ProfileRow label="Equipment">
                {profile.equipment ?? "—"}
              </ProfileRow>
              <ProfileRow label="Allergien">
                {profile.allergies && profile.allergies.length > 0
                  ? profile.allergies.join(", ")
                  : "Keine"}
              </ProfileRow>
              <ProfileRow label="Vorlieben">
                {profile.food_preferences && profile.food_preferences.length > 0
                  ? profile.food_preferences.join(", ")
                  : "—"}
              </ProfileRow>
              {profile.notes && (
                <ProfileRow label="Notizen">
                  <span className="italic text-bone-muted">
                    {profile.notes}
                  </span>
                </ProfileRow>
              )}
            </dl>
          ) : (
            <Empty>Noch kein Profil — Intake nicht abgeschlossen.</Empty>
          )}
        </Panel>

        {/* Targets */}
        <Panel title="Tagesziele">
          {profile && profile.daily_kcal_target ? (
            <div className="space-y-7">
              <div>
                <p className="text-[9px] tracking-caps uppercase text-gold font-medium mb-2">
                  Kalorien
                </p>
                <p className="font-serif text-4xl text-bone tabular-nums leading-none">
                  {formatNumber(profile.daily_kcal_target)}
                  <span className="text-sm text-bone-muted ml-2 font-sans">
                    kcal/Tag
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
                <TargetCell
                  label="Protein"
                  value={profile.protein_target_g}
                />
                <TargetCell
                  label="Carbs"
                  value={profile.carbs_target_g}
                />
                <TargetCell
                  label="Fett"
                  value={profile.fat_target_g}
                />
              </div>
            </div>
          ) : (
            <Empty>
              Keine Tagesziele gesetzt. Goal-Editor kommt in einer späteren Etappe.
            </Empty>
          )}
        </Panel>

        {/* Recent meals */}
        <Panel title={`Letzte Mahlzeiten · ${recentLogs.length}`}>
          {recentLogs.length === 0 ? (
            <Empty>Noch keine Logs.</Empty>
          ) : (
            <div>
              {recentLogs.map((l) => (
                <MealRow
                  key={l.id}
                  type={l.meal_type}
                  description={l.raw_description}
                  protein={l.protein_g != null ? Number(l.protein_g) : null}
                  carbs={l.carbs_g != null ? Number(l.carbs_g) : null}
                  fat={l.fat_g != null ? Number(l.fat_g) : null}
                  kcal={l.total_kcal}
                  loggedAt={l.logged_at}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Recent messages */}
        <Panel title={`Letzte Nachrichten · ${messages.length}`}>
          {messages.length === 0 ? (
            <Empty>Noch keine Nachrichten.</Empty>
          ) : (
            <div>
              {messages.map((m) => (
                <MessageRow
                  key={m.id}
                  direction={m.direction}
                  content={m.content}
                  agentName={m.agent_name}
                  createdAt={m.created_at}
                />
              ))}
            </div>
          )}
        </Panel>
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
    <section className={topMargin ? "mt-12" : ""}>
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

function TargetCell({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="bg-ink-900 px-3 py-4 text-center">
      <p className="font-serif text-2xl text-bone tabular-nums leading-none">
        {value ?? "—"}
        {value && (
          <span className="text-xs text-bone-muted ml-1 font-sans">g</span>
        )}
      </p>
      <p className="text-[9px] tracking-capsTight uppercase text-bone-muted mt-2 font-medium">
        {label}
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-bone-muted italic">{children}</p>;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "border-gold/40 text-gold",
    intake: "border-bone/30 text-bone",
    paused: "border-bone-muted/30 text-bone-muted",
    archived: "border-bone-faint text-bone-faint",
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
