type Props = {
  label: string;
  value: number;
  goal: number | null | undefined;
  unit?: string;
  variant?: "gold" | "soft" | "deep";
};

export function MacroBar({
  label,
  value,
  goal,
  unit = "g",
  variant = "gold",
}: Props) {
  const hasGoal = !!goal && goal > 0;
  const progress = hasGoal ? Math.min(value / goal!, 1) : 0;
  const fillClass = {
    gold: "bg-gold",
    soft: "bg-gold-soft",
    deep: "bg-gold-deep",
  }[variant];

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[9px] tracking-caps text-bone-muted font-medium uppercase">
          {label}
        </span>
        <span className="text-[11px] text-bone-muted tabular-nums">
          {Math.round(value)}
          {hasGoal ? ` / ${goal}` : ""} {unit}
        </span>
      </div>
      <div className="h-[2px] bg-white/[0.06] relative overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 ${fillClass} transition-[width] duration-700 ease-out`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
