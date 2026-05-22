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
// AI MEAL PLAN GENERATOR (7-Tage-Plan, Draft + Publish Flow)
// ============================================================

export type MealPlanResult =
  | { ok: true }
  | { ok: false; error: string };

export type GenerateMealPlanResult =
  | { ok: true; planIds: string[]; summary: string | null }
  | { ok: false; error: string };

const MEAL_PLAN_MODEL = "claude-sonnet-4-6";
const MEAL_PLAN_MAX_TOKENS = 8192;

// Kompakter System-Prompt — keine `notes` mehr pro Mahlzeit (spart Tokens),
// und expliziter Hinweis auf kompaktes JSON ohne Whitespace.
const MEAL_PLAN_SYSTEM_PROMPT = `Du bist ein professioneller Ernährungs-Coach. Du erstellst 7-TAGES-PLÄNE.

REGELN:
1. Verwende NUR Lebensmittel aus der "Erlaubten Liste"
2. Schätze Macros möglichst präzise pro Lebensmittel
3. Pro Tag: 3-4 Mahlzeiten
4. VARIIERE über die 7 Tage (keine identischen Tage)
5. Berücksichtige Allergien und Vorlieben strikt
6. summary ist NUR FÜR DEN COACH — schreibe kurze professionelle Notiz

ANTWORTE AUSSCHLIESSLICH MIT VALIDEM JSON. KOMPAKT, OHNE MARKDOWN, OHNE KOMMENTARE, OHNE VORTEXT:

{"days":[{"day_index":0,"meals":[{"meal_type":"breakfast","name":"...","items":[{"food":"...","grams":100,"kcal":165,"protein_g":31,"carbs_g":0,"fat_g":4}],"total_kcal":165,"total_protein_g":31,"total_carbs_g":0,"total_fat_g":4}],"total_kcal":1600,"total_protein_g":165,"total_carbs_g":220,"total_fat_g":73}],"summary":"..."}

Genau 7 days[] Einträge mit day_index 0 bis 6. meal_type ist einer von: breakfast, lunch, dinner, snack. Maximal 3-4 Items pro Mahlzeit. Halte Mahlzeit-Namen kurz (max 40 Zeichen).`;

type FoodLite = {
  name: string;
  category: string | null;
  notes: string | null;
};

