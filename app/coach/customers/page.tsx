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
    .select("id, role")
    .eq("user_id", user!.id)
    .maybeSingle();

  const isAdmin = coach?.role === "admin";

  let customerQuery = supabase
    .from("customers")
    .select(
      "id, first_name, telegram_username, status, telegram_chat_id, created_at"
    )
    .order("created_at", { ascending: false });

  if (!isAdmin && coach) {
    customerQuery = customerQuery.eq("coach_id", coach.id);
  }

  const { data: customers } = coach ? await customerQuery : { data: [] };

  const list = customers ?? [];
  const activeCount = list.filter((c) => c.status === "active").length;
  const intakeCount = list.filter((c) => c.status === "intake").length;
  const pausedCount = list.filter((c) => c.status === "paused").length;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-gold/[0.06] p-6 sm:p-8">
        <div className="max-w-2xl">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-caps text-gold">
            {isAdmin ? "Admin · Alle Kunden" : "Kundenübersicht"}
          </p>
          <h1 className="font-serif text-4xl leading-tight text-bone sm:text-5xl">
            {isAdmin ? "Alle Kunden" : "Deine Kunden"}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-bone-muted">
            {list.length === 0
              ? "Noch keine Kunden — sobald jemand dem Bot schreibt, erscheint er hier."
              : `${list.length} ${
                  list.length === 1 ? "Kunde" : "Kunden"
                } im System, kompakt nach Status und Chat verlinkt.`}
          </p>
        </div>
      </section>

      {list.length > 0 && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCell value={list.length} label="Gesamt" hint="Kunden" />
          <StatCell value={activeCount} label="Aktiv" hint="im Coaching" accent />
          <StatCell value={intakeCount} label="Onboarding" hint="im Intake" />
          <StatCell value={pausedCount} label="Pausiert" hint="ruhend" />
        </div>
      )}

      {list.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.025] p-8 text-sm italic text-bone-faint">
          Noch keine Kunden vorhanden.
        </div>
      ) : (
        <section className="rounded-3xl border border-white/[0.08] bg-black/20 p-4 sm:p-5">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-caps text-bone-faint">
                Kunden
              </p>
              <p className="text-xs font-medium uppercase tracking-capsTight text-gold">
                Neueste zuerst
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            {list.map((c) => (
            <Link
              key={c.id}
              href={`/coach/customers/${c.id}`}
                className="group grid gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-4 transition hover:border-gold/25 hover:bg-white/[0.045] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
            >
              <div className="min-w-0">
                  <p className="font-serif text-xl leading-tight text-bone transition group-hover:text-gold-soft">
                  {c.first_name || c.telegram_username || "Kunde"}
                </p>
                {c.telegram_username && c.first_name && (
                    <p className="mt-1 text-[11px] text-bone-muted">
                    @{c.telegram_username}
                  </p>
                )}
              </div>

              <StatusBadge status={c.status} />

                <div className="text-left sm:w-36 sm:text-right">
                  <p className="text-[11px] tabular-nums text-bone-muted">
                  {formatDate(c.created_at)}
                </p>
                  <p className="mt-0.5 truncate text-[10px] tabular-nums text-bone-faint">
                  {c.telegram_chat_id}
                </p>
              </div>
            </Link>
          ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============== local helpers ============== */

function StatCell({
  value,
  label,
  hint,
  accent = false,
}: {
  value: number;
  label: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        accent
          ? "border-gold/30 bg-gold/[0.07]"
          : "border-white/[0.08] bg-white/[0.035]"
      }`}
    >
      <div
        className={`font-serif text-3xl leading-none tabular-nums ${
          accent ? "text-gold" : "text-bone"
        }`}
      >
        {value}
      </div>
      <div className="mt-3 text-[9px] font-medium uppercase tracking-caps text-bone-muted">
        {label}
      </div>
      <div className="mt-1 text-[11px] text-bone-faint">{hint}</div>
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
      className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-medium uppercase tracking-caps ${style}`}
    >
      {label}
    </span>
  );
}
