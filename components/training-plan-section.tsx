import { createClient } from '@/lib/supabase-server';
import TrainingPlanEditor from './training-plan-editor';
import TrainingPlanGenerator from './ui/TrainingPlanGenerator';
import TrainingPlanGeneratorToggle from './ui/TrainingPlanGeneratorToggle';
import TrainingPlanHeader from './ui/TrainingPlanHeader';
import type { TrainingPlan } from '@/lib/types/training';

export default async function TrainingPlanSection({
  customerId,
}: {
  customerId: string;
}) {
  const supabase = createClient();

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

  // Kein Plan? → Generator groß sichtbar (Onboarding-Mode)
  if (!plan) {
    return (
      <div>
        <TrainingPlanGenerator
          customerId={customerId}
          hasExistingPlan={false}
        />
      </div>
    );
  }

  // Plan existiert? → Header + Generator-Toggle + Auto-Save-Hinweis + Editor
  return (
    <div className="space-y-6">
      <TrainingPlanHeader
        planId={plan.id}
        customerId={customerId}
        status={plan.status}
        planName={plan.name}
        weeks={plan.weeks}
        currentWeek={plan.current_week}
        daysCount={plan.days?.length ?? 0}
      />

      <TrainingPlanGeneratorToggle label="✨ Plan neu generieren">
        <TrainingPlanGenerator
          customerId={customerId}
          hasExistingPlan={true}
        />
      </TrainingPlanGeneratorToggle>

      {/* AUTO-SAVE HINWEIS — gilt jetzt einheitlich in der ganzen App */}
      <div className="rounded-2xl border border-gold/20 bg-gold/[0.06] px-5 py-4">
        <p className="text-[12px] text-bone leading-relaxed">
          <span className="font-medium text-gold">ℹ️ Auto-Save aktiv</span>
          <span className="text-bone-muted">
            {' '}— Änderungen werden automatisch gespeichert, sobald du das Feld
            verlässt. Das <span className="text-gold font-medium">✓</span> Symbol
            bestätigt das Speichern.
          </span>
        </p>
      </div>

      <TrainingPlanEditor customerId={customerId} plan={plan} />
    </div>
  );
}
