"use server";

import { createClient } from "@/lib/supabase-server";
import { revalidatePath } from "next/cache";
import { callClaude } from "@/lib/claude";

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

// ============================================================
// AI MEAL PLAN GENERATOR
// ============================================================

export type MealPlanResult =
  | { ok: true; planId: string; summary: string | null }
  | { ok: false; error: string };

const MEAL_PLAN_MODEL = "claude-sonnet-4-6";

const MEAL_PLAN_SYSTEM_PROMPT = `Du bist ein professioneller Ernährungs-Coach. Du erstellst persönliche Tagespläne basierend auf:
- Den Tageszielen des Kunden (Kalorien + Macros)
- Den vom Coach erlaubten Lebensmitteln
- Dem Kundenprofil (Allergien, Vorlieben, Ziele)

WICHTIGE REGELN:
1. Verwende NUR Lebensmittel aus der "Erlaubten Liste" — nichts erfinden
2. Schätze Macros möglichst präzise pro Lebensmittel (pro genannter Menge in Gramm)
3. Verteile die Tages-Macros auf 3-4 Mahlzeiten (Frühstück, Mittag, Abend, optional Snack)
4. Berücksichtige Allergien und Vorlieben strikt
5. Bei wenig Auswahl: clever kombinieren, im "summary" ehrlich Hinweis geben

ANTWORTE AUSSCHLIESSLICH MIT VALIDEM JSON (kein Markdown, kein Vortext, kein Text danach):

{
  "meals": [
    {
      "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
      "name": "Name der Mahlzeit",
      "items": [
        { "food": "Lebensmittel-Name (exakt aus Liste)", "grams": 100, "kcal": 165, "protein_g": 31, "carbs_g": 0, "fat_g": 4 }
      ],
      "total_kcal": 165,
      "total_protein_g": 31,
      "total_carbs_g": 0,
      "total_fat_g": 4,
      "notes": "Optionale Hinweise zur Zubereitung"
    }
  ],
  "total_kcal": 1600,
  "total_protein_g": 165,
  "total_carbs_g": 220,
  "total_fat_g": 73,
  "summary": "1-2 Sätze Zusammenfassung mit Logik des Plans"
}`;

type FoodLite = {
  name: string;
  category: string | null;
  notes: string | null;
};

function buildMealPlanPrompt(args: {
  customerName: string;
  profile: {
    age?: number | null;
    gender?: string | null;
    goal?: string | null;
    allergies?: string[] | null;
    food_preferences?: string[] | null;
    weight_start_kg?: number | null;
    weight_target_kg?: number | null;
    daily_kcal_target?: number | null;
    protein_target_g?: number | null;
    carbs_target_g?: number | null;
    fat_target_g?: number | null;
  };
  foods: FoodLite[];
  planDate: string;
}): string {
  const { customerName, profile, foods, planDate } = args;

  const allergies = (profile.allergies || []).join(", ") || "Keine";
  const preferences = (profile.food_preferences || []).join(", ") || "Keine";

  // Group foods by category
  const grouped: Record<string, FoodLite[]> = {};
  for (const food of foods) {
    const cat = food.category || "sonstiges";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(food);
  }

  const foodsList = Object.entries(grouped)
    .map(([cat, items]) => {
      const itemList = items
        .map((f) => `  • ${f.name}${f.notes ? ` (${f.notes})` : ""}`)
        .join("\n");
      return `${cat.toUpperCase()}:\n${itemList}`;
    })
    .join("\n\n");

  return `Erstelle einen TAGESPLAN für den ${planDate}.

KUNDE:
- Name: ${customerName}
- Alter: ${profile.age ?? "—"}, Geschlecht: ${profile.gender ?? "—"}
- Aktuelles Gewicht: ${profile.weight_start_kg ?? "—"} kg → Ziel: ${profile.weight_target_kg ?? "—"} kg
- Trainings-Ziel: ${profile.goal ?? "—"}
- Allergien: ${allergies}
- Vorlieben: ${preferences}

TAGESZIELE (möglichst genau treffen):
- Kalorien: ${profile.daily_kcal_target ?? "?"} kcal
- Protein: ${profile.protein_target_g ?? "?"} g
- Carbs: ${profile.carbs_target_g ?? "?"} g
- Fett: ${profile.fat_target_g ?? "?"} g

ERLAUBTE LEBENSMITTEL (NUR diese verwenden):
${foodsList}

Erstelle 3-4 Mahlzeiten. Antworte AUSSCHLIESSLICH mit JSON wie im System-Prompt definiert.`;
}

