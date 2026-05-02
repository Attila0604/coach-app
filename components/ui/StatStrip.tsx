import { ReactNode } from "react";

export function StatStrip({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
      {children}
    </div>
  );
}

type CellProps = {
  value: string | number;
  label: string;
  unit?: string;
  accent?: boolean;
};

export function StatCell({
  value,
  label,
  unit,
  accent = false,
}: CellProps) {
  const formatted =
    typeof value === "number"
      ? new Intl.NumberFormat("de-DE").format(value)
      : value;

  return (
    <div className="bg-ink-900 px-3 py-5 text-center">
      <div
        className={`font-serif text-3xl leading-none tabular-nums ${
          accent ? "text-gold" : "text-bone"
        }`}
      >
        {formatted}
        {unit && (
          <span className="text-sm text-bone-muted ml-1 font-sans">
            {unit}
          </span>
        )}
      </div>
      <div className="text-[9px] tracking-caps text-bone-muted font-medium mt-2.5 uppercase">
        {label}
      </div>
    </div>
  );
}
