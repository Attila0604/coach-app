import CustomerHeader from '@/components/ui/CustomerHeader';
import { getCustomerForCoach } from '@/lib/coach-customer-helpers';
import ActivityList from './ActivityList';

export default async function CustomerActivityPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, customer } = await getCustomerForCoach(params.id);

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const [foodLogsRes, messagesRes] = await Promise.all([
    supabase
      .from('food_logs')
      .select(
        'id, logged_at, meal_type, raw_description, total_kcal, protein_g, carbs_g, fat_g'
      )
      .eq('customer_id', params.id)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false }),
    supabase
      .from('messages')
      .select('id, direction, content, agent_name, created_at')
      .eq('customer_id', params.id)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  const foodLogs = foodLogsRes.data ?? [];
  const messages = messagesRes.data ?? [];

  const displayName =
    customer.first_name || customer.telegram_username || 'Kunde';

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <CustomerHeader
        customerId={params.id}
        displayName={displayName}
        status={customer.status}
      />

      <p className="text-[10px] tracking-caps uppercase text-gold font-medium mb-6">
        Aktivität · letzte 30 Tage
      </p>

      <ActivityList foodLogs={foodLogs} messages={messages} />
    </div>
  );
}
