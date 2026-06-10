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

type Draft = {
  age: string;
  gender: string;
  height_cm: string;
  weight_start_kg: string;
  weight_target_kg: string;
  goal: string;
  experience_level: string;
  equipment: string;
  allergies: string;
  food_preferences: string;
  notes: string;
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

const inputCls =
  'w-full rounded-xl border border-white/[0.1] bg-white/[0.035] px-3 py-2.5 text-sm text-bone placeholder:text-bone-faint transition focus:border-gold/45 focus:bg-white/[0.055] focus:outline-none';

export function ProfileEditor({
  customerId,
  profile,
}: {
  customerId: string;
  profile: Profile | null;
}) {
  const [draft, setDraft] = useState<Draft>({
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
  const [saved, setSaved] = useState(false);

  // Auto-Save: speichert das komplette Profil beim Verlassen eines Felds.
  function commit(d: Draft) {
    setError(null);
    startTransition(async () => {
      const result = await updateCustomerProfile(customerId, {
        age: parseI(d.age),
        gender: d.gender || null,
        height_cm: parseI(d.height_cm),
        weight_start_kg: parseN(d.weight_start_kg),
        weight_target_kg: parseN(d.weight_target_kg),
        goal: d.goal || null,
        experience_level: d.experience_level || null,
        equipment: d.equipment || null,
        allergies: textToArr(d.allergies),
        food_preferences: textToArr(d.food_preferences),
        notes: d.notes || null,
      });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  }

  // Text/Zahlenfelder: state aktualisieren, beim Blur speichern.
  function set(key: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }
  // Selects: state aktualisieren UND sofort speichern (kein Blur nötig).
  function setAndSave(key: keyof Draft, value: string) {
    setDraft((prev) => {
      const next = { ...prev, [key]: value };
      commit(next);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-3 h-4">
        {isPending ? (
          <span className="text-[10px] uppercase tracking-caps text-bone-muted">
            Speichert…
          </span>
        ) : saved ? (
          <span className="text-[10px] uppercase tracking-caps text-gold/80 font-medium">
            ✓ Gespeichert
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-2">
        <Field label="Alter">
          <input
            type="text"
            inputMode="numeric"
            value={draft.age}
            onChange={(e) => set('age', e.target.value)}
            onBlur={() => commit(draft)}
            placeholder="z.B. 40"
            className={inputCls}
          />
        </Field>

        <Field label="Geschlecht">
          <select
            value={draft.gender}
            onChange={(e) => setAndSave('gender', e.target.value)}
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
            onChange={(e) => set('height_cm', e.target.value)}
            onBlur={() => commit(draft)}
            placeholder="z.B. 180"
            className={inputCls}
          />
        </Field>

        <Field label="Trainingsziel">
          <select
            value={draft.goal}
            onChange={(e) => setAndSave('goal', e.target.value)}
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
            onChange={(e) => set('weight_start_kg', e.target.value)}
            onBlur={() => commit(draft)}
            placeholder="z.B. 69"
            className={inputCls}
          />
        </Field>

        <Field label="Gewicht Ziel (kg)">
          <input
            type="text"
            inputMode="decimal"
            value={draft.weight_target_kg}
            onChange={(e) => set('weight_target_kg', e.target.value)}
            onBlur={() => commit(draft)}
            placeholder="z.B. 68"
            className={inputCls}
          />
        </Field>

        <Field label="Erfahrung">
          <select
            value={draft.experience_level}
            onChange={(e) => setAndSave('experience_level', e.target.value)}
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
            onChange={(e) => setAndSave('equipment', e.target.value)}
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
            onChange={(e) => set('allergies', e.target.value)}
            onBlur={() => commit(draft)}
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
            onChange={(e) => set('food_preferences', e.target.value)}
            onBlur={() => commit(draft)}
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
            onChange={(e) => set('notes', e.target.value)}
            onBlur={() => commit(draft)}
            placeholder="frei eintragen..."
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </Field>
      </div>

      <p className="text-[10px] text-bone-faint italic mt-4">
        Änderungen werden automatisch gespeichert.
      </p>

      {error && <p className="text-[11px] text-red-400 italic mt-2">{error}</p>}
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
