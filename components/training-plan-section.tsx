// ============================================================================
// Training Plan Section — Server Component
// 
// Lädt den aktuellen (oder einzigen) Plan eines Kunden inklusive aller 
// Tage und Übungen in einem einzigen Query, und reicht das an den 
// Client-Editor durch.
// 
// EINBINDUNG in deine bestehende Kunden-Detail-Seite:
//   import TrainingPlanSection from '@/components/training-plan-section';
//   ...
//   <TrainingPlanSection customerId={customer.id} />
// ============================================================================

import { createClient } from '@/lib/supabase-server';
import TrainingPlanEditor from './training-plan-editor';
import type { TrainingPlan } from '@/lib/types/training';

export default async function TrainingPlanSection({
  customerId,
}: {
  customerId: string;
}) {
  const supabase = createClient();

  // Lade den aktivsten Plan (active > paused > draft > completed)
  // Falls mehrere existieren, nimm den zuletzt aktualisierten
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
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Fehler beim Laden des Plans:', error);
  }

  // Sortiere Tage und Übungen
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

  return <TrainingPlanEditor customerId={customerId} plan={plan} />;
}
