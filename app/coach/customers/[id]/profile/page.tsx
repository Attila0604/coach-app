import CustomerHeader from '@/components/ui/CustomerHeader';
import { GoalsEditor } from '@/components/ui/GoalsEditor';
import { CoachNotesEditor } from '@/components/ui/CoachNotesEditor';
import { ProfileEditor } from '@/components/ui/ProfileEditor';
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
      .select('*')
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
    <div className="space-y-8">
      <CustomerHeader
        customerId={params.id}
        displayName={displayName}
        status={customer.status}
      />

      <section className="space-y-5">
        <PageSectionTitle
          eyebrow="Profil bearbeiten"
          title="Stammdaten, Training und Coach-Kontext"
          description="Pflege die Basisdaten, Tagesziele und internen Notizen in klar getrennten Bereichen."
        />
        {/* Persönliche Daten + Trainings-Profil */}
        <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5 sm:p-7">
          <h3 className="mb-5 text-[9px] font-medium uppercase tracking-caps text-gold">
            Persönliche Daten & Trainings-Profil
          </h3>
          <ProfileEditor customerId={params.id} profile={profile} />
        </div>

        {/* Tagesziele */}
        <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5 sm:p-7">
          <h3 className="mb-5 text-[9px] font-medium uppercase tracking-caps text-gold">
            Tagesziele (Ernährung)
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

        {/* Coach-Notizen */}
        <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5 sm:p-7">
          <h3 className="mb-5 text-[9px] font-medium uppercase tracking-caps text-gold">
            Coach-Notizen
          </h3>
          <CoachNotesEditor
            customerId={params.id}
            activeNote={activeNote}
            notesHistory={notesHistory}
          />
        </div>
      </section>
    </div>
  );
}

function PageSectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-caps text-gold">
        {eyebrow}
      </p>
      <h2 className="font-serif text-3xl leading-tight text-bone">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-muted">
        {description}
      </p>
    </div>
  );
}
