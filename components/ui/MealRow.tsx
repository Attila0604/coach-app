type MealType = "fruehstueck" | "mittag" | "abend" | "snack" | string;

type Props = {
  type: MealType | null;
  description: string | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  kcal: number | null;
  loggedAt: string | null;
};

const typeLabels: Record<string, string> = {
  fruehstueck: "FRH",
  mittag: "MIT",
  abend: "ABD",
  snack: "SNK",
};

function formatRelativeTime(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (isToday) return time;
  if (isYesterday) return `gestern ${time}`;
  return `${d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  })} ${time}`;
}

export function MealRow({
  type,
  description,
  protein,
  carbs,
  fat,
  kcal,
  loggedAt,
}: Props) {
  const fmt = new Intl.NumberFormat("de-DE");
  const badge = (type && typeLabels[type]) || "—";
  const hasMacros =
    protein != null || carbs != null || fat != null;

  return (
    <div className="flex items-center gap-4 py-4 border-b border-white/[0.06] last:border-0">
      <div className="w-10 h-10 border border-gold-line flex items-center justify-center shrink-0">
        <span className="text-[9px] tracking-capsTight text-gold font-medium">
          {badge}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-bone leading-snug line-clamp-2">
          {description ?? "—"}
        </div>
        <div className="text-[11px] text-bone-muted mt-1 tabular-nums">
          {hasMacros && (
            <>
              P {Math.round(Number(protein) || 0)} g · C{" "}
              {Math.round(Number(carbs) || 0)} g · F{" "}
              {Math.round(Number(fat) || 0)} g ·{" "}
            </>
          )}
          {formatRelativeTime(loggedAt)}
        </div>
      </div>
      <div className="font-serif text-lg text-bone tabular-nums whitespace-nowrap">
        {kcal != null ? fmt.format(Math.round(kcal)) : "—"}
        <span className="text-[11px] text-bone-muted ml-1 font-sans">
          kcal
        </span>
      </div>
    </div>
  );
}
