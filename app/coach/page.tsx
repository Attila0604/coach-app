import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

export default async function CoachDashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load coach + role
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isAdmin = coach?.role === "admin";

  let totalCustomers = 0;
  let activeCustomers = 0;
  let intakeCustomers = 0;

  if (coach) {
    // Build base count query, optionally scoped to this coach's customers.
    // Admin skips the coach_id filter to see all customers in the system.
    const buildQuery = (status?: string) => {
      let q = supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      if (!isAdmin) q = q.eq("coach_id", coach.id);
      if (status) q = q.eq("status", status);
      return q;
    };

    const [totalRes, activeRes, intakeRes] = await Promise.all([
      buildQuery(),
      buildQuery("active"),
      buildQuery("intake"),
    ]);

    totalCustomers = totalRes.count ?? 0;
    activeCustomers = activeRes.count ?? 0;
    intakeCustomers = intakeRes.count ?? 0;
  }

  const firstName = (coach?.name ?? "").split(" ")[0] || "Coach";

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-gold mb-3">
        {isAdmin ? "Admin · Übersicht" : "Heute"}
      </p>
      <h1 className="font-serif text-4xl text-white mb-2">Hallo {firstName}</h1>
      <p className="text-white/55 mb-10">
        {isAdmin
          ? "Übersicht über alle Coaches und Kunden im System."
          : "Schön dich wiederzusehen. Hier ist deine Übersicht."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label="Aktive Kunden" value={activeCustomers} accent="gold" />
        <StatCard label="Im Intake" value={intakeCustomers} accent="green" />
        <StatCard label="Gesamt" value={totalCustomers} accent="neutral" />
      </div>

      <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wider text-white/45 mb-3">
          Schnellzugriff
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/coach/customers"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-b from-gold-soft to-gold-deep text-ink-900 text-sm font-medium hover:-translate-y-px transition-all"
          >
            Kundenliste öffnen →
          </Link>
        </div>
      </div>

      {!coach && (
        <div className="mt-8 bg-rose-500/10 border border-rose-500/20 text-rose-200 rounded-xl px-5 py-4 text-sm">
          Hinweis: Dein Auth-Account ist nicht mit einem Coach-Eintrag verknüpft.
          Bitte sprich mit dem Admin.
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "gold" | "green" | "neutral";
}) {
  const accentClass =
    accent === "gold"
      ? "from-gold/15 to-gold/5 border-gold/25"
      : accent === "green"
      ? "from-emerald-400/10 to-emerald-400/[0.02] border-emerald-400/20"
      : "from-white/[0.04] to-white/[0.01] border-white/[0.08]";

  return (
    <div
      className={`bg-gradient-to-b ${accentClass} border rounded-2xl p-5`}
    >
      <p className="text-xs uppercase tracking-wider text-white/55 mb-3">
        {label}
      </p>
      <p className="font-serif text-3xl text-white tabular-nums">{value}</p>
    </div>
  );
}
