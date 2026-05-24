import CustomerHeader from '@/components/ui/CustomerHeader';
import { NutritionSetup } from '@/components/ui/NutritionSetup';
import {
  WeeklyMealPlanEditor,
  type Plan as MealPlan,
} from '@/components/ui/WeeklyMealPlanEditor';
import {
  getCustomerForCoach,
  buildWindow,
} from '@/lib/coach-customer-helpers';

export default async function CustomerNutritionPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, customer } = await getCustomerForCoach(params.id);
  const { todayKey } = buildWindow();

  const [profileRes, foodsRes, mealPlansRes] = await Promise.all([
    supabase
      .from('customer_profiles')
      .select(
        'meal_plan_frequency, ai_tips_enabled, meal_plan_via_telegram, daily_kcal_target, protein_target_g, carbs_target_g, fat_target_g'
      )
      .eq('customer_id', params.id)
      .maybeSingle(),
    supabase
      .from('customer_foods')
      .select(
        'id, name, category, notes, is_preferred, sort_order, created_at'
      )
      .eq('customer_id', params.id)
      .order('created_at', { ascending: true }),
    supabase
      .from('meal_plans')
      .select(
        'id, plan_date, meals, total_kcal, total_protein_g, total_carbs_g, total_fat_g, ai_summary, status, created_at, updated_at'
      )
      .eq('customer_id', params.id)
      .gte('plan_date', todayKey)
      .in('status', ['draft', 'published'])
      .order('plan_date', { ascending: true }),
  ]);

  const profile = profileRes.data;
  const foods = foodsRes.data ?? [];
  const allMealPlans = (mealPlansRes.data ?? []) as MealPlan[];

  const drafts = allMealPlans.filter((p) => p.status === 'draft');
  const published = allMealPlans.filter((p) => p.status === 'published');
  const visiblePlans: MealPlan[] = drafts.length > 0 ? drafts : published;
  const hasDraft = drafts.length > 0;

  const nutritionSettings = {
    meal_plan_frequency:
      (profile?.meal_plan_frequency as 'daily' | 'weekly') || 'weekly',
    ai_tips_enabled: !!profile?.ai_tips_enabled,
    meal_plan_via_telegram: profile?.meal_plan_via_telegram ?? true,
  };

  const planTargets = {
    kcal: profile?.daily_kcal_target ?? null,
    protein: profile?.protein_target_g ?? null,
    carbs: profile?.carbs_target_g ?? null,
    fat: profile?.fat_target_g ?? null,
  };

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
        Ernährung bearbeiten
      </p>

      <div className="space-y-8">
        <NutritionSetup
          customerId={params.id}
          foods={foods}
          settings={nutritionSettings}
          hasDraft={hasDraft}
        />

        {visiblePlans.length > 0 && (
          <WeeklyMealPlanEditor
            customerId={params.id}
            plans={visiblePlans}
            targets={planTargets}
          />
        )}
      </div>
    </div>
  );
}
