"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  updateMealPlanMeals,
  publishMealPlan,
  discardMealPlanDraft,
  recalculateMealMacros,
  translateAndPublish,
} from "@/app/coach/customers/[id]/actions";

type MealItem = {
  food: string;
  grams?: number;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
};

type Meal = {
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  items: MealItem[];
  total_kcal?: number;
  total_protein_g?: number;
  total_carbs_g?: number;
  total_fat_g?: number;
  notes?: string;
};

export type Plan = {
  id: string;
  plan_date: string;
  meals: Meal[];
  total_kcal: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  ai_summary: string | null;
  status: "draft" | "published" | "replaced";
  created_at: string;
  updated_at: string | null;
};

export type Targets = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type Props = {
  customerId: string;
  plans: Plan[];
  targets: Targets;
  customerLanguage?: string;
};

const LANG_LABEL: Record<string, string> = {
  de: "Deutsch",
  it: "Italienisch",
  hu: "Ungarisch",
};

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};

const MEAL_TYPE_EMOJIS: Record<string, string> = {
  breakfast: "🌅",
  lunch: "☀️",
  dinner: "🌙",
  snack: "🍎",
};

const MEAL_TYPE_ORDER: Array<Meal["meal_type"]> = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
];

const WEEKDAY_SHORT_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(
    d.getUTCMonth() + 1
  ).padStart(2, "0")}.`;
}

function formatDateLong(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function weekdayShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return WEEKDAY_SHORT_DE[d.getUTCDay()];
}

function recalcMealTotals(meal: Meal): Meal {
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
  return {
    ...meal,
    total_kcal: Math.round(kcal),
    total_protein_g: Math.round(p),
    total_carbs_g: Math.round(c),
    total_fat_g: Math.round(f),
  };
}

function dayTotals(meals: Meal[]) {
  let kcal = 0;
  let p = 0;
  let c = 0;
  let f = 0;
  for (const m of meals) {
    for (const it of m.items || []) {
      kcal += Number(it.kcal) || 0;
      p += Number(it.protein_g) || 0;
      c += Number(it.carbs_g) || 0;
      f += Number(it.fat_g) || 0;
    }
  }
  return {
    kcal: Math.round(kcal),
    protein: Math.round(p),
    carbs: Math.round(c),
    fat: Math.round(f),
  };
}

export function WeeklyMealPlanEditor({
  customerId,
  plans,
  targets,
  customerLanguage,
}: Props) {
  const [targetLang, setTargetLang] = useState(customerLanguage ?? "de");
  const [localPlans, setLocalPlans] = useState<Plan[]>(plans);
  const [dirtyDays, setDirtyDays] = useState<Set<string>>(new Set());
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRecalcing, setIsRecalcing] = useState(false);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status: "draft" | "published" =
    plans.every((p) => p.status === "draft") ? "draft" : "published";

  const weekRange = useMemo(() => {
    if (plans.length === 0) return "";
    const first = formatDateShort(plans[0].plan_date);
    const last = formatDateShort(plans[plans.length - 1].plan_date);
    return `${first} – ${last}`;
  }, [plans]);

  const weekAverages = useMemo(() => {
    if (localPlans.length === 0)
      return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    const sums = localPlans.reduce(
      (acc, p) => {
        const t = dayTotals(p.meals);
        return {
          kcal: acc.kcal + t.kcal,
          protein: acc.protein + t.protein,
          carbs: acc.carbs + t.carbs,
          fat: acc.fat + t.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    );
    const n = localPlans.length;
    return {
      kcal: Math.round(sums.kcal / n),
      protein: Math.round(sums.protein / n),
      carbs: Math.round(sums.carbs / n),
      fat: Math.round(sums.fat / n),
    };
  }, [localPlans]);

  const aiSummary = useMemo(() => {
    return localPlans.find((p) => p.ai_summary)?.ai_summary ?? null;
  }, [localPlans]);

  const activePlan = localPlans[activeIdx];
  const busy = isPending || isRecalcing;

  function updateActivePlanMeals(updater: (meals: Meal[]) => Meal[]) {
    setLocalPlans((prev) =>
      prev.map((p, i) =>
        i === activeIdx ? { ...p, meals: updater(p.meals) } : p
      )
    );
    setDirtyDays((prev) => new Set(prev).add(activePlan.id));
    setError(null);
    setInfo(null);
  }

  function handleMealNameChange(mealIdx: number, value: string) {
    updateActivePlanMeals((meals) =>
      meals.map((m, i) => (i === mealIdx ? { ...m, name: value } : m))
    );
  }

  function handleMealTypeChange(mealIdx: number, value: Meal["meal_type"]) {
    updateActivePlanMeals((meals) =>
      meals.map((m, i) => (i === mealIdx ? { ...m, meal_type: value } : m))
    );
  }

  function handleMealNotesChange(mealIdx: number, value: string) {
    updateActivePlanMeals((meals) =>
      meals.map((m, i) =>
        i === mealIdx ? { ...m, notes: value || undefined } : m
      )
    );
  }

  function handleItemChange(
    mealIdx: number,
    itemIdx: number,
    field: keyof MealItem,
    value: string
  ) {
    updateActivePlanMeals((meals) =>
      meals.map((m, i) => {
        if (i !== mealIdx) return m;
        const newItems = m.items.map((it, j) => {
          if (j !== itemIdx) return it;
          if (field === "food") return { ...it, food: value };
          const num = value === "" ? undefined : Number(value);
          return { ...it, [field]: num };
        });
        return recalcMealTotals({ ...m, items: newItems });
      })
    );
  }

  function handleAddItem(mealIdx: number) {
    updateActivePlanMeals((meals) =>
      meals.map((m, i) =>
        i === mealIdx
          ? {
              ...m,
              items: [
                ...m.items,
                {
                  food: "",
                  grams: 100,
                  kcal: 0,
                  protein_g: 0,
                  carbs_g: 0,
                  fat_g: 0,
                },
              ],
            }
          : m
      )
    );
  }

  function handleDeleteItem(mealIdx: number, itemIdx: number) {
    updateActivePlanMeals((meals) =>
      meals.map((m, i) => {
        if (i !== mealIdx) return m;
        const newItems = m.items.filter((_, j) => j !== itemIdx);
        return recalcMealTotals({ ...m, items: newItems });
      })
    );
  }

  function handleAddMeal() {
    updateActivePlanMeals((meals) => [
      ...meals,
      {
        meal_type: "snack",
        name: "Neue Mahlzeit",
        items: [],
        total_kcal: 0,
        total_protein_g: 0,
        total_carbs_g: 0,
        total_fat_g: 0,
      },
    ]);
  }

  function handleDeleteMeal(mealIdx: number) {
    if (!confirm("Mahlzeit löschen?")) return;
    updateActivePlanMeals((meals) => meals.filter((_, i) => i !== mealIdx));
  }

  async function handleRecalcDay() {
    if (!activePlan) return;
    if (activePlan.meals.length === 0) {
      setError("Keine Mahlzeiten vorhanden.");
      return;
    }
    setError(null);
    setInfo(null);
    setIsRecalcing(true);
    try {
      const result = await recalculateMealMacros(
        customerId,
        activePlan.meals
      );
      if (result.ok) {
        setLocalPlans((prev) =>
          prev.map((p, i) =>
            i === activeIdx ? { ...p, meals: result.meals as Meal[] } : p
          )
        );
        setDirtyDays((prev) => new Set(prev).add(activePlan.id));
        setInfo("KI hat Makros aktualisiert (wird automatisch gespeichert).");
      } else {
        setError(result.error);
      }
    } finally {
      setIsRecalcing(false);
    }
  }

  // Speichert alle Tage mit ungespeicherten Änderungen. false = Fehler.
  async function flushDirtyDays(): Promise<boolean> {
    const toSave = localPlans.filter((p) => dirtyDays.has(p.id));
    for (const p of toSave) {
      const result = await updateMealPlanMeals(p.id, customerId, p.meals);
      if (!result.ok) {
        setError(result.error);
        return false;
      }
      setDirtyDays((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    }
    return true;
  }

  // Auto-Save: geänderte Tage automatisch speichern (debounced) — kein Knopf mehr.
  useEffect(() => {
    if (dirtyDays.size === 0 || busy) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      setAutoSaveState("saving");
      startTransition(async () => {
        const ok = await flushDirtyDays();
        if (ok) {
          setAutoSaveState("saved");
          setTimeout(() => setAutoSaveState("idle"), 1500);
        } else {
          setAutoSaveState("idle");
        }
      });
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirtyDays, localPlans, busy]);

  function handlePublish() {
    if (
      !confirm(
        "Plan jetzt für den Kunden freigeben? Der Kunde sieht den Plan sofort in der App."
      )
    ) {
      return;
    }
    setError(null);
    setInfo(null);
    startTransition(async () => {
      if (!(await flushDirtyDays())) return;
      const result = await publishMealPlan(customerId);
      if (result.ok) {
        setInfo("Plan freigegeben. Kunde sieht ihn jetzt in der App.");
      } else {
        setError(result.error);
      }
    });
  }

  function handleTranslate() {
    if (!targetLang) return;
    const langName = LANG_LABEL[targetLang] ?? targetLang;
    if (
      !confirm(
        `Plan nach „${langName}" übersetzen und sofort für den Kunden live setzen? Der Kunde sieht den Plan danach in dieser Sprache.`
      )
    )
      return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      if (!(await flushDirtyDays())) return;
      const result = await translateAndPublish(customerId, targetLang);
      if (result.ok) {
        setInfo(
          `Plan nach „${langName}" übersetzt und für den Kunden veröffentlicht.`
        );
      } else {
        setError(result.error);
      }
    });
  }

  function handleDiscard() {
    if (
      !confirm(
        "Plan-Entwurf verwerfen? Der Plan wird gelöscht und nicht für den Kunden sichtbar."
      )
    )
      return;
    setError(null);
    setInfo(null);
    startTransition(async () => {
      const result = await discardMealPlanDraft(customerId);
      if (!result.ok) setError(result.error);
    });
  }

  if (plans.length === 0) return null;

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5 sm:p-7">
      {/* Header */}
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-2">
        <div>
          <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-1">
            Wochenplan
          </h3>
          <p className="font-serif text-2xl text-bone leading-tight">
            {weekRange}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      {/* AI summary — COACH ONLY */}
      {aiSummary && status === "draft" && (
        <div className="mt-5 border-l-2 border-gold/40 pl-4 pr-3 py-3 bg-gold/[0.03]">
          <p className="text-[9px] tracking-caps uppercase text-gold/80 font-medium mb-2">
            KI-Hinweis · nur für den Coach
          </p>
          <p className="text-[12px] text-bone-muted leading-relaxed italic">
            {aiSummary}
          </p>
        </div>
      )}

      {/* Week averages */}
      <div className="mt-6 mb-6 pb-6 border-b border-white/[0.06]">
        <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-4">
          Wochen-Durchschnitt · pro Tag
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <AverageStat
            label="Kalorien"
            value={weekAverages.kcal}
            target={targets.kcal}
            unit="kcal"
          />
          <AverageStat
            label="Protein"
            value={weekAverages.protein}
            target={targets.protein}
            unit="g"
          />
          <AverageStat
            label="Carbs"
            value={weekAverages.carbs}
            target={targets.carbs}
            unit="g"
          />
          <AverageStat
            label="Fett"
            value={weekAverages.fat}
            target={targets.fat}
            unit="g"
          />
        </div>
      </div>

      {/* Day tab switcher */}
      <div className="flex gap-0.5 mb-6 overflow-x-auto">
        {localPlans.map((p, i) => {
          const isActive = i === activeIdx;
          const isDirty = dirtyDays.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`flex-1 min-w-[48px] text-center py-2.5 px-2 border-b-2 transition ${
                isActive
                  ? "border-gold text-gold"
                  : "border-white/[0.06] text-bone-muted hover:text-bone hover:border-white/20"
              }`}
            >
              <p
                className={`text-[9px] tracking-caps uppercase font-medium ${
                  isActive ? "text-gold" : "text-bone-muted"
                }`}
              >
                {weekdayShort(p.plan_date)}
                {isDirty && <span className="text-gold ml-0.5">●</span>}
              </p>
              <p
                className={`text-[10px] tabular-nums mt-0.5 ${
                  isActive ? "text-bone" : "text-bone-faint"
                }`}
              >
                {formatDateShort(p.plan_date)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active day */}
      {activePlan && (
        <div>
          <div className="flex items-baseline justify-between gap-4 flex-wrap mb-5">
            <p className="text-[10px] uppercase tracking-caps text-gold">
              {formatDateLong(activePlan.plan_date)}
            </p>
            <div className="text-[11px] tabular-nums text-bone-muted">
              {(() => {
                const t = dayTotals(activePlan.meals);
                return (
                  <>
                    <span className="text-bone">{t.kcal} kcal</span>
                    <span className="text-bone-faint">
                      {" · "}
                      {t.protein}P / {t.carbs}C / {t.fat}F
                    </span>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Meals */}
          <div className="space-y-5">
            {activePlan.meals.map((meal, mIdx) => (
              <MealEditor
                key={mIdx}
                meal={meal}
                onTypeChange={(v) => handleMealTypeChange(mIdx, v)}
                onNameChange={(v) => handleMealNameChange(mIdx, v)}
                onNotesChange={(v) => handleMealNotesChange(mIdx, v)}
                onItemChange={(itemIdx, field, value) =>
                  handleItemChange(mIdx, itemIdx, field, value)
                }
                onAddItem={() => handleAddItem(mIdx)}
                onDeleteItem={(itemIdx) => handleDeleteItem(mIdx, itemIdx)}
                onDelete={() => handleDeleteMeal(mIdx)}
                disabled={busy}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddMeal}
            disabled={busy}
            className="mt-5 text-[10px] uppercase tracking-caps font-medium px-4 py-2 border border-white/15 text-bone-muted hover:text-bone hover:border-white/30 transition disabled:opacity-30"
          >
            + Mahlzeit hinzufügen
          </button>

          {/* Per-day status bar (Auto-Save) */}
          <div className="mt-6 pt-5 border-t border-white/[0.06] flex items-center justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-bone-faint italic">
              {isRecalcing
                ? "⏳ KI berechnet Makros…"
                : dirtyDays.size > 0 || autoSaveState === "saving"
                ? "Speichert automatisch…"
                : autoSaveState === "saved"
                ? "✓ Gespeichert"
                : "Alle Änderungen gespeichert"}
            </div>
            <button
              type="button"
              onClick={handleRecalcDay}
              disabled={busy || activePlan.meals.length === 0}
              className="text-[10px] uppercase tracking-caps font-medium px-3 py-2 border border-white/15 text-bone-muted hover:text-gold hover:border-gold/40 transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="KI berechnet kcal/Protein/Carbs/Fett pro Item basierend auf Name + Gramm"
            >
              {isRecalcing ? "⏳ KI rechnet…" : "🔄 KI nachrechnen"}
            </button>
          </div>
        </div>
      )}

      {/* Sprache + EIN Freigeben-Knopf (richtet sich nach der Kundensprache) */}
      <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-caps text-bone-muted">
            Sprache des Kunden
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              disabled={busy}
              className="bg-black/40 border border-white/15 text-bone text-[11px] px-2.5 py-2 focus:outline-none focus:border-gold/50 disabled:opacity-30"
            >
              <option value="de">Deutsch</option>
              <option value="it">Italienisch</option>
              <option value="hu">Ungarisch</option>
            </select>
          </label>
          {status === "draft" ? (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={busy}
              className="text-[10px] uppercase tracking-caps font-medium px-4 py-2 border border-white/15 text-bone-muted hover:text-red-400 hover:border-red-400/40 transition disabled:opacity-30"
            >
              Entwurf verwerfen
            </button>
          ) : (
            <span className="text-[10px] uppercase tracking-caps text-gold/70 font-medium">
              ● Live
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={targetLang === "de" ? handlePublish : handleTranslate}
          disabled={busy}
          className="text-[11px] uppercase tracking-caps font-medium px-5 py-2.5 border border-gold text-gold bg-gold/5 hover:bg-gold/15 transition disabled:opacity-30"
        >
          {targetLang === "de"
            ? "✓ Für Kunde freigeben"
            : "🌐 Übersetzen & freigeben"}
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 italic mt-4">{error}</p>
      )}
      {info && (
        <p className="text-[11px] text-gold/80 italic mt-4">✓ {info}</p>
      )}
    </div>
  );
}

/* ============== sub-components ============== */

function StatusPill({ status }: { status: "draft" | "published" }) {
  const isDraft = status === "draft";
  return (
    <span
      className={`text-[10px] px-3 py-1.5 border tracking-caps uppercase font-medium ${
        isDraft
          ? "border-gold/40 text-gold bg-gold/[0.04]"
          : "border-bone/30 text-bone bg-white/[0.02]"
      }`}
    >
      {isDraft ? "Entwurf" : "Freigegeben"}
    </span>
  );
}

function AverageStat({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number;
  target: number | null;
  unit: string;
}) {
  const pct = target && target > 0 ? (value / target) * 100 : 0;
  let statusColor = "text-bone";
  if (target && target > 0) {
    if (pct >= 90 && pct <= 105) statusColor = "text-gold";
    else if (pct < 90) statusColor = "text-bone-faint";
    else statusColor = "text-red-400/70";
  }
  return (
    <div>
      <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-1.5">
        {label}
      </p>
      <p className={`text-2xl tabular-nums font-medium ${statusColor}`}>
        {value.toLocaleString("de-DE")}
        <span className="text-[11px] text-bone-faint ml-1">{unit}</span>
      </p>
      {target && (
        <p className="text-[10px] text-bone-faint tabular-nums mt-0.5">
          Ziel {target.toLocaleString("de-DE")} {unit}
        </p>
      )}
    </div>
  );
}

function MealEditor({
  meal,
  onTypeChange,
  onNameChange,
  onNotesChange,
  onItemChange,
  onAddItem,
  onDeleteItem,
  onDelete,
  disabled,
}: {
  meal: Meal;
  onTypeChange: (v: Meal["meal_type"]) => void;
  onNameChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  onItemChange: (itemIdx: number, field: keyof MealItem, value: string) => void;
  onAddItem: () => void;
  onDeleteItem: (itemIdx: number) => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-base">
          {MEAL_TYPE_EMOJIS[meal.meal_type] || "🍽️"}
        </span>
        <select
          value={meal.meal_type}
          onChange={(e) =>
            onTypeChange(e.target.value as Meal["meal_type"])
          }
          disabled={disabled}
          className="bg-black/30 border border-white/10 px-2 py-1 text-[10px] uppercase tracking-caps text-gold font-medium disabled:opacity-50"
        >
          {MEAL_TYPE_ORDER.map((mt) => (
            <option key={mt} value={mt}>
              {MEAL_TYPE_LABELS[mt]}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={meal.name}
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
          placeholder="Name der Mahlzeit"
          className="flex-1 min-w-[140px] bg-transparent border-b border-white/10 px-1 py-1 text-sm text-bone font-serif italic focus:outline-none focus:border-gold/50 transition disabled:opacity-50"
        />
        <span className="text-[11px] tabular-nums text-bone-muted">
          {Math.round(meal.total_kcal || 0)} kcal
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="text-[10px] uppercase tracking-caps text-bone-faint hover:text-red-400 transition disabled:opacity-30"
          title="Mahlzeit löschen"
        >
          ✕
        </button>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-[1fr_56px_56px_44px_44px_44px_20px] gap-2 text-[9px] tracking-caps uppercase text-bone-faint font-medium px-1">
          <div>Lebensmittel</div>
          <div className="text-right">g</div>
          <div className="text-right">kcal</div>
          <div className="text-right">P</div>
          <div className="text-right">C</div>
          <div className="text-right">F</div>
          <div></div>
        </div>
        {meal.items.length === 0 ? (
          <p className="text-[11px] text-bone-faint italic px-1 py-1">
            Noch keine Items.
          </p>
        ) : (
          meal.items.map((item, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_56px_56px_44px_44px_44px_20px] gap-2 items-center"
            >
              <input
                type="text"
                value={item.food}
                onChange={(e) => onItemChange(i, "food", e.target.value)}
                disabled={disabled}
                placeholder="Name"
                className="bg-black/30 border border-white/[0.06] px-2 py-1 text-[12px] text-bone focus:outline-none focus:border-gold/40 transition disabled:opacity-50"
              />
              <NumInput
                value={item.grams}
                onChange={(v) => onItemChange(i, "grams", v)}
                disabled={disabled}
              />
              <NumInput
                value={item.kcal}
                onChange={(v) => onItemChange(i, "kcal", v)}
                disabled={disabled}
              />
              <NumInput
                value={item.protein_g}
                onChange={(v) => onItemChange(i, "protein_g", v)}
                disabled={disabled}
              />
              <NumInput
                value={item.carbs_g}
                onChange={(v) => onItemChange(i, "carbs_g", v)}
                disabled={disabled}
              />
              <NumInput
                value={item.fat_g}
                onChange={(v) => onItemChange(i, "fat_g", v)}
                disabled={disabled}
              />
              <button
                type="button"
                onClick={() => onDeleteItem(i)}
                disabled={disabled}
                className="text-[10px] text-bone-faint hover:text-red-400 transition disabled:opacity-30"
                title="Item löschen"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAddItem}
        disabled={disabled}
        className="mt-3 text-[10px] uppercase tracking-caps font-medium text-bone-muted hover:text-gold transition disabled:opacity-30"
      >
        + Item
      </button>

      <input
        type="text"
        value={meal.notes || ""}
        onChange={(e) => onNotesChange(e.target.value)}
        disabled={disabled}
        placeholder="Zubereitungs-Notiz (optional)"
        className="mt-3 w-full bg-transparent border-b border-white/[0.06] px-1 py-1 text-[11px] text-bone-muted italic placeholder:text-bone-faint focus:outline-none focus:border-gold/30 transition disabled:opacity-50"
      />
    </div>
  );
}

function NumInput({
  value,
  onChange,
  disabled,
}: {
  value: number | undefined;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="bg-black/30 border border-white/[0.06] px-1.5 py-1 text-[11px] tabular-nums text-bone-muted text-right focus:outline-none focus:border-gold/40 transition disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
  );
}
