'use client';

import { useState, useMemo } from 'react';

type FoodLog = {
  id: string;
  logged_at: string;
  meal_type: string;
  raw_description: string;
  total_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

type Message = {
  id: string;
  direction: string;
  content: string;
  agent_name: string | null;
  created_at: string;
};

type Filter = 'all' | 'meals' | 'messages';

type ActivityItem =
  | { kind: 'meal'; id: string; timestamp: string; data: FoodLog }
  | { kind: 'message'; id: string; timestamp: string; data: Message };

const MEAL_TYPE_LABELS: Record<string, string> = {
  fruehstueck: 'Frühstück',
  frühstück: 'Frühstück',
  breakfast: 'Frühstück',
  mittag: 'Mittag',
  lunch: 'Mittag',
  abend: 'Abend',
  abendessen: 'Abend',
  dinner: 'Abend',
  snack: 'Snack',
  snk: 'Snack',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Vienna',
  });
}

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Vienna',
  });
}

function formatDayLabel(key: string): string {
  const today = new Date().toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Vienna',
  });
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Vienna',
  });

  if (key === today) return 'Heute';
  if (key === yesterday) return 'Gestern';

  const d = new Date(key + 'T12:00:00');
  return d.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export default function ActivityList({
  foodLogs,
  messages,
}: {
  foodLogs: FoodLog[];
  messages: Message[];
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const allItems: ActivityItem[] = useMemo(() => {
    const items: ActivityItem[] = [
      ...foodLogs.map((l) => ({
        kind: 'meal' as const,
        id: l.id,
        timestamp: l.logged_at,
        data: l,
      })),
      ...messages.map((m) => ({
        kind: 'message' as const,
        id: m.id,
        timestamp: m.created_at,
        data: m,
      })),
    ];
    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return items;
  }, [foodLogs, messages]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return allItems;
    if (filter === 'meals') return allItems.filter((i) => i.kind === 'meal');
    if (filter === 'messages')
      return allItems.filter((i) => i.kind === 'message');
    return allItems;
  }, [allItems, filter]);

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, ActivityItem[]>();
    for (const item of filteredItems) {
      const key = dayKey(item.timestamp);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  return (
    <>
      <div className="flex gap-2 mb-10 flex-wrap">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          Alle · {allItems.length}
        </FilterPill>
        <FilterPill
          active={filter === 'meals'}
          onClick={() => setFilter('meals')}
        >
          Mahlzeiten · {foodLogs.length}
        </FilterPill>
        <FilterPill
          active={filter === 'messages'}
          onClick={() => setFilter('messages')}
        >
          Nachrichten · {messages.length}
        </FilterPill>
      </div>

      {filteredItems.length === 0 ? (
        <p className="text-sm text-bone-muted italic">
          Noch keine Aktivität in den letzten 30 Tagen.
        </p>
      ) : (
        <div className="space-y-10">
          {groupedByDay.map(([day, items]) => (
            <div key={day}>
              <p className="text-[10px] tracking-caps uppercase text-bone-faint font-medium mb-4 pb-2 border-b border-white/[0.06]">
                {formatDayLabel(day)}
              </p>
              <div className="space-y-5">
                {items.map((item) => (
                  <ActivityItemRow
                    key={`${item.kind}-${item.id}`}
                    item={item}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[10px] uppercase tracking-caps font-medium px-4 py-2 border transition ${
        active
          ? 'border-gold text-gold bg-gold/5'
          : 'border-white/[0.12] text-bone-muted hover:border-white/[0.25] hover:text-bone'
      }`}
    >
      {children}
    </button>
  );
}

function ActivityItemRow({ item }: { item: ActivityItem }) {
  if (item.kind === 'meal') {
    const meal = item.data;
    const mealLabel =
      MEAL_TYPE_LABELS[(meal.meal_type ?? '').toLowerCase()] ??
      meal.meal_type ??
      'Mahlzeit';
    return (
      <div className="flex gap-4 items-start">
        <div className="text-[10px] tracking-caps uppercase text-gold/80 font-medium w-20 shrink-0 pt-1">
          🍽 {mealLabel}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-bone leading-relaxed">
            {meal.raw_description}
          </p>
          <div className="flex flex-wrap gap-x-3 text-[11px] text-bone-faint mt-1 tabular-nums">
            {meal.total_kcal != null && <span>{meal.total_kcal} kcal</span>}
            {meal.protein_g != null && (
              <span>P {Math.round(Number(meal.protein_g))}g</span>
            )}
            {meal.carbs_g != null && (
              <span>C {Math.round(Number(meal.carbs_g))}g</span>
            )}
            {meal.fat_g != null && (
              <span>F {Math.round(Number(meal.fat_g))}g</span>
            )}
          </div>
        </div>
        <div className="text-[11px] text-bone-faint tabular-nums shrink-0 pt-1">
          {formatTime(meal.logged_at)}
        </div>
      </div>
    );
  }

  const msg = item.data;
  const isOutbound =
    msg.direction === 'outbound' || msg.direction === 'out';
  return (
    <div className="flex gap-4 items-start">
      <div className="text-[10px] tracking-caps uppercase text-bone-faint font-medium w-20 shrink-0 pt-1">
        💬 {isOutbound ? `${msg.agent_name ?? 'Bot'} →` : '← Kunde'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-bone-muted leading-relaxed whitespace-pre-wrap">
          {msg.content}
        </p>
      </div>
      <div className="text-[11px] text-bone-faint tabular-nums shrink-0 pt-1">
        {formatTime(msg.created_at)}
      </div>
    </div>
  );
}
