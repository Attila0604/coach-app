'use client';

import { useTransition, useState } from 'react';
import { activateTrainingPlan, discardTrainingPlan } from '@/lib/actions/training-plan';

type Props = {
  planId: string;
  customerId: string;
  status: string;
  planName: string;
};

export default function TrainingPlanStatusBar({
  planId,
  customerId,
  status,
  planName,
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

  const isDraft = status === 'draft';
  const isActive = status === 'active';
  const isPaused = status === 'paused';

  return (
    <div className="bg-ink-900 px-7 py-5 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 flex-wrap">
        <StatusPill status={status} />
        <p className="text-sm text-bone-muted">
          {isDraft && 'Nur du siehst diesen Entwurf. Aktiviere ihn um den Kunden sichtbar zu machen.'}
          {isActive && 'Plan ist aktiv — Kunde sieht ihn in der App.'}
          {isPaused && 'Plan ist pausiert.'}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {isDraft && (
          <>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isPending}
              className="text-[10px] uppercase tracking-caps font-medium px-3 py-2 border border-white/15 text-bone-muted hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-30"
            >
              Entwurf löschen
            </button>
            <button
              type="button"
              onClick={handleActivate}
              disabled={isPending}
              className="text-[11px] uppercase tracking-caps font-medium px-5 py-2.5 border border-gold text-gold bg-gold/5 hover:bg-gold/15 transition disabled:opacity-30"
            >
              {isPending ? 'Aktiviere …' : '✓ Plan aktivieren'}
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
        <p className="text-[11px] text-red-400 italic w-full">{error}</p>
      )}
      {info && (
        <p className="text-[11px] text-gold/80 italic w-full">✓ {info}</p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    draft: {
      label: 'Entwurf',
      cls: 'border-gold/40 text-gold bg-gold/[0.04]',
    },
    active: {
      label: 'Aktiv',
      cls: 'border-bone/30 text-bone bg-white/[0.02]',
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
  const c = cfg[status] ?? cfg.draft;
  return (
    <span
      className={`text-[10px] px-3 py-1.5 border tracking-caps uppercase font-medium ${c.cls}`}
    >
      {c.label}
    </span>
  );
}
