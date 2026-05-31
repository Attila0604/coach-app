import CustomerHeader from '@/components/ui/CustomerHeader';
import TrainingPlanSection from '@/components/training-plan-section';
import { getCustomerForCoach } from '@/lib/coach-customer-helpers';

export default async function CustomerTrainingPage({
  params,
}: {
  params: { id: string };
}) {
  const { customer } = await getCustomerForCoach(params.id);

  const displayName =
    customer.first_name || customer.telegram_username || 'Kunde';

  return (
    <div className="space-y-8">
      <CustomerHeader
        customerId={params.id}
        displayName={displayName}
        status={customer.status}
      />

      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-caps text-gold">
          Training bearbeiten
        </p>
        <h2 className="font-serif text-3xl leading-tight text-bone">
          Trainingsplan & KI-Generator
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-muted">
          Plane, prüfe und aktiviere Workouts mit klarer Trennung zwischen
          Generator, Status und Editor.
        </p>
      </div>

      <TrainingPlanSection customerId={params.id} />
    </div>
  );
}
