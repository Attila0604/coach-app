"use client";

import { useState, useTransition } from "react";
import { updateGoals } from "@/app/coach/customers/[id]/actions";

type Profile = {
  daily_kcal_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
};

type Props = {
  customerId: string;
  profile: Profile | null;
};

export function GoalsEditor({ customerId, profile }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const [kcal, setKcal] = useState(profile?.daily_kcal_target?.toString() ?? "");
  const [protein, setProtein] = useState(
    profile?.protein_target_g?.toString() ?? ""
  );
  const [carbs, setCarbs] = useState(profile?.carbs_target_g?.toString() ?? "");
  const [fat, setFat] = useState(profile?.fat_target_g?.toString() ?? "");

  // Auto-Save: speichert beim Verlassen eines Felds das komplette Ziel-Set.
  function saveField(next?: Partial<Record<"kcal" | "protein" | "carbs" | "fat", string>>) {
    const v = {
      kcal: next?.kcal ?? kcal,
      protein: next?.protein ?? protein,
      carbs: next?.carbs ?? carbs,
      fat: next?.fat ?? fat,
    };
    setError(null);
    startTransition(async () => {
      const result = await updateGoals(customerId, {
        daily_kcal_target: v.kcal === "" ? null : Number(v.kcal),
        protein_target_g: v.protein === "" ? null : Number(v.protein),
        carbs_target_g: v.carbs === "" ? null : Number(v.carbs),
        fat_target_g: v.fat === "" ? null : Number(v.fat),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="space-y-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[9px] tracking-caps uppercase text-gold font-medium">
          Kalorien
        </p>
        <SaveStatus pending={pending} saved={saved} />
      </div>

      <div className="flex items-baseline gap-3">
        <input
          type="number"
          inputMode="numeric"
          min={500}
          max={8000}
          step={50}
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          onBlur={() => saveField()}
          placeholder="—"
          className="font-serif text-4xl bg-transparent border-b border-gold-line focus:border-gold outline-none w-32 tabular-nums text-bone transition"
        />
        <span className="text-sm text-bone-muted">kcal/Tag</span>
      </div>

      <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
        <EditCell
          label="Protein"
          value={protein}
          onChange={setProtein}
          onCommit={(val) => saveField({ protein: val })}
          max={600}
        />
        <EditCell
          label="Carbs"
          value={carbs}
          onChange={setCarbs}
          onCommit={(val) => saveField({ carbs: val })}
          max={1000}
        />
        <EditCell
          label="Fett"
          value={fat}
          onChange={setFat}
          onCommit={(val) => saveField({ fat: val })}
          max={400}
        />
      </div>

      {error && <p className="text-[11px] text-rose-400">Fehler: {error}</p>}

      <p className="text-[10px] text-bone-faint">
        Änderungen werden automatisch gespeichert. Leer lassen = nicht gesetzt.
      </p>
    </div>
  );
}

/* ============== local helpers ============== */

function SaveStatus({ pending, saved }: { pending: boolean; saved: boolean }) {
  if (pending)
    return (
      <span className="text-[10px] tracking-capsTight uppercase text-bone-muted">
        Speichert…
      </span>
    );
  if (saved)
    return (
      <span className="text-[10px] tracking-capsTight uppercase text-gold/80 font-medium">
        ✓ Gespeichert
      </span>
    );
  return null;
}

function EditCell({
  label,
  value,
  onChange,
  onCommit,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommit: (v: string) => void;
  max: number;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-4 text-center">
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={(e) => onCommit(e.target.value)}
        placeholder="—"
        className="font-serif text-2xl bg-transparent border-b border-gold-line focus:border-gold outline-none w-full text-center tabular-nums text-bone transition"
      />
      <p className="text-[9px] tracking-capsTight uppercase text-bone-muted mt-2 font-medium">
        {label}
      </p>
    </div>
  );
}
