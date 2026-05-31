"use client";

import { useState, useTransition } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-[2rem] border border-white/[0.08] bg-white/[0.035] p-6 shadow-2xl shadow-black/30 sm:p-8">
        <div className="mb-8 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-gold">
            Coach App · Beta
          </p>
          <h1 className="mb-2 font-serif text-4xl text-bone">Willkommen</h1>
          <p className="text-sm text-bone-muted">
            Melde dich an, um deine Kunden zu sehen.
          </p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-xs uppercase tracking-wider text-bone-faint">
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.045] px-4 py-3 text-bone placeholder:text-bone-faint transition focus:border-gold/50 focus:bg-white/[0.07] focus:outline-none"
              placeholder="dein@email.de"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs uppercase tracking-wider text-bone-faint">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/[0.1] bg-white/[0.045] px-4 py-3 text-bone placeholder:text-bone-faint transition focus:border-gold/50 focus:bg-white/[0.07] focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-gradient-to-b from-gold-soft to-gold-deep py-3 font-medium text-ink-900 transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Wird geprüft …" : "Anmelden"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-bone-faint">
          Phase 1 · Beta-Zugang nur für eingeladene Coaches
        </p>
      </div>
    </main>
  );
}
