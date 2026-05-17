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
  const values = {
    daily_kcal_target: clean(input.daily_kcal_target, 500, 8000),
    protein_target_g: clean(input.protein_target_g, 0, 600),
    carbs_target_g: clean(input.carbs_target_g, 0, 1000),
    fat_target_g: clean(input.fat_target_g, 0, 400),
    updated_at: new Date().toISOString(),
  };

  const supabase = createClient();

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

  const { error } = await supabase
    .from("customer_profiles")
    .upsert(
      { customer_id: customerId, ...values },
      { onConflict: "customer_id" }
    );

  if (error) return { ok: false, error: error.message };

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

  await supabase
    .from("coach_notes")
    .update({ is_active: false })
    .eq("customer_id", customerId)
    .eq("is_active", true);

  const { error } = await supabase.from("coach_notes").insert({
    coach_id: coach.id,
    customer_id: customerId,
    content: trimmed,
    is_active: true,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export async function deactivateCoachNote(
  noteId: string,
  customerId: string
): Promise<CoachNoteResult> {
  if (!noteId || !customerId) return { ok: false, error: "Fehlende Daten." };

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

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

// ============================================================
// NUTRITION SETUP (Food Library + Settings)
// ============================================================

export type NutritionResult =
  | { ok: true }
  | { ok: false; error: string };

const FOOD_NAME_MAX = 100;
const FOOD_NOTES_MAX = 200;
const VALID_CATEGORIES = [
  "protein",
  "carb",
  "vegetable",
  "fat",
  "drink",
  "other",
];

async function verifyCoachOwnsCustomer(
  customerId: string
): Promise<{ ok: false; error: string } | { ok: true; coachId: string }> {
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

  return { ok: true, coachId: coach.id };
}

export async function addCustomerFood(
  customerId: string,
  name: string,
  category: string | null,
  notes: string | null
): Promise<NutritionResult> {
  const trimmedName = (name || "").trim();
  if (!trimmedName) return { ok: false, error: "Name ist leer." };
  if (trimmedName.length > FOOD_NAME_MAX) {
    return {
      ok: false,
      error: `Name zu lang (max ${FOOD_NAME_MAX} Zeichen).`,
    };
  }
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };

  const trimmedNotes = notes?.trim() || null;
  if (trimmedNotes && trimmedNotes.length > FOOD_NOTES_MAX) {
    return {
      ok: false,
      error: `Notiz zu lang (max ${FOOD_NOTES_MAX} Zeichen).`,
    };
  }

  const validCategory =
    category && VALID_CATEGORIES.includes(category) ? category : null;

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const supabase = createClient();
  const { error } = await supabase.from("customer_foods").insert({
    customer_id: customerId,
    coach_id: auth.coachId,
    name: trimmedName,
    category: validCategory,
    notes: trimmedNotes,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export async function deleteCustomerFood(
  foodId: string,
  customerId: string
): Promise<NutritionResult> {
  if (!foodId || !customerId) {
    return { ok: false, error: "Fehlende Daten." };
  }

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const supabase = createClient();
  const { error } = await supabase
    .from("customer_foods")
    .delete()
    .eq("id", foodId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export type CustomerSettingsInput = {
  meal_plan_frequency: "daily" | "weekly";
  ai_tips_enabled: boolean;
  meal_plan_via_telegram: boolean;
};

export async function updateCustomerSettings(
  customerId: string,
  settings: CustomerSettingsInput
): Promise<NutritionResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const validFrequency: "daily" | "weekly" =
    settings.meal_plan_frequency === "daily" ? "daily" : "weekly";

  const supabase = createClient();
  const { error } = await supabase
    .from("customer_profiles")
    .upsert(
      {
        customer_id: customerId,
        meal_plan_frequency: validFrequency,
        ai_tips_enabled: !!settings.ai_tips_enabled,
        meal_plan_via_telegram: !!settings.meal_plan_via_telegram,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "customer_id" }
    );

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}
