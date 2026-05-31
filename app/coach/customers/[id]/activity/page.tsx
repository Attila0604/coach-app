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

  const [foodLogsRes, messagesRes, workoutsRes] = await Promise.all([
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
    supabase
      .from('workout_sessions')
      .select(
        `
        id,
        started_at,
        ended_at,
        status,
        total_duration_seconds,
        notes,
        training_days(id, day_number, title, subtitle),
        workout_logs(id, exercise_id, set_number, reps_done, weight_used_kg)
      `
      )
      .eq('customer_id', params.id)
      .gte('started_at', since.toISOString())
      .order('started_at', { ascending: false }),
  ]);

  const foodLogs = foodLogsRes.data ?? [];
  const messages = messagesRes.data ?? [];
  const workouts = workoutsRes.data ?? [];

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
          Aktivität · letzte 30 Tage
        </p>
        <h2 className="font-serif text-3xl leading-tight text-bone">
          Timeline
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-muted">
          Mahlzeiten, Nachrichten und Workouts chronologisch gebündelt.
        </p>
      </div>

      <ActivityList
        foodLogs={foodLogs}
        messages={messages}
        workouts={workouts as any}
      />
    </div>
  );
}
