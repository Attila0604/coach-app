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
    <div className="max-w-5xl mx-auto px-6 py-10">
      <CustomerHeader
        customerId={params.id}
        displayName={displayName}
        status={customer.status}
      />

      <p className="text-[10px] tracking-caps uppercase text-gold font-medium mb-6">
        Training bearbeiten
      </p>

      <TrainingPlanSection customerId={params.id} />
    </div>
  );
}
