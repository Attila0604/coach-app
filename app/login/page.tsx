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
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-[0.18em] text-gold mb-3">
            Coach App · Beta
          </p>
          <h1 className="font-serif text-3xl text-white mb-2">Willkommen</h1>
          <p className="text-white/55 text-sm">Melde dich an, um deine Kunden zu sehen.</p>
        </div>

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-xs uppercase tracking-wider text-white/45 mb-2">
              E-Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-gold/50 focus:bg-white/[0.07] transition"
              placeholder="dein@email.de"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-wider text-white/45 mb-2">
              Passwort
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-gold/50 focus:bg-white/[0.07] transition"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 bg-gradient-to-b from-gold-soft to-gold-deep text-ink-900 font-medium rounded-xl disabled:opacity-60 disabled:cursor-not-allowed hover:-translate-y-px transition-all"
          >
            {isPending ? "Wird geprüft …" : "Anmelden"}
          </button>
        </form>

        <p className="text-center text-xs text-white/35 mt-8">
          Phase 1 · Beta-Zugang nur für eingeladene Coaches
        </p>
      </div>
    </main>
  );
}
