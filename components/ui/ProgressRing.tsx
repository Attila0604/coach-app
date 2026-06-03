type Props = {
  value: number;
  goal: number | null | undefined;
  label?: string;
  unit?: string;
  size?: number;
  strokeWidth?: number;
};

export function ProgressRing({
  value,
  goal,
  label = "HEUTE",
  unit = "kcal",
  size = 200,
  strokeWidth = 5,
}: Props) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const hasGoal = !!goal && goal > 0;
  const progress = hasGoal ? Math.min(value / goal!, 1) : 0;
  const dashoffset = circumference * (1 - progress);
  const fmt = new Intl.NumberFormat("de-DE");

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(242, 237, 224, 0.07)"
          strokeWidth={strokeWidth}
        />
        {hasGoal && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#8FAAC6"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] tracking-caps text-bone-muted font-medium">
          {label}
        </span>
        <span className="font-serif text-5xl text-bone leading-none mt-1.5 tabular-nums">
          {fmt.format(Math.round(value))}
        </span>
        <span className="text-[11px] text-bone-muted mt-1.5">
          {hasGoal ? `von ${fmt.format(goal!)} ${unit}` : unit}
        </span>
      </div>
    </div>
  );
}