function addDaysISO(startDateISO: string, days: number): string {
  const d = new Date(`${startDateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDateDe(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function isValidIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(`${s}T00:00:00Z`));
}

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
  startDate: string;
}): string {
  const { customerName, profile, foods, startDate } = args;

  const allergies = (profile.allergies || []).join(", ") || "Keine";
  const preferences = (profile.food_preferences || []).join(", ") || "Keine";

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

  const dates = Array.from({ length: 7 }, (_, i) =>
    formatDateDe(addDaysISO(startDate, i))
  );
  const datesList = dates.map((d, i) => `  Tag ${i + 1}: ${d}`).join("\n");

  return `Erstelle einen 7-TAGES-PLAN ab ${formatDateDe(startDate)}.

KUNDE: ${customerName}, ${profile.age ?? "—"}J ${profile.gender ?? "—"}, ${
    profile.weight_start_kg ?? "—"
  }kg → ${profile.weight_target_kg ?? "—"}kg, Ziel: ${profile.goal ?? "—"}
Allergien: ${allergies} | Vorlieben: ${preferences}

TAGESZIELE (für JEDEN Tag): ${profile.daily_kcal_target ?? "?"} kcal, ${
    profile.protein_target_g ?? "?"
  }g Protein, ${profile.carbs_target_g ?? "?"}g Carbs, ${
    profile.fat_target_g ?? "?"
  }g Fett

TAGE:
${datesList}

ERLAUBTE LEBENSMITTEL:
${foodsList}

Antworte mit dem JSON-Format aus dem System-Prompt. 7 Tage, kompakt, ohne Markdown.`;
}

/**
 * Robuste JSON-Extraktion: handhabt Markdown-Fences, Trailing-Commas, Vortext.
 */
function extractJson(text: string): any {
  // 1. Direkter Parse
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }

  // 2. Markdown-Fences strippen
  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* continue */
  }

  // 3. Substring zwischen erstem { und letztem }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(cleaned);
    } catch {
      /* continue */
    }

    // 4. Trailing-Commas reparieren: ", }" → " }", ", ]" → " ]"
    const noTrailingCommas = cleaned
      .replace(/,(\s*[}\]])/g, "$1")
      // Auch single-line comments entfernen (// ...)
      .replace(/\/\/[^\n]*/g, "")
      // Block comments entfernen
      .replace(/\/\*[\s\S]*?\*\//g, "");
    try {
      return JSON.parse(noTrailingCommas);
    } catch {
      /* continue */
    }
  }

  throw new Error("Kein gültiges JSON gefunden");
}

async function callMealPlanAI(args: {
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
}): Promise<string> {
  return callClaude(
    [{ role: "user", content: args.userPrompt }],
    {
      model: MEAL_PLAN_MODEL,
      maxTokens: MEAL_PLAN_MAX_TOKENS,
      system: args.systemPrompt,
      temperature: args.temperature,
    }
  );
}

export async function generateMealPlan(
  customerId: string,
  startDate: string
): Promise<GenerateMealPlanResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };
  if (!startDate || !isValidIsoDate(startDate)) {
    return { ok: false, error: "Ungültiges Start-Datum (Format YYYY-MM-DD)." };
  }

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
      error:
        "Tagesziele nicht gesetzt (Kalorien fehlen). Bitte erst Tagesziele konfigurieren.",
    };
  }

  const userPrompt = buildMealPlanPrompt({
    customerName: customer.first_name || customer.telegram_username || "Kunde",
    profile,
    foods,
    startDate,
  });

  // Erster Versuch
  let aiResponse: string;
  try {
    aiResponse = await callMealPlanAI({
      systemPrompt: MEAL_PLAN_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.7,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `AI-Fehler: ${msg}` };
  }

  let parsed: any;
  let parseError: unknown = null;
  try {
    parsed = extractJson(aiResponse);
  } catch (e) {
    parseError = e;
  }

  // Auto-Retry mit niedriger Temperature für strikteres JSON
  if (!parsed || !Array.isArray(parsed?.days)) {
    console.error(
      "[generateMealPlan] First parse failed. Raw response (first 1000 chars):",
      aiResponse?.slice(0, 1000)
    );
    console.error("[generateMealPlan] Parse error:", parseError);

    try {
      aiResponse = await callMealPlanAI({
        systemPrompt:
          MEAL_PLAN_SYSTEM_PROMPT +
          "\n\nWICHTIG: Letzter Versuch ergab kein valides JSON. Antworte JETZT NUR mit dem JSON-Objekt, ohne irgendwelche Zusätze.",
        userPrompt,
        temperature: 0.2,
      });
      parsed = extractJson(aiResponse);
    } catch (e2) {
      const preview = aiResponse?.slice(0, 200) ?? "(leer)";
      console.error(
        "[generateMealPlan] Retry parse failed. Raw response (first 1000 chars):",
        aiResponse?.slice(0, 1000)
      );
      return {
        ok: false,
        error: `AI-Antwort konnte nicht geparst werden (auch nach Retry). Anfang der Antwort: "${preview}…"`,
      };
    }
  }

  if (!Array.isArray(parsed.days) || parsed.days.length !== 7) {
    console.error(
      "[generateMealPlan] Invalid structure. days length:",
      Array.isArray(parsed.days) ? parsed.days.length : "not-an-array"
    );
    return {
      ok: false,
      error: `Ungültige Plan-Struktur: erwartet 7 Tage, erhalten ${
        Array.isArray(parsed.days) ? parsed.days.length : 0
      }.`,
    };
  }

  // Alte Drafts → 'replaced'
  await supabase
    .from("meal_plans")
    .update({ status: "replaced", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("status", "draft");

  const rows = parsed.days.map((day: any, i: number) => ({
    customer_id: customerId,
    coach_id: auth.coachId,
    plan_date: addDaysISO(startDate, i),
    plan_type: "weekly",
    meals: Array.isArray(day.meals) ? day.meals : [],
    total_kcal: day.total_kcal ?? null,
    total_protein_g: day.total_protein_g ?? null,
    total_carbs_g: day.total_carbs_g ?? null,
    total_fat_g: day.total_fat_g ?? null,
    ai_model: MEAL_PLAN_MODEL,
    ai_summary: i === 0 ? parsed.summary ?? null : null,
    status: "draft",
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("meal_plans")
    .insert(rows)
    .select("id");

  if (insertError) return { ok: false, error: insertError.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return {
    ok: true,
    planIds: (inserted ?? []).map((p) => p.id),
    summary: parsed.summary ?? null,
  };
}

export async function updateMealPlanMeals(
  planId: string,
  customerId: string,
  meals: any[]
): Promise<MealPlanResult> {
  if (!planId || !customerId) {
    return { ok: false, error: "Fehlende Daten." };
  }
  if (!Array.isArray(meals)) {
    return { ok: false, error: "Ungültige Mahlzeiten-Daten." };
  }

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  let totalKcal = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;

  for (const meal of meals) {
    let mealKcal = 0;
    let mealProtein = 0;
    let mealCarbs = 0;
    let mealFat = 0;
    const items = Array.isArray(meal.items) ? meal.items : [];
    for (const item of items) {
      mealKcal += Number(item.kcal) || 0;
      mealProtein += Number(item.protein_g) || 0;
      mealCarbs += Number(item.carbs_g) || 0;
      mealFat += Number(item.fat_g) || 0;
    }
    meal.total_kcal = Math.round(mealKcal);
    meal.total_protein_g = Math.round(mealProtein);
    meal.total_carbs_g = Math.round(mealCarbs);
    meal.total_fat_g = Math.round(mealFat);

    totalKcal += mealKcal;
    totalProtein += mealProtein;
    totalCarbs += mealCarbs;
    totalFat += mealFat;
  }

  const supabase = createClient();

  const { data: plan } = await supabase
    .from("meal_plans")
    .select("id, customer_id, status")
    .eq("id", planId)
    .maybeSingle();
  if (!plan) return { ok: false, error: "Plan nicht gefunden." };
  if (plan.customer_id !== customerId) {
    return { ok: false, error: "Plan gehört nicht zu diesem Kunden." };
  }
  if (plan.status === "replaced") {
    return { ok: false, error: "Ersetzte Pläne können nicht editiert werden." };
  }

  const { error } = await supabase
    .from("meal_plans")
    .update({
      meals,
      total_kcal: Math.round(totalKcal),
      total_protein_g: Math.round(totalProtein),
      total_carbs_g: Math.round(totalCarbs),
      total_fat_g: Math.round(totalFat),
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export async function publishMealPlan(
  customerId: string
): Promise<MealPlanResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const supabase = createClient();

  const { data: drafts } = await supabase
    .from("meal_plans")
    .select("id, plan_date")
    .eq("customer_id", customerId)
    .eq("status", "draft");

  if (!drafts || drafts.length === 0) {
    return { ok: false, error: "Kein Draft-Plan zum Veröffentlichen." };
  }

  const draftDates = drafts.map((d) => d.plan_date);

  await supabase
    .from("meal_plans")
    .update({ status: "replaced", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("status", "published")
    .in("plan_date", draftDates);

  const { error } = await supabase
    .from("meal_plans")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export async function discardMealPlanDraft(
  customerId: string
): Promise<MealPlanResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const supabase = createClient();

  const { error } = await supabase
    .from("meal_plans")
    .update({ status: "replaced", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}
