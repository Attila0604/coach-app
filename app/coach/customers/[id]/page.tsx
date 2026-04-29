import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

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

function labelGoal(g: string | null): string {
  if (!g) return "—";
  return GOAL_LABELS[g.toLowerCase()] ?? g;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("de-DE").format(Math.round(Number(n)));
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

  // Load coach record
  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!coach) notFound();

  // Load customer (RLS already filters to own coach, but we double-check)
  const { data: customer } = await supabase
    .from("customers")
    .select(
      "id, first_name, telegram_username, telegram_chat_id, status, onboarded_at, created_at, coach_id"
    )
    .eq("id", params.id)
    .eq("coach_id", coach.id)
    .maybeSingle();

  if (!customer) notFound();

  // Load profile
  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("customer_id", params.id)
    .maybeSingle();

  // Load recent logs
  const { data: logsRaw } = await supabase
    .from("food_logs")
    .select(
      "id, logged_at, meal_type, raw_description, total_kcal, protein_g, carbs_g, fat_g"
    )
    .eq("customer_id", params.id)
    .order("logged_at", { ascending: false })
    .limit(10);

  const logs = logsRaw ?? [];

  // Load recent messages
  const { data: msgsRaw } = await supabase
    .from("messages")
    .select("id, direction, content, agent_name, created_at")
    .eq("customer_id", params.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const messages = msgsRaw ?? [];

  // Today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayLogs = logs.filter(
    (l) => l.logged_at && new Date(l.logged_at) >= today
  );
  const todayKcal = todayLogs.reduce(
    (sum, l) => sum + (l.total_kcal ?? 0),
    0
  );

  const displayName =
    customer.first_name || customer.telegram_username || "Kunde";

  return (
    <div>
      {/* Back nav */}
      <Link
        href="/coach/customers"
        className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white mb-6 transition"
      >
        <span>←</span>
        <span>Zurück zur Kundenliste</span>
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-6 mb-10 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-gold mb-3">
            Kunde
          </p>
          <h1 className="font-serif text-4xl text-white mb-2">{displayName}</h1>
          <div className="flex items-center gap-3 text-sm text-white/55 flex-wrap">
            {customer.telegram_username && (
              <span>@{customer.telegram_username}</span>
            )}
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>seit {formatDate(customer.created_at)}</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span className="tabular-nums">
              Telegram {customer.telegram_chat_id}
            </span>
          </div>
        </div>
        <StatusBadge status={customer.status} />
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard
          label="Heute geloggt"
          value={`${todayLogs.length}`}
          subline={`${formatNumber(todayKcal)} kcal`}
          accent="gold"
        />
        <StatCard
          label="Logs (zuletzt)"
          value={`${logs.length}`}
          subline={
            logs.length > 0 && logs[0].logged_at
              ? `Letzter: ${formatDateTime(logs[0].logged_at)}`
              : "Noch keine Logs"
          }
          accent="green"
        />
        <StatCard
          label="Status"
          value={customer.status ?? "—"}
          subline={
            customer.onboarded_at
              ? `Onboarded ${formatDate(customer.onboarded_at)}`
              : "Noch nicht onboarded"
          }
          accent="neutral"
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <Section title="Profil">
          {profile ? (
            <dl className="space-y-3 text-sm">
              <Row label="Alter">{profile.age ?? "—"}</Row>
              <Row label="Geschlecht">{profile.gender ?? "—"}</Row>
              <Row label="Größe">
                {profile.height_cm ? `${profile.height_cm} cm` : "—"}
              </Row>
              <Row label="Gewicht">
                {profile.weight_start_kg
                  ? `${profile.weight_start_kg} kg`
                  : "—"}
                {profile.weight_target_kg ? (
                  <>
                    {" "}
                    →{" "}
                    <span className="text-gold-soft">
                      {profile.weight_target_kg} kg
                    </span>
                  </>
                ) : null}
              </Row>
              <Row label="Ziel">{labelGoal(profile.goal)}</Row>
              <Row label="Erfahrung">{profile.experience_level ?? "—"}</Row>
              <Row label="Equipment">{profile.equipment ?? "—"}</Row>
              <Row label="Allergien">
                {profile.allergies && profile.allergies.length > 0
                  ? profile.allergies.join(", ")
                  : "Keine"}
              </Row>
              <Row label="Vorlieben">
                {profile.food_preferences &&
                profile.food_preferences.length > 0
                  ? profile.food_preferences.join(", ")
                  : "—"}
              </Row>
              {profile.notes && (
                <Row label="Notizen">
                  <span className="text-white/70 italic">{profile.notes}</span>
                </Row>
              )}
            </dl>
          ) : (
            <p className="text-sm text-white/45">
              Noch kein Profil — Intake möglicherweise nicht abgeschlossen.
            </p>
          )}
        </Section>

        {/* Targets */}
        <Section title="Tagesziele">
          {profile && profile.daily_kcal_target ? (
            <div className="space-y-5">
              <div className="bg-gradient-to-br from-gold/15 to-gold/5 border border-gold/25 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-gold/80 mb-2">
                  Kalorien
                </p>
                <p className="font-serif text-3xl text-white tabular-nums">
                  {formatNumber(profile.daily_kcal_target)}
                  <span className="text-sm text-white/45 ml-2 font-sans">
                    kcal/Tag
                  </span>
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Macro
                  label="Protein"
                  value={profile.protein_target_g}
                  color="green"
                />
                <Macro
                  label="Carbs"
                  value={profile.carbs_target_g}
                  color="gold"
                />
                <Macro label="Fett" value={profile.fat_target_g} color="rose" />
              </div>
              {profile.updated_at && (
                <p className="text-xs text-white/35 pt-2">
                  zuletzt aktualisiert: {formatDateTime(profile.updated_at)}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/45">
              Keine Tagesziele gesetzt. (Goal-Editor kommt in einer späteren
              Etappe.)
            </p>
          )}
        </Section>

        {/* Recent food logs */}
        <Section title="Letzte Mahlzeiten">
          {logs.length === 0 ? (
            <p className="text-sm text-white/45">Noch keine Logs.</p>
          ) : (
            <ul className="space-y-3">
              {logs.map((l) => (
                <li
                  key={l.id}
                  className="bg-white/[0.025] rounded-xl px-4 py-3 hover:bg-white/[0.04] transition"
                >
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-xs text-gold-soft tabular-nums">
                      {formatDateTime(l.logged_at)}
                    </span>
                    <span className="text-sm text-white tabular-nums font-medium">
                      {formatNumber(l.total_kcal)} kcal
                    </span>
                  </div>
                  {l.meal_type && (
                    <p className="text-xs uppercase tracking-wider text-white/45 mb-1">
                      {l.meal_type}
                    </p>
                  )}
                  <p className="text-sm text-white/85 leading-snug">
                    {l.raw_description ?? "—"}
                  </p>
                  {(l.protein_g || l.carbs_g || l.fat_g) && (
                    <p className="text-xs text-white/40 mt-2 tabular-nums">
                      P {formatNumber(Number(l.protein_g))}g · C{" "}
                      {formatNumber(Number(l.carbs_g))}g · F{" "}
                      {formatNumber(Number(l.fat_g))}g
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Recent messages */}
        <Section title="Letzte Nachrichten">
          {messages.length === 0 ? (
            <p className="text-sm text-white/45">Noch keine Nachrichten.</p>
          ) : (
            <ul className="space-y-2">
              {messages.map((m) => (
                <li
                  key={m.id}
                  className="bg-white/[0.025] rounded-xl px-4 py-3"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-xs uppercase tracking-wider text-white/40">
                      {m.direction === "outbound"
                        ? "Bot →"
                        : m.direction === "inbound"
                        ? "← Kunde"
                        : m.direction ?? "—"}
                    </span>
                    <span className="text-xs text-white/35 tabular-nums">
                      {formatDateTime(m.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-white/85 leading-snug whitespace-pre-wrap line-clamp-3">
                    {m.content ?? "—"}
                  </p>
                  {m.agent_name && (
                    <p className="text-[10px] uppercase tracking-wider text-white/30 mt-1">
                      {m.agent_name}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <h2 className="text-xs uppercase tracking-wider text-white/45 mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.04] pb-2 last:border-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wider text-white/40 shrink-0">
        {label}
      </dt>
      <dd className="text-white/90 text-right">{children}</dd>
    </div>
  );
}

function Macro({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null | undefined;
  color: "green" | "gold" | "rose";
}) {
  const tone =
    color === "green"
      ? "text-emerald-300 border-emerald-400/20"
      : color === "gold"
      ? "text-gold-soft border-gold/20"
      : "text-rose-300 border-rose-500/20";

  return (
    <div className={`bg-white/[0.025] border rounded-xl px-3 py-3 ${tone}`}>
      <p className="text-[10px] uppercase tracking-wider opacity-80 mb-1">
        {label}
      </p>
      <p className="font-serif text-xl text-white tabular-nums">
        {value ?? "—"}
        <span className="text-xs text-white/45 ml-1 font-sans">g</span>
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
    intake: "bg-gold/10 text-gold-soft border-gold/20",
    paused: "bg-white/5 text-white/55 border-white/10",
    archived: "bg-rose-500/10 text-rose-300 border-rose-500/20",
  };
  const style = styles[status] ?? styles.paused;
  return (
    <span
      className={`text-xs px-3 py-1.5 rounded-full border ${style} uppercase tracking-wide`}
    >
      {status}
    </span>
  );
}

function StatCard({
  label,
  value,
  subline,
  accent,
}: {
  label: string;
  value: string | number;
  subline: string;
  accent: "gold" | "green" | "neutral";
}) {
  const accentClass =
    accent === "gold"
      ? "from-gold/15 to-gold/5 border-gold/25"
      : accent === "green"
      ? "from-emerald-400/10 to-emerald-400/[0.02] border-emerald-400/20"
      : "from-white/[0.04] to-white/[0.01] border-white/[0.08]";

  return (
    <div className={`bg-gradient-to-b ${accentClass} border rounded-2xl p-5`}>
      <p className="text-xs uppercase tracking-wider text-white/55 mb-3">
        {label}
      </p>
      <p className="font-serif text-3xl text-white tabular-nums">{value}</p>
      <p className="text-xs text-white/45 mt-2">{subline}</p>
    </div>
  );
}
