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

type WorkoutLog = {
  id: string;
  exercise_id: string;
  set_number: number;
  reps_done: number | null;
  weight_used_kg: number | null;
};

type Workout = {
  id: string;
  started_at: string;
  ended_at: string | null;
  status: string;
  total_duration_seconds: number | null;
  notes: string | null;
  training_days: {
    id: string;
    day_number: number;
    title: string;
    subtitle: string | null;
  } | null;
  workout_logs: WorkoutLog[];
};

type Filter = 'all' | 'meals' | 'messages' | 'workouts';

type ActivityItem =
  | { kind: 'meal'; id: string; timestamp: string; data: FoodLog }
  | { kind: 'message'; id: string; timestamp: string; data: Message }
  | { kind: 'workout'; id: string; timestamp: string; data: Workout };

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

const WORKOUT_STATUS_LABELS: Record<string, string> = {
  completed: 'Abgeschlossen',
  aborted: 'Abgebrochen',
  paused: 'Pausiert',
  in_progress: 'Läuft',
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return '–';
  const min = Math.floor(seconds / 60);
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function ActivityList({
  foodLogs,
  messages,
  workouts,
}: {
  foodLogs: FoodLog[];
  messages: Message[];
  workouts: Workout[];
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
      ...workouts.map((w) => ({
        kind: 'workout' as const,
        id: w.id,
        timestamp: w.started_at,
        data: w,
      })),
    ];
    items.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    return items;
  }, [foodLogs, messages, workouts]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return allItems;
    if (filter === 'meals') return allItems.filter((i) => i.kind === 'meal');
    if (filter === 'messages')
      return allItems.filter((i) => i.kind === 'message');
    if (filter === 'workouts')
      return allItems.filter((i) => i.kind === 'workout');
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
      <div className="mb-8 flex flex-wrap gap-2 rounded-3xl border border-white/[0.08] bg-black/20 p-3">
        <FilterPill
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          Alle · {allItems.length}
        </FilterPill>
        <FilterPill
          active={filter === 'workouts'}
          onClick={() => setFilter('workouts')}
        >
          Workouts · {workouts.length}
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
        <p className="rounded-3xl border border-dashed border-white/[0.1] bg-white/[0.025] p-8 text-sm italic text-bone-muted">
          Noch keine Aktivität in den letzten 30 Tagen.
        </p>
      ) : (
        <div className="space-y-10">
          {groupedByDay.map(([day, items]) => (
            <div key={day}>
              <p className="mb-4 border-b border-white/[0.06] pb-2 text-[10px] font-medium uppercase tracking-caps text-gold">
                {formatDayLabel(day)}
              </p>
              <div className="space-y-3">
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
      className={`rounded-full border px-4 py-2 text-[10px] font-medium uppercase tracking-caps transition ${
        active
          ? 'border-gold/40 bg-gold/10 text-gold'
          : 'border-white/[0.1] bg-white/[0.025] text-bone-muted hover:border-gold/25 hover:text-bone'
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
      <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-gold/20 bg-gold/10 text-base">
          🍽
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-capsTight text-gold">
            {mealLabel}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-bone">
            {meal.raw_description}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-bone-faint">
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
        <div className="shrink-0 pt-1 text-[11px] tabular-nums text-bone-faint">
          {formatTime(meal.logged_at)}
        </div>
      </div>
    );
  }

  if (item.kind === 'workout') {
    const w = item.data;
    const statusLabel = WORKOUT_STATUS_LABELS[w.status] ?? w.status;
    const day = w.training_days;
    const dayName = day
      ? `Tag ${day.day_number} · ${day.title}`
      : 'Workout';
    const setsCount = w.workout_logs.length;
    const totalVolume = w.workout_logs.reduce((sum, log) => {
      if (log.weight_used_kg != null && log.reps_done != null) {
        return sum + Number(log.weight_used_kg) * log.reps_done;
      }
      return sum;
    }, 0);

    // Status color
    const statusColor =
      w.status === 'completed'
        ? 'text-gold/80'
        : w.status === 'aborted'
        ? 'text-red-400/70'
        : 'text-bone-faint';

    return (
      <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-black/20 text-base">
          💪
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[10px] font-medium uppercase tracking-capsTight ${statusColor}`}>
            {statusLabel}
          </p>
          <p className="mt-1 text-sm font-medium leading-relaxed text-bone">
            {dayName}
          </p>
          {day?.subtitle && (
            <p className="mt-0.5 text-[11px] italic text-bone-muted">
              {day.subtitle}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-bone-faint">
            <span>{formatDuration(w.total_duration_seconds)}</span>
            <span>{setsCount} {setsCount === 1 ? 'Satz' : 'Sätze'}</span>
            {totalVolume > 0 && (
              <span>{Math.round(totalVolume)} kg Volumen</span>
            )}
          </div>
        </div>
        <div className="shrink-0 pt-1 text-[11px] tabular-nums text-bone-faint">
          {formatTime(w.started_at)}
        </div>
      </div>
    );
  }

  // Message
  const msg = item.data;
  const isOutbound = msg.direction === 'out';
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-4">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/[0.08] bg-black/20 text-base">
        💬
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-capsTight text-bone-faint">
          {isOutbound ? `${msg.agent_name ?? 'Bot'} →` : '← Kunde'}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-bone-muted">
          {msg.content}
        </p>
      </div>
      <div className="shrink-0 pt-1 text-[11px] tabular-nums text-bone-faint">
        {formatTime(msg.created_at)}
      </div>
    </div>
  );
}
