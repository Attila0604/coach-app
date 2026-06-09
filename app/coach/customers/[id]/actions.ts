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

export type RecalcResult =
  | { ok: true; meals: any[] }
  | { ok: false; error: string };

const MEAL_PLAN_MODEL = "claude-sonnet-4-6";
const MEAL_PLAN_MAX_TOKENS = 8192;

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

const MACRO_RECALC_SYSTEM_PROMPT = `Du bist Ernährungs-Experte. Du bekommst eine Liste von Lebensmittel-Items mit Name und Gramm-Menge.
Schätze pro Item die korrekten Makros so präzise wie möglich.

ANTWORTE NUR VALIDEM JSON, KOMPAKT, OHNE MARKDOWN, OHNE VORTEXT:

{"items":[{"kcal":165,"protein_g":31,"carbs_g":0,"fat_g":4}]}

GENAU so viele items[] wie im Input. Reihenfolge identisch. Ganze Zahlen (gerundet).`;

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

function extractJson(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    /* continue */
  }

  let cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    /* continue */
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = text.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(cleaned);
    } catch {
      /* continue */
    }

    const noTrailingCommas = cleaned
      .replace(/,(\s*[}\]])/g, "$1")
      .replace(/\/\/[^\n]*/g, "")
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
  maxTokens?: number;
}): Promise<string> {
  return callClaude(
    [{ role: "user", content: args.userPrompt }],
    {
      model: MEAL_PLAN_MODEL,
      maxTokens: args.maxTokens ?? MEAL_PLAN_MAX_TOKENS,
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

/**
 * KI berechnet die Makros (kcal, Protein, Carbs, Fett) pro Item
 * basierend auf Lebensmittel-Name und Gramm-Menge.
 * Speichert NICHT in DB — gibt nur aktualisierte meals zurück,
 * der Coach muss dann "Tag speichern" drücken.
 */
export async function recalculateMealMacros(
  customerId: string,
  meals: any[]
): Promise<RecalcResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };
  if (!Array.isArray(meals) || meals.length === 0) {
    return { ok: false, error: "Keine Mahlzeiten zum Berechnen." };
  }

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  // Collect alle Items mit gültigem food-Namen
  type ItemLoc = {
    mealIdx: number;
    itemIdx: number;
    food: string;
    grams: number;
  };
  const itemsToRecalc: ItemLoc[] = [];

  for (let m = 0; m < meals.length; m++) {
    const meal = meals[m];
    const items = Array.isArray(meal.items) ? meal.items : [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const food = (it?.food ?? "").toString().trim();
      if (food) {
        const grams = Number(it?.grams);
        itemsToRecalc.push({
          mealIdx: m,
          itemIdx: i,
          food,
          grams: Number.isFinite(grams) && grams > 0 ? grams : 100,
        });
      }
    }
  }

  if (itemsToRecalc.length === 0) {
    return {
      ok: false,
      error: "Keine Items mit Lebensmittel-Name vorhanden.",
    };
  }

  const listText = itemsToRecalc
    .map((it, i) => `${i + 1}. ${it.food}, ${it.grams}g`)
    .join("\n");

  const userPrompt = `Berechne Makros für diese Lebensmittel-Items:

${listText}

Antwort als JSON mit exakt ${itemsToRecalc.length} items.`;

  let aiResponse: string;
  try {
    aiResponse = await callMealPlanAI({
      systemPrompt: MACRO_RECALC_SYSTEM_PROMPT,
      userPrompt,
      temperature: 0.3,
      maxTokens: 2000,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `KI-Fehler: ${msg}` };
  }

  let parsed: any;
  try {
    parsed = extractJson(aiResponse);
  } catch (e) {
    console.error(
      "[recalculateMealMacros] Parse failed. Raw response (first 500 chars):",
      aiResponse?.slice(0, 500)
    );
    return {
      ok: false,
      error: "KI-Antwort konnte nicht geparst werden.",
    };
  }

  if (
    !Array.isArray(parsed.items) ||
    parsed.items.length !== itemsToRecalc.length
  ) {
    return {
      ok: false,
      error: `Ungültiges KI-Format: erwartet ${itemsToRecalc.length} items, erhalten ${
        Array.isArray(parsed.items) ? parsed.items.length : 0
      }.`,
    };
  }

  // Deep-clone meals damit wir nicht den input mutieren
  const updatedMeals = meals.map((m: any) => ({
    ...m,
    items: Array.isArray(m.items)
      ? m.items.map((it: any) => ({ ...it }))
      : [],
  }));

  // Update items mit neuen Makros
  for (let i = 0; i < itemsToRecalc.length; i++) {
    const loc = itemsToRecalc[i];
    const newMacros = parsed.items[i] || {};
    const item = updatedMeals[loc.mealIdx].items[loc.itemIdx];
    item.kcal = Math.round(Number(newMacros.kcal) || 0);
    item.protein_g = Math.round(Number(newMacros.protein_g) || 0);
    item.carbs_g = Math.round(Number(newMacros.carbs_g) || 0);
    item.fat_g = Math.round(Number(newMacros.fat_g) || 0);
  }

  // Meal-Totals neu berechnen
  for (const meal of updatedMeals) {
    let kcal = 0;
    let p = 0;
    let c = 0;
    let f = 0;
    for (const it of meal.items || []) {
      kcal += Number(it.kcal) || 0;
      p += Number(it.protein_g) || 0;
      c += Number(it.carbs_g) || 0;
      f += Number(it.fat_g) || 0;
    }
    meal.total_kcal = Math.round(kcal);
    meal.total_protein_g = Math.round(p);
    meal.total_carbs_g = Math.round(c);
    meal.total_fat_g = Math.round(f);
  }

  return { ok: true, meals: updatedMeals };
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

const PLAN_LANG_NAME: Record<string, string> = {
  de: "German",
  it: "Italian",
  hu: "Hungarian",
};

// Übersetzt nur die Freitext-Felder eines Mahlzeiten-Plans (name, notes, food)
// in die Zielsprache. Zahlen, Makros, meal_type und Struktur bleiben unverändert.
async function translateMealsToLanguage(
  meals: unknown,
  targetLang: string
): Promise<unknown> {
  const langName = PLAN_LANG_NAME[targetLang];
  if (!langName) return meals;
  const system =
    `You are a precise translator for a fitness and nutrition app. ` +
    `Translate ONLY the human-readable text fields of this meal-plan JSON into ${langName}. ` +
    `Translate these fields: each meal's "name", each meal's "notes", and each item's "food". ` +
    `Do NOT translate or change: "meal_type" values, any numbers (grams, kcal, protein_g, carbs_g, fat_g and all totals), the JSON keys, or the structure. ` +
    `Keep brand names and proper nouns as they are. ` +
    `Respond with ONLY the resulting JSON, without markdown fences and without any commentary.`;
  const raw = await callClaude(
    [{ role: "user", content: JSON.stringify(meals) }],
    { model: MEAL_PLAN_MODEL, maxTokens: 4000, temperature: 0, system }
  );
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(clean);
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
  // Frühestes Entwurfs-Datum = Wochenstart
  const minDate = draftDates.reduce((a, b) => (a < b ? a : b));

  // ALLE veröffentlichten Tage ab dem Wochenstart ersetzen (nicht nur exakte
  // Datums-Treffer) -> verhindert doppelte/zurückbleibende alte "published"-Zeilen
  await supabase
    .from("meal_plans")
    .update({ status: "replaced", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("status", "published")
    .gte("plan_date", minDate);

  const { error } = await supabase
    .from("meal_plans")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .eq("status", "draft");

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

// Übersetzt die Inhalte der angegebenen Pläne (egal ob Entwurf oder
// veröffentlicht) in die Zielsprache – direkt und sofort sichtbar.
export async function translatePlans(
  customerId: string,
  targetLang: string,
  planIds: string[]
): Promise<MealPlanResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };
  if (!targetLang || !PLAN_LANG_NAME[targetLang]) {
    return { ok: false, error: "Ungültige Sprache." };
  }
  if (!planIds || planIds.length === 0) {
    return { ok: false, error: "Kein Plan zum Übersetzen." };
  }

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const supabase = createClient();

  const { data: rows } = await supabase
    .from("meal_plans")
    .select("id, customer_id, meals")
    .in("id", planIds)
    .eq("customer_id", customerId);

  if (!rows || rows.length === 0) {
    return { ok: false, error: "Kein passender Plan gefunden." };
  }

  for (const r of rows) {
    const row = r as { id: string; meals?: unknown };
    try {
      const translated = await translateMealsToLanguage(
        row.meals ?? [],
        targetLang
      );
      const { error } = await supabase
        .from("meal_plans")
        .update({ meals: translated, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) return { ok: false, error: error.message };
    } catch (e) {
      return {
        ok: false,
        error:
          "Übersetzung fehlgeschlagen: " +
          (e instanceof Error ? e.message : "Unbekannter Fehler"),
      };
    }
  }

  revalidatePath(`/coach/customers/${customerId}`);
  return { ok: true };
}

export async function translateAndPublish(
  customerId: string,
  targetLang: string
): Promise<MealPlanResult> {
  if (!customerId) return { ok: false, error: "Kunden-ID fehlt." };
  if (!targetLang || !PLAN_LANG_NAME[targetLang]) {
    return { ok: false, error: "Ungültige Sprache." };
  }

  const auth = await verifyCoachOwnsCustomer(customerId);
  if (!auth.ok) return auth;

  const supabase = createClient();

  // 1) Arbeitsmenge bestimmen: Entwürfe bevorzugt, sonst die veröffentlichten.
  let { data: working } = await supabase
    .from("meal_plans")
    .select("id, plan_date, meals")
    .eq("customer_id", customerId)
    .eq("status", "draft");

  if (!working || working.length === 0) {
    const res = await supabase
      .from("meal_plans")
      .select("id, plan_date, meals")
      .eq("customer_id", customerId)
      .eq("status", "published");
    working = res.data ?? [];
  }

  if (!working || working.length === 0) {
    return { ok: false, error: "Kein Plan zum Übersetzen vorhanden." };
  }

  // 2) Alles zuerst übersetzen (im Speicher) — falls etwas schiefgeht,
  //    wird die DB gar nicht angefasst.
  const prepared: { id: string; plan_date: string; meals: unknown }[] = [];
  for (const r of working) {
    const row = r as { id: string; plan_date: string; meals?: unknown };
    try {
      const translated = await translateMealsToLanguage(
        row.meals ?? [],
        targetLang
      );
      prepared.push({ id: row.id, plan_date: row.plan_date, meals: translated });
    } catch (e) {
      return {
        ok: false,
        error:
          "Übersetzung fehlgeschlagen: " +
          (e instanceof Error ? e.message : "Unbekannter Fehler"),
      };
    }
  }

  const workingIds = prepared.map((p) => p.id);
  const minDate = prepared
    .map((p) => p.plan_date)
    .reduce((a, b) => (a < b ? a : b));

  // 3) Übersetzte Inhalte speichern
  for (const p of prepared) {
    const { error } = await supabase
      .from("meal_plans")
      .update({ meals: p.meals, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
  }

  // 4) ALLE Tage ab Wochenstart auf "replaced" setzen (räumt alte Dubletten/
  //    deutsche Reste weg) ...
  await supabase
    .from("meal_plans")
    .update({ status: "replaced", updated_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .gte("plan_date", minDate);

  // 5) ... und nur die übersetzten Zeilen wieder als "published" setzen.
  const { error: pubErr } = await supabase
    .from("meal_plans")
    .update({ status: "published", updated_at: new Date().toISOString() })
    .in("id", workingIds);
  if (pubErr) return { ok: false, error: pubErr.message };

  // 6) Anzeigesprache des Kunden passend setzen (Rahmen + Inhalt einheitlich)
  await supabase
    .from("customer_profiles")
    .update({ language: targetLang })
    .eq("customer_id", customerId);

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
