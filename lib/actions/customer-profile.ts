'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

type Result = { ok: true } | { ok: false; error: string };

type ProfileUpdate = {
  age?: number | null;
  gender?: string | null;
  height_cm?: number | null;
  weight_start_kg?: number | null;
  weight_target_kg?: number | null;
  goal?: string | null;
  experience_level?: string | null;
  equipment?: string | null;
  allergies?: string[] | null;
  food_preferences?: string[] | null;
  notes?: string | null;
};

export async function updateCustomerProfile(
  customerId: string,
  updates: ProfileUpdate
): Promise<Result> {
  if (!customerId) return { ok: false, error: 'Kunden-ID fehlt.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Nicht angemeldet.' };

  const { data: coach } = await supabase
    .from('coaches')
    .select('id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!coach) return { ok: false, error: 'Kein Coach-Konto.' };

  const isAdmin = coach.role === 'admin';

  // Ownership-Check
  let customerCheck = supabase
    .from('customers')
    .select('id')
    .eq('id', customerId);
  if (!isAdmin) customerCheck = customerCheck.eq('coach_id', coach.id);
  const { data: customer } = await customerCheck.maybeSingle();
  if (!customer) {
    return { ok: false, error: 'Kunde nicht gefunden oder keine Berechtigung.' };
  }

  // Existiert schon ein Profil?
  const { data: existing } = await supabase
    .from('customer_profiles')
    .select('customer_id')
    .eq('customer_id', customerId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('customer_profiles')
      .update(updates)
      .eq('customer_id', customerId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from('customer_profiles')
      .insert({ customer_id: customerId, ...updates });
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/customers/${customerId}`);
  revalidatePath(`/coach/customers/${customerId}/profile`);
  return { ok: true };
}
