// ============================================================================
// Training Plan Section — Server Component V3
// 
// Lädt den aktuellen Plan (max 1 pro Customer, status in draft/active/paused).
// Zeigt:
//   - KI-Generator (wenn kein Plan)
//   - Status-Bar mit Activate/Discard Buttons (wenn Plan existiert)
//   - Den bestehenden TrainingPlanEditor (unverändert)
// 
// EINBINDUNG in deine bestehende Kunden-Detail-Seite:
//   import TrainingPlanSection from '@/components/training-plan-section';
//   ...
//   <TrainingPlanSection customerId={customer.id} />
// ============================================================================

import { createClient } from '@/lib/supabase-server';
import TrainingPlanEditor from './training-plan-editor';
import TrainingPlanGenerator from './ui/TrainingPlanGenerator';
import TrainingPlanStatusBar from './ui/TrainingPlanStatusBar';
import type { TrainingPlan } from '@/lib/types/training';

export default async function TrainingPlanSection({
  customerId,
}: {
  customerId: string;
}) {
  const supabase = createClient();

  // Lade nur aktive/draft/paused Pläne — completed sind archiviert und werden nicht angezeigt
  const { data, error } = await supabase
    .from('training_plans')
    .select(
      `
      *,
      days:training_days(
        *,
        exercises(*)
      )
    `
    )
    .eq('customer_id', customerId)
    .in('status', ['draft', 'active', 'paused'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Fehler beim Laden des Plans:', error);
  }

  const plan: TrainingPlan | null = data
    ? {
        ...data,
        days: (data.days ?? [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((d: any) => ({
            ...d,
            exercises: (d.exercises ?? []).sort(
              (a: any, b: any) => a.sort_order - b.sort_order
            ),
          })),
      }
    : null;

  return (
    <div className="space-y-8">
      {/* KI-Generator immer sichtbar */}
      <TrainingPlanGenerator
        customerId={customerId}
        hasExistingPlan={!!plan}
      />

      {/* Wenn Plan existiert: Status-Bar + Editor */}
      {plan && (
        <>
          <TrainingPlanStatusBar
            planId={plan.id}
            customerId={customerId}
            status={plan.status}
            planName={plan.name}
          />
          <TrainingPlanEditor customerId={customerId} plan={plan} />
        </>
      )}
    </div>
  );
}
