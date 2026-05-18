"use client";

import { useState, useTransition } from "react";
import {
  addCustomerFood,
  deleteCustomerFood,
  updateCustomerSettings,
  generateMealPlan,
} from "@/app/coach/customers/[id]/actions";

type Food = {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  is_preferred: boolean;
  sort_order: number;
  created_at: string;
};

type Settings = {
  meal_plan_frequency: "daily" | "weekly";
  ai_tips_enabled: boolean;
  meal_plan_via_telegram: boolean;
};

type Props = {
  customerId: string;
  foods: Food[];
  settings: Settings;
};

const CATEGORIES = [
  { value: "protein", label: "Protein" },
  { value: "carb", label: "Carbs" },
  { value: "vegetable", label: "Gemüse" },
  { value: "fat", label: "Fett" },
  { value: "drink", label: "Getränk" },
  { value: "other", label: "Sonstiges" },
];

const CATEGORY_LABELS: Record<string, string> = CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<string, string>
);

const CATEGORY_ORDER = [
  "protein",
  "carb",
  "vegetable",
  "fat",
  "drink",
  "other",
];

export function NutritionSetup({ customerId, foods, settings }: Props) {
  const [foodName, setFoodName] = useState("");
  const [foodCategory, setFoodCategory] = useState("");
  const [foodNotes, setFoodNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grouped: Record<string, Food[]> = {};
  for (const food of foods) {
    const cat = food.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(food);
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodName.trim()) return;
    setError(null);
    setGenSuccess(null);

    startTransition(async () => {
      const result = await addCustomerFood(
        customerId,
        foodName,
        foodCategory || null,
        foodNotes || null
      );
      if (result.ok) {
        setFoodName("");
        setFoodCategory("");
        setFoodNotes("");
      } else {
        setError(result.error);
      }
    });
  };

  const handleDelete = (foodId: string) => {
    if (!confirm("Lebensmittel wirklich löschen?")) return;
    setError(null);
    setGenSuccess(null);

    startTransition(async () => {
      const result = await deleteCustomerFood(foodId, customerId);
      if (!result.ok) setError(result.error);
    });
  };

  const handleSettingChange = (
    key: keyof Settings,
    value: string | boolean
  ) => {
    setError(null);
    setGenSuccess(null);
    const newSettings = { ...settings, [key]: value };

    startTransition(async () => {
      const result = await updateCustomerSettings(customerId, newSettings);
      if (!result.ok) setError(result.error);
    });
  };

  const handleGeneratePlan = () => {
    if (foods.length === 0) {
      setError("Bitte erst Lebensmittel hinzufügen.");
      return;
    }
    setError(null);
    setGenSuccess(null);

    startTransition(async () => {
      const result = await generateMealPlan(customerId);
      if (result.ok) {
        setGenSuccess(
          result.summary
            ? `Plan generiert. ${result.summary}`
            : "Plan erfolgreich generiert!"
        );
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="bg-ink-900 p-7">
      <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-5">
        Ernährungs-Setup
      </h3>

      {/* Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 pb-6 border-b border-white/[0.06]">
        <div className="flex flex-col gap-2">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            Plan-Frequenz
          </p>
          <select
            value={settings.meal_plan_frequency}
            onChange={(e) =>
              handleSettingChange("meal_plan_frequency", e.target.value)
            }
            disabled={isPending}
            className="bg-black/30 border border-white/10 px-3 py-1.5 text-sm text-bone disabled:opacity-50 w-full"
          >
            <option value="daily">Täglich</option>
            <option value="weekly">Wöchentlich</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            KI-Tipps
          </p>
          <Toggle
            checked={settings.ai_tips_enabled}
            onChange={(c) => handleSettingChange("ai_tips_enabled", c)}
            disabled={isPending}
            label={settings.ai_tips_enabled ? "Aktiviert" : "Deaktiviert"}
          />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
            Per Telegram
          </p>
          <Toggle
            checked={settings.meal_plan_via_telegram}
            onChange={(c) =>
              handleSettingChange("meal_plan_via_telegram", c)
            }
            disabled={isPending}
            label={settings.meal_plan_via_telegram ? "Ja" : "Nein"}
          />
        </div>
      </div>

      {/* AI Generate Button */}
      <div className="mb-6 pb-6 border-b border-white/[0.06]">
        <button
          type="button"
          onClick={handleGeneratePlan}
          disabled={isPending || foods.length === 0}
          className="w-full text-[11px] uppercase tracking-caps font-medium px-4 py-3 border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {isPending ? "⏳ KI generiert…" : "✨ Tages-Plan generieren"}
        </button>
        {genSuccess && (
          <p className="text-[11px] text-gold/80 italic mt-3 leading-relaxed">
            ✓ {genSuccess}
          </p>
        )}
      </div>

      {/* Add food form */}
      <form onSubmit={handleAdd} className="mb-5">
        <div className="flex gap-2 mb-2 flex-wrap">
          <input
            type="text"
            value={foodName}
            onChange={(e) => setFoodName(e.target.value)}
            placeholder="z.B. Hähnchenbrust"
            maxLength={100}
            disabled={isPending}
            className="flex-1 min-w-[180px] bg-black/30 border border-white/10 px-3 py-2 text-sm text-bone placeholder:text-bone-faint focus:outline-none focus:border-gold/50 transition disabled:opacity-50"
          />
          <select
            value={foodCategory}
            onChange={(e) => setFoodCategory(e.target.value)}
            disabled={isPending}
            className="bg-black/30 border border-white/10 px-3 py-2 text-sm text-bone disabled:opacity-50"
          >
            <option value="">Kategorie…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!foodName.trim() || isPending}
            className="text-[10px] uppercase tracking-caps font-medium px-4 py-2 border border-gold/40 text-gold hover:bg-gold/10 transition disabled:opacity-30"
          >
            {isPending ? "…" : "+ Hinzufügen"}
          </button>
        </div>
        <input
          type="text"
          value={foodNotes}
          onChange={(e) => setFoodNotes(e.target.value)}
          placeholder="Notiz (optional, z.B. 'nur morgens')"
          maxLength={200}
          disabled={isPending}
          className="w-full bg-black/30 border border-white/10 px-3 py-2 text-xs text-bone placeholder:text-bone-faint focus:outline-none focus:border-gold/50 transition disabled:opacity-50"
        />
      </form>

      {error && (
        <p className="text-[11px] text-red-400 italic mb-4">{error}</p>
      )}

      {/* Food list */}
      {foods.length === 0 ? (
        <p className="text-sm text-bone-faint italic">
          Noch keine Lebensmittel definiert.
        </p>
      ) : (
        <div className="space-y-5">
          {CATEGORY_ORDER.map((cat) => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;
            return (
              <div key={cat}>
                <p className="text-[9px] tracking-caps uppercase text-gold font-medium mb-2">
                  {CATEGORY_LABELS[cat] || cat} · {items.length}
                </p>
                <ul className="space-y-1">
                  {items.map((food) => (
                    <li
                      key={food.id}
                      className="flex items-baseline justify-between gap-3 py-2 border-b border-white/[0.04] last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-bone">{food.name}</p>
                        {food.notes && (
                          <p className="text-[11px] text-bone-faint italic mt-0.5">
                            {food.notes}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDelete(food.id)}
                        disabled={isPending}
                        className="text-[10px] uppercase tracking-caps text-bone-muted hover:text-red-400 transition disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-gold/60" : "bg-white/10"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-bone transition ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {label && <span className="text-xs text-bone-muted">{label}</span>}
    </div>
  );
}
