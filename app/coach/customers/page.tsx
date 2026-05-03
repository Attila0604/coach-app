import Link from "next/link";
import { createClient } from "@/lib/supabase-server";

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  intake: "Onboarding",
  paused: "Pausiert",
  archived: "Archiviert",
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function CustomersPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: customers } = coach
    ? await supabase
        .from("customers")
        .select(
          "id, first_name, telegram_username, status, telegram_chat_id, created_at"
        )
        .eq("coach_id", coach.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const list = customers ?? [];
  const activeCount = list.filter((c) => c.status === "active").length;
  const intakeCount = list.filter((c) => c.status === "intake").length;

  return (
    <div>
      {/* === Header === */}
      <div className="mb-12">
        <p className="text-[9px] tracking-caps uppercase text-gold font-medium mb-3">
          Übersicht
        </p>
        <h1 className="font-serif text-5xl text-bone leading-tight mb-4">
          Deine Kunden
        </h1>
        <p className="text-sm text-bone-muted">
          {list.length === 0
            ? "Noch keine Kunden — sobald jemand dem Bot schreibt, erscheint er hier."
            : `${list.length} ${
                list.length === 1 ? "Kunde" : "Kunden"
              } insgesamt.`}
        </p>
      </div>

      {/* === Stat strip === */}
      {list.length > 0 && (
        <div className="grid grid-cols-3 gap-px bg-white/[0.06] mb-12">
          <StatCell value={list.length} label="Gesamt" />
          <StatCell value={activeCount} label="Aktiv" accent />
          <StatCell value={intakeCount} label="Onboarding" />
        </div>
      )}

      {/* === Customer list === */}
      {list.length > 0 && (
        <div>
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-6 px-1 pb-4 border-b border-white/[0.06]">
            <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
              Name
            </span>
            <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium text-right">
              Status
            </span>
            <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium text-right w-32">
              Seit · Chat-ID
            </span>
          </div>

          {/* Rows */}
          {list.map((c) => (
            <Link
              key={c.id}
              href={`/coach/customers/${c.id}`}
              className="grid grid-cols-[1fr_auto_auto] gap-6 px-1 py-5 border-b border-white/[0.06] items-center hover:bg-white/[0.015] transition group"
            >
              <div className="min-w-0">
                <p className="font-serif text-xl text-bone group-hover:text-gold-soft transition leading-tight">
                  {c.first_name || c.telegram_username || "Kunde"}
                </p>
                {c.telegram_username && c.first_name && (
                  <p className="text-[11px] text-bone-muted mt-1">
                    @{c.telegram_username}
                  </p>
                )}
              </div>

              <StatusBadge status={c.status} />

              <div className="text-right w-32">
                <p className="text-[11px] text-bone-muted tabular-nums">
                  {formatDate(c.created_at)}
                </p>
                <p className="text-[10px] text-bone-faint tabular-nums mt-0.5">
                  {c.telegram_chat_id}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============== local helpers ============== */

function StatCell({
  value,
  label,
  accent = false,
}: {
  value: number;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-ink-900 px-3 py-5 text-center">
      <div
        className={`font-serif text-3xl leading-none tabular-nums ${
          accent ? "text-gold" : "text-bone"
        }`}
      >
        {value}
      </div>
      <div className="text-[9px] tracking-caps text-bone-muted font-medium mt-2.5 uppercase">
        {label}
      </div>
    </div>
  );
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
      className={`text-[10px] px-3 py-1.5 border ${style} tracking-caps uppercase font-medium whitespace-nowrap`}
    >
      {label}
    </span>
  );
}
