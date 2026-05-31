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

const fmt = new Intl.NumberFormat("de-DE");

export function GoalsEditor({ customerId, profile }: Props) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Form state
  const [kcal, setKcal] = useState(
    profile?.daily_kcal_target?.toString() ?? ""
  );
  const [protein, setProtein] = useState(
    profile?.protein_target_g?.toString() ?? ""
  );
  const [carbs, setCarbs] = useState(
    profile?.carbs_target_g?.toString() ?? ""
  );
  const [fat, setFat] = useState(profile?.fat_target_g?.toString() ?? "");

  function startEdit() {
    setKcal(profile?.daily_kcal_target?.toString() ?? "");
    setProtein(profile?.protein_target_g?.toString() ?? "");
    setCarbs(profile?.carbs_target_g?.toString() ?? "");
    setFat(profile?.fat_target_g?.toString() ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateGoals(customerId, {
        daily_kcal_target: kcal === "" ? null : Number(kcal),
        protein_target_g: protein === "" ? null : Number(protein),
        carbs_target_g: carbs === "" ? null : Number(carbs),
        fat_target_g: fat === "" ? null : Number(fat),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  const hasGoals = !!profile?.daily_kcal_target;

  // ===== EDIT MODE =====
  if (editing) {
    return (
      <div className="space-y-7">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[9px] tracking-caps uppercase text-gold font-medium">
            Kalorien
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="text-[10px] tracking-capsTight uppercase text-bone-muted hover:text-bone disabled:opacity-50 transition"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="text-[10px] tracking-capsTight uppercase text-gold hover:text-gold-soft disabled:opacity-50 transition font-medium"
            >
              {pending ? "Speichert…" : "Speichern"}
            </button>
          </div>
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
            disabled={pending}
            placeholder="—"
            className="font-serif text-4xl bg-transparent border-b border-gold-line focus:border-gold outline-none w-32 tabular-nums text-bone disabled:opacity-50 transition"
          />
          <span className="text-sm text-bone-muted">kcal/Tag</span>
        </div>

        <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
          <EditCell
            label="Protein"
            value={protein}
            onChange={setProtein}
            max={600}
            disabled={pending}
          />
          <EditCell
            label="Carbs"
            value={carbs}
            onChange={setCarbs}
            max={1000}
            disabled={pending}
          />
          <EditCell
            label="Fett"
            value={fat}
            onChange={setFat}
            max={400}
            disabled={pending}
          />
        </div>

        {error && (
          <p className="text-[11px] text-rose-400">
            Fehler: {error}
          </p>
        )}

        <p className="text-[10px] text-bone-faint">
          Leer lassen = nicht gesetzt. Werte werden auf ganze Zahlen gerundet.
        </p>
      </div>
    );
  }

  // ===== VIEW MODE =====
  return (
    <div className="space-y-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[9px] tracking-caps uppercase text-gold font-medium">
          Kalorien
        </p>
        <button
          type="button"
          onClick={startEdit}
          className="text-[10px] tracking-capsTight uppercase text-bone-muted hover:text-gold transition font-medium"
        >
          ✎ Bearbeiten
        </button>
      </div>

      {hasGoals ? (
        <>
          <p className="font-serif text-4xl text-bone tabular-nums leading-none">
            {fmt.format(profile!.daily_kcal_target!)}
            <span className="text-sm text-bone-muted ml-2 font-sans">
              kcal/Tag
            </span>
          </p>

          <div className="grid grid-cols-3 gap-px bg-white/[0.06]">
            <ViewCell label="Protein" value={profile?.protein_target_g} />
            <ViewCell label="Carbs" value={profile?.carbs_target_g} />
            <ViewCell label="Fett" value={profile?.fat_target_g} />
          </div>
        </>
      ) : (
        <p className="text-sm text-bone-muted italic">
          Noch keine Tagesziele gesetzt.
        </p>
      )}
    </div>
  );
}

/* ============== local helpers ============== */

function ViewCell({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-3 py-4 text-center">
      <p className="font-serif text-2xl text-bone tabular-nums leading-none">
        {value ?? "—"}
        {value != null && (
          <span className="text-xs text-bone-muted ml-1 font-sans">g</span>
        )}
      </p>
      <p className="text-[9px] tracking-capsTight uppercase text-bone-muted mt-2 font-medium">
        {label}
      </p>
    </div>
  );
}

function EditCell({
  label,
  value,
  onChange,
  max,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  disabled: boolean;
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
        disabled={disabled}
        placeholder="—"
        className="font-serif text-2xl bg-transparent border-b border-gold-line focus:border-gold outline-none w-full text-center tabular-nums text-bone disabled:opacity-50 transition"
      />
      <p className="text-[9px] tracking-capsTight uppercase text-bone-muted mt-2 font-medium">
        {label}
      </p>
    </div>
  );
}
