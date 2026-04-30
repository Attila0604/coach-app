// Pure-SVG/CSS chart components. No external dependencies.

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
        <span className="text-xs uppercase tracking-wider text-white/45">
          Kalorien · 7 Tage
        </span>
        <span className="text-xs text-white/55 tabular-nums">
          Ø {avg} kcal
        </span>
      </div>

      <div className="relative h-32 flex items-end gap-1.5">
        {target && target > 0 && target <= max && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-gold/40 pointer-events-none z-0"
            style={{ bottom: `${(target / max) * 100}%` }}
          >
            <span className="absolute -top-3 right-0 text-[9px] text-gold/60 tabular-nums bg-ink-700 px-1">
              Ziel {target}
            </span>
          </div>
        )}

        {data.map((d, i) => {
          const height = (d.kcal / max) * 100;
          const isToday = i === data.length - 1;
          const hasData = d.kcal > 0;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2 min-w-0">
              <div className="flex-1 w-full flex items-end justify-center">
                {hasData ? (
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      isToday
                        ? "bg-gradient-to-t from-gold-deep to-gold-soft"
                        : "bg-gradient-to-t from-white/8 to-white/20"
                    }`}
                    style={{ height: `${Math.max(height, 3)}%` }}
                    title={`${d.kcal} kcal`}
                  />
                ) : (
                  <div className="w-full h-1 bg-white/[0.06] rounded-full" />
                )}
              </div>
              <span
                className={`text-[9px] uppercase tracking-wide ${
                  isToday ? "text-gold-soft" : "text-white/35"
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
        <span className="text-xs uppercase tracking-wider text-white/45">
          Aktivität · 30 Tage
        </span>
        <span className="text-xs text-white/55 tabular-nums">
          {totalLogged} / {data.length} Tage
          {currentStreak > 0 && (
            <span className="text-emerald-300 ml-2">
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
              ? "bg-white/[0.04] border-white/[0.04]"
              : intensity === 1
              ? "bg-emerald-400/20 border-emerald-400/30"
              : intensity === 2
              ? "bg-emerald-400/40 border-emerald-400/50"
              : intensity === 3
              ? "bg-emerald-400/60 border-emerald-400/70"
              : "bg-emerald-400/85 border-emerald-400";
          return (
            <div
              key={d.date}
              className={`aspect-square rounded-sm border ${bgClass} hover:scale-110 transition-transform`}
              title={`${d.date}: ${d.logCount} Logs`}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2 mt-3 text-[10px] text-white/35">
        <span>weniger</span>
        <div className="flex gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-white/[0.04] border border-white/[0.04]" />
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/20 border border-emerald-400/30" />
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/40 border border-emerald-400/50" />
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/60 border border-emerald-400/70" />
          <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400/85 border border-emerald-400" />
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
          <span className="text-xs uppercase tracking-wider text-white/45">
            Makros · 7 Tage
          </span>
        </div>
        <p className="text-sm text-white/40">Noch keine Daten.</p>
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
        <span className="text-xs uppercase tracking-wider text-white/45">
          Makros · 7 Tage
        </span>
        <span className="text-xs text-white/55 tabular-nums">
          {Math.round(totalKcal)} kcal gesamt
        </span>
      </div>

      <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.04]">
        <div
          className="bg-emerald-400/85"
          style={{ width: `${pP}%` }}
          title={`Protein ${pP}%`}
        />
        <div
          className="bg-gold-soft"
          style={{ width: `${pC}%` }}
          title={`Carbs ${pC}%`}
        />
        <div
          className="bg-rose-400/80"
          style={{ width: `${pF}%` }}
          title={`Fett ${pF}%`}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <MacroLegend
          label="Protein"
          value={Math.round(protein)}
          pct={pP}
          color="emerald"
        />
        <MacroLegend
          label="Carbs"
          value={Math.round(carbs)}
          pct={pC}
          color="gold"
        />
        <MacroLegend
          label="Fett"
          value={Math.round(fat)}
          pct={pF}
          color="rose"
        />
      </div>
    </div>
  );
}

function MacroLegend({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: "emerald" | "gold" | "rose";
}) {
  const dot =
    color === "emerald"
      ? "bg-emerald-400/85"
      : color === "gold"
      ? "bg-gold-soft"
      : "bg-rose-400/80";
  return (
    <div className="flex items-baseline gap-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-white/45">
          {label}
        </div>
        <div className="text-sm text-white tabular-nums">
          {value}g
          <span className="text-white/40 ml-1">·</span>
          <span className="text-white/55 ml-1">{pct}%</span>
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
          <span className="text-xs uppercase tracking-wider text-white/45">
            Gewicht · Fortschritt
          </span>
        </div>
        <p className="text-sm text-white/40">
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
        <span className="text-xs uppercase tracking-wider text-white/45">
          Gewicht · Ziel
        </span>
        <span className="text-xs text-white/55 tabular-nums">
          {diff.toFixed(1)} kg {direction}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-white/40">
            Start
          </div>
          <div className="font-serif text-2xl text-white tabular-nums">
            {start}
            <span className="text-xs text-white/40 ml-0.5">kg</span>
          </div>
        </div>

        <div className="flex-1 relative h-3 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-gold-deep to-gold-soft rounded-full"
            style={{ width: "0%" }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/55">
            0% des Wegs
          </div>
        </div>

        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-gold/70">
            Ziel
          </div>
          <div className="font-serif text-2xl text-gold-soft tabular-nums">
            {target}
            <span className="text-xs text-white/40 ml-0.5">kg</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-white/35 mt-3 text-center">
        Sobald der Kunde sein aktuelles Gewicht loggt, wird der Fortschritt
        sichtbar.
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
