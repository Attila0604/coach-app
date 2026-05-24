import CustomerHeader from '@/components/ui/CustomerHeader';
import { GoalsEditor } from '@/components/ui/GoalsEditor';
import { CoachNotesEditor } from '@/components/ui/CoachNotesEditor';
import { getCustomerForCoach } from '@/lib/coach-customer-helpers';

export default async function CustomerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, customer } = await getCustomerForCoach(params.id);

  const [profileRes, notesRes] = await Promise.all([
    supabase
      .from('customer_profiles')
      .select(
        'daily_kcal_target, protein_target_g, carbs_target_g, fat_target_g'
      )
      .eq('customer_id', params.id)
      .maybeSingle(),
    supabase
      .from('coach_notes')
      .select('id, content, is_active, created_at, expires_at')
      .eq('customer_id', params.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const profile = profileRes.data;
  const allNotes = notesRes.data ?? [];
  const activeNote = allNotes.find((n) => n.is_active) ?? null;
  const notesHistory = allNotes.filter((n) => !n.is_active).slice(0, 5);

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
        Profil bearbeiten
      </p>

      <div className="space-y-8">
        <div className="bg-ink-900 p-7">
          <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-5">
            Tagesziele
          </h3>
          <GoalsEditor
            customerId={params.id}
            profile={
              profile
                ? {
                    daily_kcal_target: profile.daily_kcal_target ?? null,
                    protein_target_g: profile.protein_target_g ?? null,
                    carbs_target_g: profile.carbs_target_g ?? null,
                    fat_target_g: profile.fat_target_g ?? null,
                  }
                : null
            }
          />
        </div>

        <div className="bg-ink-900 p-7">
          <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-5">
            Coach-Notizen
          </h3>
          <CoachNotesEditor
            customerId={params.id}
            activeNote={activeNote}
            notesHistory={notesHistory}
          />
        </div>
      </div>
    </div>
  );
}
