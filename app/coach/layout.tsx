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
      <header className="border-b border-white/5 bg-ink-800/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/coach" className="flex items-baseline gap-2">
              <span className="font-serif text-lg text-white">Coach</span>
              <span className="text-xs uppercase tracking-[0.18em] text-gold">Beta</span>
            </Link>
            <nav className="flex gap-5 text-sm">
              <Link href="/coach" className="text-white/70 hover:text-white transition">
                Übersicht
              </Link>
              <Link
                href="/coach/customers"
                className="text-white/70 hover:text-white transition"
              >
                Kunden
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-white/60 hidden sm:inline">{displayName}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/85 hover:bg-white/10 transition"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
