'use client';

import { useState, useTransition } from 'react';
import { updateCustomerProfile } from '@/lib/actions/customer-profile';

type Profile = {
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_start_kg?: number | null;
  weight_target_kg?: number | null;
  goal?: string | null;
  experience_level?: string | null;
  equipment?: string | null;
  allergies?: string[] | null;
  food_preferences?: string[] | null;
  notes?: string | null;
};

const GENDER_OPTIONS = [
  { value: '', label: '—' },
  { value: 'm', label: 'Männlich' },
  { value: 'w', label: 'Weiblich' },
  { value: 'd', label: 'Divers' },
];

const GOAL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'ausdauer', label: 'Ausdauer' },
  { value: 'kraft', label: 'Kraft' },
  { value: 'aufbau', label: 'Muskelaufbau' },
  { value: 'abnehmen', label: 'Abnehmen' },
  { value: 'erhalt', label: 'Erhalt' },
  { value: 'gesundheit', label: 'Allgemeine Gesundheit' },
];

const EXPERIENCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'anfaenger', label: 'Anfänger' },
  { value: 'mittel', label: 'Mittel' },
  { value: 'fortgeschritten', label: 'Fortgeschritten' },
  { value: 'profi', label: 'Profi' },
];

const EQUIPMENT_OPTIONS = [
  { value: '', label: '—' },
  { value: 'home_none', label: 'Kein Equipment (Bodyweight)' },
  { value: 'home_basic', label: 'Home Basic (Hanteln, Bänder)' },
  { value: 'home_full', label: 'Home Gym (volle Ausstattung)' },
  { value: 'gym', label: 'Fitness-Studio' },
  { value: 'mixed', label: 'Gemischt' },
];

function arrToText(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

function textToArr(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const inputCls =
  'w-full rounded-xl border border-white/[0.1] bg-white/[0.035] px-3 py-2.5 text-sm text-bone placeholder:text-bone-faint transition focus:border-gold/45 focus:bg-white/[0.055] focus:outline-none disabled:opacity-50';

export function ProfileEditor({
  customerId,
  profile,
}: {
  customerId: string;
  profile: Profile | null;
}) {
  const [draft, setDraft] = useState({
    age: profile?.age?.toString() ?? '',
    gender: profile?.gender ?? '',
    height_cm: profile?.height_cm?.toString() ?? '',
    weight_start_kg: profile?.weight_start_kg?.toString() ?? '',
    weight_target_kg: profile?.weight_target_kg?.toString() ?? '',
    goal: profile?.goal ?? '',
    experience_level: profile?.experience_level ?? '',
    equipment: profile?.equipment ?? '',
    allergies: arrToText(profile?.allergies),
    food_preferences: arrToText(profile?.food_preferences),
    notes: profile?.notes ?? '',
  });

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function parseN(s: string): number | null {
    if (!s.trim()) return null;
    const v = parseFloat(s.replace(',', '.'));
    return isFinite(v) ? v : null;
  }
  function parseI(s: string): number | null {
    if (!s.trim()) return null;
    const v = parseInt(s, 10);
    return isFinite(v) ? v : null;
  }

  function handleSave() {
    setError(null);
    setInfo(null);
    const updates = {
      age: parseI(draft.age),
      gender: draft.gender || null,
      height_cm: parseI(draft.height_cm),
      weight_start_kg: parseN(draft.weight_start_kg),
      weight_target_kg: parseN(draft.weight_target_kg),
      goal: draft.goal || null,
      experience_level: draft.experience_level || null,
      equipment: draft.equipment || null,
      allergies: textToArr(draft.allergies),
      food_preferences: textToArr(draft.food_preferences),
      notes: draft.notes || null,
    };
    startTransition(async () => {
      const result = await updateCustomerProfile(customerId, updates);
      if (result.ok) {
        setInfo('✓ Profil gespeichert');
        setTimeout(() => setInfo(null), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        <Field label="Alter">
          <input
            type="text"
            inputMode="numeric"
            value={draft.age}
            onChange={(e) => setDraft({ ...draft, age: e.target.value })}
            disabled={isPending}
            placeholder="z.B. 40"
            className={inputCls}
          />
        </Field>

        <Field label="Geschlecht">
          <select
            value={draft.gender}
            onChange={(e) => setDraft({ ...draft, gender: e.target.value })}
            disabled={isPending}
            className={inputCls}
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Größe (cm)">
          <input
            type="text"
            inputMode="numeric"
            value={draft.height_cm}
            onChange={(e) => setDraft({ ...draft, height_cm: e.target.value })}
            disabled={isPending}
            placeholder="z.B. 180"
            className={inputCls}
          />
        </Field>

        <Field label="Trainingsziel">
          <select
            value={draft.goal}
            onChange={(e) => setDraft({ ...draft, goal: e.target.value })}
            disabled={isPending}
            className={inputCls}
          >
            {GOAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Gewicht Start (kg)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.weight_start_kg}
            onChange={(e) =>
              setDraft({ ...draft, weight_start_kg: e.target.value })
            }
            disabled={isPending}
            placeholder="z.B. 69"
            className={inputCls}
          />
        </Field>

        <Field label="Gewicht Ziel (kg)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.weight_target_kg}
            onChange={(e) =>
              setDraft({ ...draft, weight_target_kg: e.target.value })
            }
            disabled={isPending}
            placeholder="z.B. 68"
            className={inputCls}
          />
        </Field>

        <Field label="Erfahrung">
          <select
            value={draft.experience_level}
            onChange={(e) =>
              setDraft({ ...draft, experience_level: e.target.value })
            }
            disabled={isPending}
            className={inputCls}
          >
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Equipment">
          <select
            value={draft.equipment}
            onChange={(e) => setDraft({ ...draft, equipment: e.target.value })}
            disabled={isPending}
            className={inputCls}
          >
            {EQUIPMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Allergien"
          hint="Komma-getrennt, z.B. laktose, gluten, nüsse"
          fullWidth
        >
          <input
            type="text"
            value={draft.allergies}
            onChange={(e) => setDraft({ ...draft, allergies: e.target.value })}
            disabled={isPending}
            placeholder="leer lassen wenn keine"
            className={inputCls}
          />
        </Field>

        <Field
          label="Ernährungs-Vorlieben"
          hint="Komma-getrennt, z.B. vegan, fisch, mediterran"
          fullWidth
        >
          <input
            type="text"
            value={draft.food_preferences}
            onChange={(e) =>
              setDraft({ ...draft, food_preferences: e.target.value })
            }
            disabled={isPending}
            placeholder="leer lassen wenn keine speziellen"
            className={inputCls}
          />
        </Field>

        <Field
          label="Notizen / Besonderheiten"
          hint="z.B. Bandscheibenvorfall L4/L5, Knieprobleme rechts"
          fullWidth
        >
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            disabled={isPending}
            placeholder="frei eintragen..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="w-full text-[11px] uppercase tracking-caps font-medium px-5 py-3 border border-gold text-gold bg-gold/5 hover:bg-gold/15 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {isPending ? 'Speichern …' : '✓ Profil speichern'}
      </button>

      {error && (
        <p className="text-[11px] text-red-400 italic mt-3">{error}</p>
      )}
      {info && (
        <p className="text-[11px] text-gold/80 italic mt-3">{info}</p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  fullWidth,
  children,
}: {
  label: string;
  hint?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={fullWidth ? 'md:col-span-2' : ''}>
      <label className="text-[10px] uppercase tracking-caps text-bone-faint font-medium block mb-2">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-bone-faint italic mt-1">{hint}</p>
      )}
    </div>
  );
}
