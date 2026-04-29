import { createClient } from "@/lib/supabase-server";

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
        .select("id, first_name, username, status, telegram_chat_id, created_at")
        .eq("coach_id", coach.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const list = customers ?? [];

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-gold mb-3">Übersicht</p>
      <h1 className="font-serif text-4xl text-white mb-2">Deine Kunden</h1>
      <p className="text-white/55 mb-8">
        {list.length === 0
          ? "Noch keine Kunden — sobald jemand dem Bot schreibt, erscheint er hier."
          : `${list.length} Kunde${list.length === 1 ? "" : "n"} insgesamt.`}
      </p>

      {list.length > 0 && (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-3 border-b border-white/[0.05] text-xs uppercase tracking-wider text-white/40">
            <span>Name</span>
            <span>Status</span>
            <span>Chat-ID</span>
          </div>
          {list.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 py-4 border-b border-white/[0.04] last:border-0 items-center hover:bg-white/[0.02] transition"
            >
              <div>
                <p className="text-white font-medium">
                  {c.first_name || c.username || "Kunde"}
                </p>
                {c.username && c.first_name && (
                  <p className="text-xs text-white/40">@{c.username}</p>
                )}
              </div>
              <StatusBadge status={c.status} />
              <span className="text-xs text-white/40 tabular-nums">
                {c.telegram_chat_id}
              </span>
            </div>
          ))}
        </div>
      )}
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
      className={`text-xs px-2.5 py-1 rounded-full border ${style} uppercase tracking-wide`}
    >
      {status}
    </span>
  );
}
