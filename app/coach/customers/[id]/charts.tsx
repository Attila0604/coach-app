// Pure-SVG/CSS chart components. No external dependencies.
// Premium Gold-Tone: gold/soft/deep family + bone subtleties.

type DailyKcal = { date: string; kcal: number; logCount: number };

export function KcalLast7Chart({
  data,
  target,
}: {
  data: DailyKcal[];
  target: number | null;
}) {
  const max = Math.max(...data.map((d) => d.kcal), target ?? 0, 100);
  const avg = Math.round(data.reduce((s, d) => s + d.kcal, 0) / data.length);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
          Kalorien · 7 Tage
        </span>
        <span className="text-[11px] text-bone-muted tabular-nums">
          Ø {avg} kcal
        </span>
      </div>

      <div className="relative h-32 flex items-end gap-1.5">
        {target && target > 0 && target <= max && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-gold/40 pointer-events-none z-0"
            style={{ bottom: `${(target / max) * 100}%` }}
          >
            <span className="absolute -top-3 right-0 text-[9px] tracking-capsTight uppercase text-gold tabular-nums bg-ink-900 px-1">
              Ziel {target}
            </span>
          </div>
        )}

        {data.map((d, i) => {
          const height = (d.kcal / max) * 100;
          const isToday = i === data.length - 1;
          const hasData = d.kcal > 0;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center gap-2 min-w-0"
            >
              <div className="flex-1 w-full flex items-end justify-center">
                {hasData ? (
                  <div
                    className={`w-full transition-all ${
                      isToday
                        ? "bg-gold"
                        : "bg-gold-deep/40"
                    }`}
                    style={{ height: `${Math.max(height, 3)}%` }}
                    title={`${d.kcal} kcal`}
                  />
                ) : (
                  <div className="w-full h-px bg-white/[0.06]" />
                )}
              </div>
              <span
                className={`text-[9px] tracking-capsTight uppercase font-medium ${
                  isToday ? "text-gold" : "text-bone-faint"
                }`}
              >
                {dayLabel(d.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StreakHeatmap({ data }: { data: DailyKcal[] }) {
  const totalLogged = data.filter((d) => d.logCount > 0).length;
  const currentStreak = calcCurrentStreak(data);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
          Aktivität · 30 Tage
        </span>
        <span className="text-[11px] text-bone-muted tabular-nums">
          {totalLogged} / {data.length} Tage
          {currentStreak > 0 && (
            <span className="text-gold ml-2">
              🔥 {currentStreak} Streak
            </span>
          )}
        </span>
      </div>

      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: "repeat(10, minmax(0, 1fr))" }}
      >
        {data.map((d) => {
          const intensity = Math.min(d.logCount, 4);
          const bgClass =
            intensity === 0
              ? "bg-white/[0.04]"
              : intensity === 1
              ? "bg-gold/20"
              : intensity === 2
              ? "bg-gold/40"
              : intensity === 3
              ? "bg-gold/65"
              : "bg-gold";
          return (
            <div
              key={d.date}
              className={`aspect-square ${bgClass} hover:scale-110 transition-transform`}
              title={`${d.date}: ${d.logCount} Logs`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 text-[10px] tracking-capsTight uppercase text-bone-faint font-medium">
        <span>weniger</span>
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 bg-white/[0.04]" />
          <span className="w-2.5 h-2.5 bg-gold/20" />
          <span className="w-2.5 h-2.5 bg-gold/40" />
          <span className="w-2.5 h-2.5 bg-gold/65" />
          <span className="w-2.5 h-2.5 bg-gold" />
        </div>
        <span>mehr</span>
      </div>
    </div>
  );
}

export function MacroBreakdown({
  protein,
  carbs,
  fat,
}: {
  protein: number;
  carbs: number;
  fat: number;
}) {
  const total = protein + carbs + fat;
  if (total === 0) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            Makros · 7 Tage
          </span>
        </div>
        <p className="text-sm text-bone-muted italic">Noch keine Daten.</p>
      </div>
    );
  }

  const proteinKcal = protein * 4;
  const carbsKcal = carbs * 4;
  const fatKcal = fat * 9;
  const totalKcal = proteinKcal + carbsKcal + fatKcal || 1;
  const pP = Math.round((proteinKcal / totalKcal) * 100);
  const pC = Math.round((carbsKcal / totalKcal) * 100);
  const pF = Math.max(0, 100 - pP - pC);

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
          Makros · 7 Tage
        </span>
        <span className="text-[11px] text-bone-muted tabular-nums">
          {Math.round(totalKcal)} kcal gesamt
        </span>
      </div>

      <div className="flex h-[3px] overflow-hidden bg-white/[0.06]">
        <div
          className="bg-gold"
          style={{ width: `${pP}%` }}
          title={`Protein ${pP}%`}
        />
        <div
          className="bg-gold-soft"
          style={{ width: `${pC}%` }}
          title={`Carbs ${pC}%`}
        />
        <div
          className="bg-gold-deep"
          style={{ width: `${pF}%` }}
          title={`Fett ${pF}%`}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-5">
        <MacroLegend
          label="Protein"
          value={Math.round(protein)}
          pct={pP}
          variant="gold"
        />
        <MacroLegend
          label="Carbs"
          value={Math.round(carbs)}
          pct={pC}
          variant="soft"
        />
        <MacroLegend
          label="Fett"
          value={Math.round(fat)}
          pct={pF}
          variant="deep"
        />
      </div>
    </div>
  );
}

function MacroLegend({
  label,
  value,
  pct,
  variant,
}: {
  label: string;
  value: number;
  pct: number;
  variant: "gold" | "soft" | "deep";
}) {
  const dotClass = {
    gold: "bg-gold",
    soft: "bg-gold-soft",
    deep: "bg-gold-deep",
  }[variant];

  return (
    <div className="flex items-baseline gap-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotClass}`} />
      <div className="min-w-0">
        <div className="text-[9px] tracking-capsTight uppercase text-bone-muted font-medium">
          {label}
        </div>
        <div className="text-sm text-bone tabular-nums">
          {value}
          <span className="text-bone-muted ml-0.5">g</span>
          <span className="text-bone-faint mx-1.5">·</span>
          <span className="text-bone-muted">{pct}%</span>
        </div>
      </div>
    </div>
  );
}

export function WeightProgress({
  start,
  target,
}: {
  start: number | null;
  target: number | null;
}) {
  if (!start || !target) {
    return (
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            Gewicht · Fortschritt
          </span>
        </div>
        <p className="text-sm text-bone-muted italic">
          Start- oder Zielgewicht fehlt im Profil.
        </p>
      </div>
    );
  }

  const isLoss = target < start;
  const diff = Math.abs(start - target);
  const direction = isLoss ? "abnehmen" : "aufbauen";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-4">
        <span className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
          Gewicht · Ziel
        </span>
        <span className="text-[11px] text-bone-muted tabular-nums">
          {diff.toFixed(1)} kg {direction}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-center">
          <div className="text-[9px] tracking-capsTight uppercase text-bone-muted font-medium mb-1">
            Start
          </div>
          <div className="font-serif text-2xl text-bone tabular-nums leading-none">
            {start}
            <span className="text-xs text-bone-muted ml-0.5 font-sans">kg</span>
          </div>
        </div>

        <div className="flex-1 relative h-[3px] bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 bg-gold"
            style={{ width: "0%" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[9px] tracking-capsTight uppercase text-bone-faint font-medium -translate-y-3">
            0% des Wegs
          </div>
        </div>

        <div className="text-center">
          <div className="text-[9px] tracking-capsTight uppercase text-gold font-medium mb-1">
            Ziel
          </div>
          <div className="font-serif text-2xl text-gold tabular-nums leading-none">
            {target}
            <span className="text-xs text-bone-muted ml-0.5 font-sans">kg</span>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-bone-faint mt-4 text-center italic">
        Sobald der Kunde sein aktuelles Gewicht loggt, wird der Fortschritt sichtbar.
      </p>
    </div>
  );
}

// Helpers

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-DE", { weekday: "short" }).slice(0, 2);
}

function calcCurrentStreak(data: DailyKcal[]): number {
  let streak = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i].logCount > 0) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
