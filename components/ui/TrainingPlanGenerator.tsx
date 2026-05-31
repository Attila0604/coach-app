'use client';

import { useState, useTransition } from 'react';
import { generateTrainingPlan } from '@/lib/actions/training-plan';

type Props = {
  customerId: string;
  hasExistingPlan: boolean;
};

const FOCUS_OPTIONS = [
  { value: 'strength', label: 'Kraft' },
  { value: 'hypertrophy', label: 'Muskelaufbau' },
  { value: 'general', label: 'Allgemein' },
  { value: 'endurance', label: 'Ausdauer' },
  { value: 'custom', label: 'Spezifisch …' },
] as const;

export default function TrainingPlanGenerator({
  customerId,
  hasExistingPlan,
}: Props) {
  const [weeks, setWeeks] = useState<4 | 8 | 12>(4);
  const [daysPerWeek, setDaysPerWeek] = useState<2 | 3 | 4 | 5 | 6>(3);
  const [focus, setFocus] = useState<
    'strength' | 'hypertrophy' | 'general' | 'endurance' | 'custom'
  >('general');
  const [customPrompt, setCustomPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleGenerate() {
    if (
      hasExistingPlan &&
      !confirm(
        'Aktueller Plan wird auf "abgeschlossen" gesetzt und durch den neuen KI-Plan ersetzt. Fortfahren?'
      )
    ) {
      return;
    }
    if (focus === 'custom' && !customPrompt.trim()) {
      setError('Bitte beschreibe was du speziell willst.');
      return;
    }
    setError(null);
    setInfo(null);

    startTransition(async () => {
      const result = await generateTrainingPlan(customerId, {
        weeks,
        daysPerWeek,
        focus,
        customPrompt: focus === 'custom' ? customPrompt.trim() : undefined,
      });
      if (result.ok) {
        setInfo(
          'Trainingsplan generiert (Entwurf). Bitte unten prüfen, anpassen und aktivieren.'
        );
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="bg-ink-900 p-7">
      <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-5">
        KI-Trainingsplan
      </h3>

      <div className="mb-5 rounded-2xl border border-gold/20 bg-gold/[0.05] px-4 py-4">
        <p className="text-[10px] font-medium uppercase tracking-capsTight text-gold">
          So liest du den KI-Plan
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-bone-muted">
          Die KI liefert Startwerte: <span className="text-bone">Sätze × Wiederholungen</span>,
          empfohlene Pause, Gewichtstyp und kurze Technik-Hinweise. Konkrete kg-Werte bleiben
          meistens offen, damit du sie passend zum Kunden festlegst.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="flex flex-col gap-2">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            Dauer
          </p>
          <select
            value={weeks}
            onChange={(e) =>
              setWeeks(Number(e.target.value) as 4 | 8 | 12)
            }
            disabled={isPending}
            className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-bone disabled:opacity-50"
          >
            <option value={4}>4 Wochen</option>
            <option value={8}>8 Wochen</option>
            <option value={12}>12 Wochen</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            Frequenz
          </p>
          <select
            value={daysPerWeek}
            onChange={(e) =>
              setDaysPerWeek(Number(e.target.value) as 2 | 3 | 4 | 5 | 6)
            }
            disabled={isPending}
            className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-bone disabled:opacity-50"
          >
            <option value={2}>2× pro Woche</option>
            <option value={3}>3× pro Woche</option>
            <option value={4}>4× pro Woche</option>
            <option value={5}>5× pro Woche</option>
            <option value={6}>6× pro Woche</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            Fokus
          </p>
          <select
            value={focus}
            onChange={(e) =>
              setFocus(
                e.target.value as
                  | 'strength'
                  | 'hypertrophy'
                  | 'general'
                  | 'endurance'
                  | 'custom'
              )
            }
            disabled={isPending}
            className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-bone disabled:opacity-50"
          >
            {FOCUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {focus === 'custom' && (
        <div className="mb-5">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-2">
            Coach-Notiz für die KI
          </p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={isPending}
            placeholder="z.B. Fokus auf Rückenstärkung, vorsichtig wegen Bandscheibenvorfall L4/L5. Keine Kniebeugen, stattdessen Goblet-Squats."
            maxLength={500}
            rows={3}
            className="w-full bg-black/30 border border-white/10 px-3 py-2 text-sm text-bone placeholder:text-bone-faint focus:outline-none focus:border-gold/50 transition disabled:opacity-50 resize-none"
          />
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={isPending}
        className="w-full text-[11px] uppercase tracking-caps font-medium px-4 py-3 border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
      >
        {isPending
          ? '⏳ KI generiert Plan …'
          : hasExistingPlan
          ? '✨ Plan neu generieren'
          : '✨ Trainingsplan generieren'}
      </button>

      {hasExistingPlan && !isPending && (
        <p className="text-[11px] text-bone-faint italic mt-3">
          Aktueller Plan wird beim Generieren archiviert (status &quot;completed&quot;).
        </p>
      )}

      {error && (
        <p className="text-[11px] text-red-400 italic mt-3">{error}</p>
      )}
      {info && (
        <p className="text-[11px] text-gold/80 italic mt-3">✓ {info}</p>
      )}
    </div>
  );
}
