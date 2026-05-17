"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";

// ============================================================
// GOALS
// ============================================================

export type GoalsInput = {
  daily_kcal_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
};

export type GoalsResult =
  | { ok: true }
  | { ok: false; error: string };

function clean(n: unknown, min: number, max: number): number | null {
  if (n === null || n === undefined || n === "") return null;
  const num = Number(n);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return Math.round(num);
}

export async function updateGoals(
  customerId: string,
  input: GoalsInput
): Promise<GoalsResult> {
  // Sanitize inputs — keep nulls allowed (means "not set")
  const values = {
    daily_kcal_target: clean(input.daily_kcal_target, 500, 8000),
    protein_target_g: clean(input.protein_target_g, 0, 600),
    carbs_target_g: clean(input.carbs_target_g, 0, 1000),
    fat_target_g: clean(input.fat_target_g, 0, 400),
    updated_at: new Date().toISOString(),
  };

  const supabase = createClient();

  // Verify auth + coach owns this customer
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht eingeloggt." };

  const { data: coach } = await supabase
    .from("coaches")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!coach) return { ok: false, error: "Kein Coach-Konto gefunden." };

  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .eq("coach_id", coach.id)
    .maybeSingle();
  if (!customer) {
    return { ok: false, error: "Kunde nicht gefunden oder keine Berechtigung." };
  }

  // Upsert profile row (insert if not exists, update if exists)
  const { error } = await supabase
    .from("customer_profiles")
    .upsert(
      { customer_id: customerId, ...values },
      { onConflict: "customer_id" }
    );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

// ============================================================
// COACH NOTES
// ============================================================

export type CoachNoteResult =
  | { ok: true }
  | { ok: false; error: string };

const NOTE_MAX_LENGTH = 500;

export async function saveCoachNote(
  customerId: string,
  content: string
): Promise<CoachNoteResult> {
  const trimmed = (content || "").trim();
  if (!trimmed) return { ok: false, error: "Nachricht ist leer." };
  if (trimmed.length > NOTE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Nachricht zu lang (max ${NOTE_MAX_LENGTH} Zeichen).`,
    };
  }
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht eingeloggt." };

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!coach) return { ok: false, error: "Kein Coach-Konto gefunden." };

  const isAdmin = coach.role === "admin";

  // Verify customer belongs to this coach (unless admin)
  if (!isAdmin) {
    const { data: customer } = await supabase
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("coach_id", coach.id)
      .maybeSingle();
    if (!customer) {
      return {
        ok: false,
        error: "Kunde nicht gefunden oder keine Berechtigung.",
      };
    }
  }

  // Deactivate existing active notes for this customer
  await supabase
    .from("coach_notes")
    .update({ is_active: false })
    .eq("customer_id", customerId)
    .eq("is_active", true);

  // Insert new active note
  const { error } = await supabase.from("coach_notes").insert({
    coach_id: coach.id,
    customer_id: customerId,
    content: trimmed,
    is_active: true,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export async function deactivateCoachNote(
  noteId: string,
  customerId: string
): Promise<CoachNoteResult> {
  if (!noteId || !customerId) {
    return { ok: false, error: "Fehlende Daten." };
  }

  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Nicht eingeloggt." };

  const { data: coach } = await supabase
    .from("coaches")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!coach) return { ok: false, error: "Kein Coach-Konto gefunden." };

  const isAdmin = coach.role === "admin";

  // Verify the note belongs to this coach (unless admin)
  const { data: note } = await supabase
    .from("coach_notes")
    .select("id, coach_id")
    .eq("id", noteId)
    .maybeSingle();
  if (!note) return { ok: false, error: "Notiz nicht gefunden." };
  if (!isAdmin && note.coach_id !== coach.id) {
    return { ok: false, error: "Keine Berechtigung." };
  }

  const { error } = await supabase
    .from("coach_notes")
    .update({ is_active: false })
    .eq("id", noteId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}
