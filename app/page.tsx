export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="text-xs uppercase tracking-[0.18em] text-gold mb-4">
          Coach App · Beta
        </p>
        <h1 className="font-serif text-4xl text-white mb-4">
          Willkommen
        </h1>
        <p className="text-white/55 text-sm leading-relaxed mb-8">
          Premium-Coaching für Ernährung und Ausdauer. Setup läuft, das Login
          kommt im nächsten Schritt.
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gold/30 bg-gold/10 text-gold-soft text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-gold-soft animate-pulse" />
          Phase 1 – Grundgerüst läuft
        </div>
      </div>
    </main>
  );
}
