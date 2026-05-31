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

type Plan = {
  id: string;
  plan_date: string;
  meals: Meal[];
  total_kcal: number | null;
  total_protein_g: number | null;
  total_carbs_g: number | null;
  total_fat_g: number | null;
  ai_summary: string | null;
  created_at: string;
};

type Targets = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

type Props = {
  plan: Plan;
  targets: Targets;
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function timeAgoDe(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "gerade eben";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "gestern";
  if (days < 7) return `vor ${days} Tagen`;
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function MealPlanDisplay({ plan, targets }: Props) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/20 p-5 sm:p-7">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-1">
        <h3 className="text-[9px] tracking-caps uppercase text-bone-muted font-medium">
          Aktueller Ernährungsplan
        </h3>
        <div className="flex items-baseline gap-3">
          <span className="text-[10px] uppercase tracking-caps text-gold">
            {formatDate(plan.plan_date)}
          </span>
          <span className="text-[10px] uppercase tracking-caps text-bone-faint">
            · generiert {timeAgoDe(plan.created_at)}
          </span>
        </div>
      </div>

      {plan.ai_summary && (
        <blockquote className="border-l-2 border-gold/30 pl-4 my-5">
          <p className="text-[12px] text-bone-muted italic leading-relaxed">
            {plan.ai_summary}
          </p>
        </blockquote>
      )}

      <div className="space-y-6 mb-6 pb-6 border-b border-white/[0.06]">
        {plan.meals.map((meal, idx) => (
          <div key={idx}>
            <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
              <div className="flex items-baseline gap-2 min-w-0 flex-1">
                <span className="text-base flex-shrink-0">
                  {MEAL_TYPE_EMOJIS[meal.meal_type] || "🍽️"}
                </span>
                <p className="text-[10px] uppercase tracking-caps text-gold font-medium flex-shrink-0">
                  {MEAL_TYPE_LABELS[meal.meal_type] || meal.meal_type}
                </p>
                <span className="text-sm text-bone font-serif italic truncate">
                  {meal.name}
                </span>
              </div>
              <p className="text-[11px] text-bone-muted tabular-nums whitespace-nowrap">
                {Math.round(meal.total_kcal || 0)} kcal
              </p>
            </div>

            <ul className="space-y-2 ml-7">
              {meal.items.map((item, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="text-bone min-w-0">
                    {item.food}
                    {item.grams ? (
                      <span className="text-bone-faint"> · {item.grams}g</span>
                    ) : null}
                  </span>
                  <span className="text-bone-muted tabular-nums whitespace-nowrap text-[11px] flex-shrink-0">
                    {item.kcal != null && `${Math.round(item.kcal)} kcal`}
                    {item.protein_g != null && (
                      <span className="text-bone-faint">
                        {" · "}
                        {Math.round(item.protein_g)}P
                      </span>
                    )}
                    {item.carbs_g != null && (
                      <span className="text-bone-faint">
                        /{Math.round(item.carbs_g)}C
                      </span>
                    )}
                    {item.fat_g != null && (
                      <span className="text-bone-faint">
                        /{Math.round(item.fat_g)}F
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>

            {meal.notes && (
              <p className="text-[11px] text-bone-faint italic mt-2 ml-7 leading-relaxed">
                {meal.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      <div>
        <p className="text-[9px] tracking-caps uppercase text-bone-muted font-medium mb-4">
          Gesamt vs Ziele
        </p>
        <div className="space-y-3">
          <MacroLine
            label="Kalorien"
            value={plan.total_kcal}
            target={targets.kcal}
            unit="kcal"
          />
          <MacroLine
            label="Protein"
            value={plan.total_protein_g}
            target={targets.protein}
            unit="g"
          />
          <MacroLine
            label="Carbs"
            value={plan.total_carbs_g}
            target={targets.carbs}
            unit="g"
          />
          <MacroLine
            label="Fett"
            value={plan.total_fat_g}
            target={targets.fat}
            unit="g"
          />
        </div>
      </div>
    </div>
  );
}

function MacroLine({
  label,
  value,
  target,
  unit,
}: {
  label: string;
  value: number | null;
  target: number | null;
  unit: string;
}) {
  const val = Math.round(value || 0);
  const tgt = target ? Math.round(target) : null;
  const pct = tgt && tgt > 0 ? (val / tgt) * 100 : 0;

  let status = "";
  let statusClass = "";
  if (tgt && tgt > 0) {
    if (pct >= 90 && pct <= 105) {
      status = "✓";
      statusClass = "text-gold";
    } else if (pct < 90) {
      status = "↓";
      statusClass = "text-bone-faint";
    } else {
      status = "↑";
      statusClass = "text-red-400/70";
    }
  }

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-sm text-bone-muted">{label}</span>
        <span className="text-sm text-bone font-medium tabular-nums">
          {val.toLocaleString("de-DE")}
          {tgt && (
            <span className="text-bone-faint">
              {" / "}
              {tgt.toLocaleString("de-DE")} {unit}
            </span>
          )}
          {status && (
            <span className={`ml-2 ${statusClass}`}>{status}</span>
          )}
        </span>
      </div>
      {tgt && (
        <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              pct > 105 ? "bg-red-400/40" : "bg-gold"
            }`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
