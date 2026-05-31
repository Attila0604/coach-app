'use client';

import { useTransition, useState } from 'react';
import {
  activateTrainingPlan,
  discardTrainingPlan,
} from '@/lib/actions/training-plan';

type Props = {
  planId: string;
  customerId: string;
  status: string;
  planName: string;
  weeks?: number | null;
  currentWeek?: number | null;
  daysCount?: number;
};

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  draft: {
    label: 'Entwurf',
    cls: 'border-gold/40 text-gold bg-gold/[0.04]',
  },
  active: {
    label: 'Aktiv',
    cls: 'border-gold/40 text-gold bg-gold/[0.04]',
  },
  paused: {
    label: 'Pausiert',
    cls: 'border-bone-muted/30 text-bone-muted bg-white/[0.02]',
  },
  completed: {
    label: 'Abgeschlossen',
    cls: 'border-bone-faint/30 text-bone-faint bg-white/[0.02]',
  },
};

export default function TrainingPlanHeader({
  planId,
  customerId,
  status,
  planName,
  weeks,
  currentWeek,
  daysCount,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function handleActivate() {
    if (
      !confirm(
        `Plan "${planName}" aktivieren? Der Kunde sieht den Plan ab sofort in der App.`
      )
    )
      return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await activateTrainingPlan(planId, customerId);
      if (result.ok) setInfo('Plan aktiviert. Kunde sieht ihn jetzt.');
      else setError(result.error);
    });
  }

  function handleDiscard() {
    if (
      !confirm(
        `Plan "${planName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`
      )
    )
      return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await discardTrainingPlan(planId, customerId);
      if (!result.ok) setError(result.error);
    });
  }

  const cfg = STATUS_CFG[status] ?? STATUS_CFG.draft;
  const isDraft = status === 'draft';
  const isActive = status === 'active';
  const isPaused = status === 'paused';

  const statsParts: string[] = [];
  if (weeks) statsParts.push(`${weeks} Wochen`);
  if (daysCount) statsParts.push(`${daysCount} Tage/Woche`);
  if (isActive && currentWeek && weeks) {
    statsParts.push(`Woche ${currentWeek} von ${weeks}`);
  }
  const statsLine = statsParts.join(' · ');

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/20 px-5 py-5 sm:px-7 sm:py-6">
      <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
        <h2 className="font-serif text-2xl text-bone leading-tight">
          {planName}
        </h2>
        <span
          className={`text-[10px] px-3 py-1.5 border tracking-caps uppercase font-medium shrink-0 ${cfg.cls}`}
        >
          {cfg.label}
        </span>
      </div>

      {statsLine && (
        <p className="text-sm text-bone-muted">{statsLine}</p>
      )}

      {isDraft && (
        <p className="text-[11px] text-gold/70 italic mt-3">
          Nur du siehst diesen Entwurf. Aktiviere ihn, um ihn dem Kunden in
          der App sichtbar zu machen.
        </p>
      )}

      <div className="flex gap-2 flex-wrap mt-4">
        {isDraft && (
          <>
            <button
              type="button"
              onClick={handleActivate}
              disabled={isPending}
              className="text-[11px] uppercase tracking-caps font-medium px-5 py-2.5 border border-gold text-gold bg-gold/5 hover:bg-gold/15 transition disabled:opacity-30"
            >
              {isPending ? 'Aktiviere …' : '✓ Plan aktivieren'}
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isPending}
              className="text-[10px] uppercase tracking-caps font-medium px-3 py-2 border border-white/15 text-bone-muted hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-30"
            >
              Entwurf löschen
            </button>
          </>
        )}
        {(isActive || isPaused) && (
          <button
            type="button"
            onClick={handleDiscard}
            disabled={isPending}
            className="text-[10px] uppercase tracking-caps font-medium px-3 py-2 border border-white/15 text-bone-muted hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-30"
          >
            Plan löschen
          </button>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-red-400 italic mt-3">{error}</p>
      )}
      {info && (
        <p className="text-[11px] text-gold/80 italic mt-3">✓ {info}</p>
      )}
    </div>
  );
}