function extractJson(text: string): unknown {
  // Try parsing directly
  try {
    return JSON.parse(text);
  } catch {
    // Strip markdown code fences
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Last resort: find first { and last }
      const firstBrace = text.indexOf("{");
      const lastBrace = text.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const slice = text.slice(firstBrace, lastBrace + 1);
        return JSON.parse(slice);
      }
      throw new Error("Kein gültiges JSON gefunden");
    }
  }
}

export async function generateMealPlan(
  customerId: string,
  planDate?: string
): Promise<MealPlanResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const supabase = createClient();

  const [customerRes, profileRes, foodsRes] = await Promise.all([
    supabase
      .from("customers")
      .select("id, first_name, telegram_username")
      .eq("id", customerId)
      .maybeSingle(),
    supabase
      .from("customer_profiles")
      .select("*")
      .eq("customer_id", customerId)
      .maybeSingle(),
    supabase
      .from("customer_foods")
      .select("name, category, notes")
      .eq("customer_id", customerId)
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
  ]);

  const customer = customerRes.data;
  const profile = profileRes.data;
  const foods = foodsRes.data ?? [];

  if (!customer) return { ok: false, error: "Kunde nicht gefunden." };
  if (foods.length === 0) {
    return {
      ok: false,
      error: "Keine Lebensmittel im Food-Library. Bitte erst welche hinzufügen.",
    };
  }
  if (!profile?.daily_kcal_target) {
    return {
      ok: false,
      error: "Tagesziele nicht gesetzt (Kalorien fehlen). Bitte erst Tagesziele konfigurieren.",
    };
  }

  const date = planDate || new Date().toISOString().split("T")[0];

  const prompt = buildMealPlanPrompt({
    customerName: customer.first_name || customer.telegram_username || "Kunde",
    profile,
    foods,
    planDate: date,
  });

  let aiResponse: string;
  try {
    aiResponse = await callClaude(
      [{ role: "user", content: prompt }],
      {
        model: MEAL_PLAN_MODEL,
        maxTokens: 4000,
        system: MEAL_PLAN_SYSTEM_PROMPT,
        temperature: 0.7,
      }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AI-Fehler: ${msg}` };
  }

  let parsed: any;
  try {
    parsed = extractJson(aiResponse);
  } catch (e) {
    return {
      ok: false,
      error: "AI-Antwort konnte nicht geparst werden. Bitte nochmal versuchen.",
    };
  }

  if (!Array.isArray(parsed.meals) || parsed.meals.length === 0) {
    return { ok: false, error: "Ungültige Plan-Struktur (keine Mahlzeiten)." };
  }

  // Archive any existing active plan for this customer + date
  await supabase
    .from("meal_plans")
    .update({ status: "replaced" })
    .eq("customer_id", customerId)
    .eq("plan_date", date)
    .eq("status", "active");

  const { data: inserted, error: insertError } = await supabase
    .from("meal_plans")
    .insert({
      customer_id: customerId,
      coach_id: auth.coachId,
      plan_date: date,
      plan_type: "daily",
      meals: parsed.meals,
      total_kcal: parsed.total_kcal ?? null,
      total_protein_g: parsed.total_protein_g ?? null,
      total_carbs_g: parsed.total_carbs_g ?? null,
      total_fat_g: parsed.total_fat_g ?? null,
      ai_model: MEAL_PLAN_MODEL,
      ai_summary: parsed.summary ?? null,
      status: "active",
    })
    .select("id")
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return {
    ok: true,
    planId: inserted.id,
    summary: parsed.summary || null,
  };
}
