import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { logout } from "../login/actions";

export default async function CoachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load coach record via user_id
  const { data: coach } = await supabase
    .from("coaches")
    .select("id, name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const displayName = coach?.name ?? user.email ?? "Coach";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-ink-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <Link href="/coach" className="group flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl border border-gold/25 bg-gold/10 font-serif text-lg text-gold transition group-hover:border-gold/50">
                C
              </span>
              <span className="hidden leading-none sm:block">
                <span className="block font-serif text-lg text-bone">Coach</span>
                <span className="block text-[9px] uppercase tracking-capsTight text-gold">
                  Beta
                </span>
              </span>
            </Link>
            <nav className="flex rounded-full border border-white/[0.08] bg-white/[0.035] p-1 text-xs">
              <Link
                href="/coach"
                className="rounded-full px-3 py-1.5 text-bone-muted transition hover:bg-white/[0.06] hover:text-bone"
              >
                Übersicht
              </Link>
              <Link
                href="/coach/customers"
                className="rounded-full px-3 py-1.5 text-bone-muted transition hover:bg-white/[0.06] hover:text-bone"
              >
                Kunden
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-40 truncate text-xs text-bone-muted sm:inline">
              {displayName}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs text-bone-muted transition hover:border-gold/25 hover:bg-gold/10 hover:text-gold"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
