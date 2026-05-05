'use client';

// ============================================================================
// Training Plan Editor V2 — Premium Dark + Gold Design
// 
// Erweiterungen ggü V1:
//   - Plan-Startdatum
//   - Wochentag-Pills + Uhrzeit pro Tag
//   - Telegram-Reminder Settings (Kunde + Coach)
//   - Tag-Duplizieren, Übung-Duplizieren, Reihenfolge ändern
// ============================================================================

import { useState, useTransition, useEffect } from 'react';
import {
  createPlan,
  updatePlan,
  deletePlan,
  addDay,
  updateDay,
  deleteDay,
  duplicateDay,
  addExercise,
  updateExercise,
  deleteExercise,
  duplicateExercise,
  moveExercise,
} from '@/lib/actions/training-plan';
import {
  formatReps,
  formatWeight,
  WEEKDAYS,
  REMINDER_OPTIONS,
} from '@/lib/types/training';
import type {
  TrainingPlan,
  TrainingDay,
  Exercise,
  WeightType,
  Weekday,
} from '@/lib/types/training';

// ----------------------------------------------------------------------------
// Inline-SVG Icons
// ----------------------------------------------------------------------------

const PlusIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const XIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const CopyIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const ArrowUpIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

const ArrowDownIcon = ({ className = 'w-3 h-3' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M19 12l-7 7-7-7" />
  </svg>
);

// ============================================================================
// Hauptkomponente
// ============================================================================

interface Props {
  customerId: string;
  plan: TrainingPlan | null;
}

export default function TrainingPlanEditor({ customerId, plan }: Props) {
  const [isPending, startTransition] = useTransition();
  const [activeDayId, setActiveDayId] = useState<string | null>(
    plan?.days?.[0]?.id ?? null
  );

  useEffect(() => {
    if (plan && activeDayId && !plan.days.find(d => d.id === activeDayId)) {
      setActiveDayId(plan.days[0]?.id ?? null);
    } else if (plan && !activeDayId && plan.days.length > 0) {
      setActiveDayId(plan.days[0].id);
    }
  }, [plan, activeDayId]);

  // ----- Empty State -----
  if (!plan) {
    return (
      <section className="bg-[#0A0A0C] rounded-2xl border border-[#1F1E1A] p-8">
        <div className="flex items-start justify-between pb-6 border-b border-[#1F1E1A]">
          <div>
            <div className="text-[11px] text-[#5C5A55] tracking-[1.8px] uppercase">
              Trainingsplan
            </div>
            <div className="text-[22px] font-medium text-[#F5F2EA] mt-1.5 leading-tight">
              Noch kein Plan
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-[14px] text-[#8E8B83] mb-6 text-center max-w-sm">
            Erstelle den ersten Trainingsplan für diesen Kunden. Du kannst danach
            Tage und Übungen beliebig anpassen.
          </p>
          <button
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await createPlan(customerId);
              })
            }
            className="bg-[#D4AF6C] text-[#1A1308] px-5 py-2.5 rounded-lg text-[12px] font-medium uppercase tracking-[0.5px] hover:bg-[#C7A862] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Plan erstellen
          </button>
        </div>
      </section>
    );
  }

  const activeDay = plan.days.find(d => d.id === activeDayId) ?? plan.days[0];

  return (
    <section className="bg-[#0A0A0C] rounded-2xl border border-[#1F1E1A] p-7 text-[#F5F2EA]">
      {/* HEADER */}
      <div className="flex items-start justify-between pb-5 border-b border-[#1F1E1A]">
        <div>
          <div className="text-[11px] text-[#5C5A55] tracking-[1.8px] uppercase">
            Trainingsplan
          </div>
          <div className="text-[22px] font-medium mt-1.5 leading-tight">
            {plan.name}
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <StatusPill status={plan.status} />
        </div>
      </div>

      {/* PLAN-SETTINGS — ZEILE 1: Name, Dauer, Aktuelle Woche */}
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3.5 mt-5">
        <Field label="Name">
          <TextInput
            initial={plan.name}
            onSave={value =>
              startTransition(async () => {
                await updatePlan(plan.id, customerId, { name: value });
              })
            }
          />
        </Field>
        <Field label="Dauer">
          <NumberInput
            initial={plan.weeks}
            min={1}
            max={52}
            suffix="Wochen"
            onSave={value =>
              startTransition(async () => {
                await updatePlan(plan.id, customerId, { weeks: value });
              })
            }
          />
        </Field>
        <Field label="Aktuelle Woche">
          <NumberInput
            initial={plan.current_week}
            min={1}
            max={plan.weeks}
            suffix={`von ${plan.weeks}`}
            onSave={value =>
              startTransition(async () => {
                await updatePlan(plan.id, customerId, { current_week: value });
              })
            }
          />
        </Field>
      </div>

      {/* PLAN-SETTINGS — ZEILE 2: Startdatum + Reminder */}
      <div className="grid grid-cols-[1fr_1.5fr] gap-3.5 mt-3.5">
        <Field label="Startdatum">
          <DateInput
            initial={plan.start_date}
            onSave={value =>
              startTransition(async () => {
                await updatePlan(plan.id, customerId, { start_date: value });
              })
            }
          />
        </Field>
        <Field label="Erinnerung">
          <SelectInput
            initial={plan.reminder_minutes_before}
            options={REMINDER_OPTIONS.map(o => ({
              value: String(o.value),
              label: o.label,
            }))}
            onSave={value =>
              startTransition(async () => {
                await updatePlan(plan.id, customerId, {
                  reminder_minutes_before: Number(value),
                });
              })
            }
          />
        </Field>
      </div>

      {/* PLAN-SETTINGS — ZEILE 3: Reminder-Toggles */}
      <div className="flex flex-wrap gap-2.5 mt-3.5">
        <ToggleChip
          label="Telegram-Reminder Kunde"
          active={plan.notify_telegram}
          onToggle={() =>
            startTransition(async () => {
              await updatePlan(plan.id, customerId, {
                notify_telegram: !plan.notify_telegram,
              });
            })
          }
        />
        <ToggleChip
          label="Telegram-Reminder Coach"
          active={plan.notify_coach_telegram}
          onToggle={() =>
            startTransition(async () => {
              await updatePlan(plan.id, customerId, {
                notify_coach_telegram: !plan.notify_coach_telegram,
              });
            })
          }
        />
      </div>

      {/* TAB-STRIP */}
      <div className="flex gap-1 mt-7 pb-0 border-b border-[#1F1E1A] overflow-x-auto">
        {plan.days.map(day => {
          const isActive = day.id === activeDay?.id;
          return (
            <button
              key={day.id}
              onClick={() => setActiveDayId(day.id)}
              className={`px-4 py-2.5 text-[12px] tracking-[1px] uppercase whitespace-nowrap -mb-px ${
                isActive
                  ? 'text-[#D4AF6C] border-b border-[#D4AF6C]'
                  : 'text-[#8E8B83] hover:text-[#F5F2EA]'
              }`}
            >
              Tag {day.day_number} · {day.title}
            </button>
          );
        })}
        <button
          onClick={() =>
            startTransition(async () => {
              const newDay = await addDay(plan.id, customerId);
              setActiveDayId(newDay.id);
            })
          }
          disabled={isPending}
          className="px-4 py-2.5 text-[12px] tracking-[1px] uppercase text-[#5C5A55] hover:text-[#D4AF6C] flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
        >
          <PlusIcon />
          Tag
        </button>
      </div>

      {/* DAY-EDITOR */}
      {activeDay && (
        <DayEditor
          key={activeDay.id}
          day={activeDay}
          customerId={customerId}
          isPending={isPending}
          startTransition={startTransition}
          onDelete={() => {
            startTransition(async () => {
              await deleteDay(activeDay.id, customerId);
              setActiveDayId(null);
            });
          }}
          onDuplicate={() => {
            startTransition(async () => {
              const newDay = await duplicateDay(activeDay.id, customerId);
              setActiveDayId(newDay.id);
            });
          }}
        />
      )}
    </section>
  );
}

// ============================================================================
// Day Editor
// ============================================================================

function DayEditor({
  day,
  customerId,
  isPending,
  startTransition,
  onDelete,
  onDuplicate,
}: {
  day: TrainingDay;
  customerId: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  return (
    <>
      {/* Tag-Titel + Untertitel */}
      <div className="grid grid-cols-[1fr_2fr] gap-3.5 mt-5">
        <Field label="Titel">
          <TextInput
            initial={day.title}
            onSave={value =>
              startTransition(async () => {
                await updateDay(day.id, customerId, { title: value });
              })
            }
          />
        </Field>
        <Field label="Untertitel">
          <TextInput
            initial={day.subtitle ?? ''}
            placeholder="z.B. Brust, Schulter, Trizeps"
            onSave={value =>
              startTransition(async () => {
                await updateDay(day.id, customerId, { subtitle: value || null });
              })
            }
          />
        </Field>
      </div>

      {/* Wochentag + Uhrzeit */}
      <div className="grid grid-cols-[2fr_1fr] gap-3.5 mt-3.5">
        <Field label="Wochentag">
          <WeekdayPills
            value={day.weekday}
            onChange={weekday =>
              startTransition(async () => {
                await updateDay(day.id, customerId, { weekday });
              })
            }
          />
        </Field>
        <Field label="Uhrzeit">
          <TimeInput
            initial={day.time_of_day}
            onSave={value =>
              startTransition(async () => {
                await updateDay(day.id, customerId, { time_of_day: value });
              })
            }
          />
        </Field>
      </div>

      {/* Übungsliste Header */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[11px] text-[#5C5A55] tracking-[1.8px] uppercase">
            Übungen · {day.exercises.length}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onDuplicate}
              disabled={isPending}
              className="text-[11px] text-[#8E8B83] hover:text-[#D4AF6C] tracking-[0.5px] disabled:opacity-50 flex items-center gap-1.5"
            >
              <CopyIcon />
              Tag duplizieren
            </button>
            <button
              onClick={() => {
                if (confirm(`Tag "${day.title}" wirklich löschen?`)) onDelete();
              }}
              disabled={isPending}
              className="text-[11px] text-[#5C5A55] hover:text-[#E74C3C] tracking-[0.5px] disabled:opacity-50"
            >
              Tag löschen
            </button>
          </div>
        </div>

        {day.exercises.length === 0 ? (
          <p className="text-[12px] text-[#5C5A55] py-4 text-center italic">
            Noch keine Übungen
          </p>
        ) : (
          <div className="space-y-1.5">
            {day.exercises.map((ex, idx) => (
              <ExerciseRow
                key={ex.id}
                exercise={ex}
                index={idx + 1}
                isFirst={idx === 0}
                isLast={idx === day.exercises.length - 1}
                customerId={customerId}
                isPending={isPending}
                startTransition={startTransition}
              />
            ))}
          </div>
        )}

        <button
          onClick={() =>
            startTransition(async () => {
              await addExercise(day.id, customerId);
            })
          }
          disabled={isPending}
          className="w-full mt-2.5 py-3 border border-dashed border-[#2C2A24] rounded-[10px] flex items-center justify-center gap-2 text-[12px] text-[#D4AF6C] tracking-[0.5px] uppercase hover:border-[#D4AF6C] disabled:opacity-50"
        >
          <PlusIcon />
          Übung hinzufügen
        </button>
      </div>
    </>
  );
}

// ============================================================================
// Exercise Row
// ============================================================================

function ExerciseRow({
  exercise,
  index,
  isFirst,
  isLast,
  customerId,
  isPending,
  startTransition,
}: {
  exercise: Exercise;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  customerId: string;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <ExerciseEditForm
        exercise={exercise}
        customerId={customerId}
        index={index}
        onClose={() => setIsEditing(false)}
        isPending={isPending}
        startTransition={startTransition}
      />
    );
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-[#131215] border border-[#1F1E1A] rounded-[10px] hover:border-[#2C2A24] group">
      {/* Move-Pfeile */}
      <div className="flex flex-col gap-0.5 -my-1">
        <button
          onClick={() =>
            startTransition(async () => {
              await moveExercise(exercise.id, customerId, 'up');
            })
          }
          disabled={isPending || isFirst}
          className="text-[#5C5A55] hover:text-[#D4AF6C] disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
          aria-label="Hoch"
        >
          <ArrowUpIcon className="w-3 h-3" />
        </button>
        <button
          onClick={() =>
            startTransition(async () => {
              await moveExercise(exercise.id, customerId, 'down');
            })
          }
          disabled={isPending || isLast}
          className="text-[#5C5A55] hover:text-[#D4AF6C] disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
          aria-label="Runter"
        >
          <ArrowDownIcon className="w-3 h-3" />
        </button>
      </div>

      <span className="text-[11px] text-[#5C5A55] w-5 tabular-nums">
        {String(index).padStart(2, '0')}
      </span>

      <span
        className="text-[13px] text-[#F5F2EA] flex-1 truncate cursor-pointer"
        onClick={() => setIsEditing(true)}
      >
        {exercise.name}
      </span>

      <span className="text-[12px] text-[#8E8B83] tabular-nums min-w-[60px]">
        {exercise.sets} × {formatReps(exercise.reps_min, exercise.reps_max)}
      </span>
      <span className="text-[12px] text-[#D4AF6C] tabular-nums min-w-[50px] text-right">
        {formatWeight(exercise.weight_kg, exercise.weight_type)}
      </span>

      {/* Action-Buttons (sichtbar bei Hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() =>
            startTransition(async () => {
              await duplicateExercise(exercise.id, customerId);
            })
          }
          disabled={isPending}
          className="text-[#5C5A55] hover:text-[#D4AF6C] disabled:opacity-50 p-1"
          aria-label="Übung duplizieren"
          title="Übung duplizieren"
        >
          <CopyIcon className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => {
            if (confirm(`Übung "${exercise.name}" löschen?`)) {
              startTransition(async () => {
                await deleteExercise(exercise.id, customerId);
              });
            }
          }}
          disabled={isPending}
          className="text-[#5C5A55] hover:text-[#E74C3C] disabled:opacity-50 p-1"
          aria-label="Übung löschen"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Exercise Edit Form
// ============================================================================

function ExerciseEditForm({
  exercise,
  customerId,
  index,
  onClose,
  isPending,
  startTransition,
}: {
  exercise: Exercise;
  customerId: string;
  index: number;
  onClose: () => void;
  isPending: boolean;
  startTransition: React.TransitionStartFunction;
}) {
  const [name, setName] = useState(exercise.name);
  const [sets, setSets] = useState(exercise.sets);
  const [repsMin, setRepsMin] = useState(exercise.reps_min);
  const [repsMax, setRepsMax] = useState<number | ''>(exercise.reps_max ?? '');
  const [weight, setWeight] = useState<number | ''>(exercise.weight_kg ?? '');
  const [weightType, setWeightType] = useState<WeightType>(exercise.weight_type);
  const [notes, setNotes] = useState(exercise.notes ?? '');
  const [restSeconds, setRestSeconds] = useState<number | ''>(exercise.rest_seconds ?? '');

  const handleSave = () => {
    startTransition(async () => {
      await updateExercise(exercise.id, customerId, {
        name: name.trim() || 'Übung',
        sets: Number(sets) || 1,
        reps_min: Number(repsMin) || 1,
        reps_max: repsMax === '' ? null : Number(repsMax),
        weight_kg: weight === '' ? null : Number(weight),
        weight_type: weightType,
        notes: notes.trim() || null,
        rest_seconds: restSeconds === '' ? null : Number(restSeconds),
      });
      onClose();
    });
  };

  return (
    <div className="p-4 bg-[#131215] border border-[#D4AF6C] rounded-[10px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-[#5C5A55] tabular-nums">
          {String(index).padStart(2, '0')}
        </span>
        <span className="text-[11px] text-[#D4AF6C] uppercase tracking-[1px]">
          Bearbeiten
        </span>
      </div>

      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2">
        <EditCell label="Übung">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2.5 py-2 text-[13px] text-[#F5F2EA] focus:border-[#D4AF6C] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Sätze">
          <input
            type="number"
            value={sets}
            onChange={e => setSets(Number(e.target.value))}
            min={1}
            max={20}
            className="w-full bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2.5 py-2 text-[13px] text-[#F5F2EA] tabular-nums focus:border-[#D4AF6C] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Reps min">
          <input
            type="number"
            value={repsMin}
            onChange={e => setRepsMin(Number(e.target.value))}
            min={1}
            className="w-full bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2.5 py-2 text-[13px] text-[#F5F2EA] tabular-nums focus:border-[#D4AF6C] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Reps max">
          <input
            type="number"
            value={repsMax}
            onChange={e => setRepsMax(e.target.value === '' ? '' : Number(e.target.value))}
            min={Number(repsMin)}
            placeholder="—"
            className="w-full bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2.5 py-2 text-[13px] text-[#F5F2EA] tabular-nums focus:border-[#D4AF6C] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Pause (s)">
          <input
            type="number"
            value={restSeconds}
            onChange={e =>
              setRestSeconds(e.target.value === '' ? '' : Number(e.target.value))
            }
            min={0}
            placeholder="—"
            className="w-full bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2.5 py-2 text-[13px] text-[#F5F2EA] tabular-nums focus:border-[#D4AF6C] focus:outline-none"
          />
        </EditCell>
      </div>

      <div className="grid grid-cols-[2fr_3fr] gap-2 mt-2">
        <EditCell label="Gewicht">
          <div className="flex gap-1.5">
            <input
              type="number"
              step="0.5"
              value={weight}
              onChange={e => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
              min={0}
              disabled={weightType !== 'kg'}
              placeholder={weightType === 'kg' ? '0' : '—'}
              className="w-full bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2.5 py-2 text-[13px] text-[#F5F2EA] tabular-nums focus:border-[#D4AF6C] focus:outline-none disabled:opacity-40"
            />
            <select
              value={weightType}
              onChange={e => setWeightType(e.target.value as WeightType)}
              className="bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2 py-2 text-[12px] text-[#F5F2EA] focus:border-[#D4AF6C] focus:outline-none"
            >
              <option value="kg">kg</option>
              <option value="body">Body</option>
              <option value="band">Band</option>
            </select>
          </div>
        </EditCell>
        <EditCell label="Notizen">
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Hinweis für den Kunden"
            className="w-full bg-[#0A0A0C] border border-[#2C2A24] rounded-md px-2.5 py-2 text-[12px] text-[#8E8B83] focus:border-[#D4AF6C] focus:outline-none"
          />
        </EditCell>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-3 py-1.5 text-[11px] text-[#8E8B83] uppercase tracking-[0.5px] hover:text-[#F5F2EA] disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-1.5 bg-[#D4AF6C] text-[#1A1308] text-[11px] font-medium uppercase tracking-[0.5px] rounded-md hover:bg-[#C7A862] disabled:opacity-50"
        >
          {isPending ? 'Speichert…' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Wiederverwendbare Bausteine
// ============================================================================

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] text-[#5C5A55] tracking-[1.5px] uppercase mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function EditCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-[#5C5A55] tracking-[1px] uppercase mb-1">
        {label}
      </div>
      {children}
    </div>
  );
}

function TextInput({
  initial,
  placeholder,
  onSave,
}: {
  initial: string;
  placeholder?: string;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={e => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initial) onSave(value);
      }}
      className="w-full bg-[#131215] border border-[#1F1E1A] rounded-lg px-3 py-2.5 text-[14px] text-[#F5F2EA] focus:border-[#D4AF6C] focus:outline-none transition-colors"
    />
  );
}

function NumberInput({
  initial,
  min,
  max,
  suffix,
  onSave,
}: {
  initial: number;
  min: number;
  max: number;
  suffix?: string;
  onSave: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex items-center bg-[#131215] border border-[#1F1E1A] rounded-lg px-3 py-2.5 focus-within:border-[#D4AF6C] transition-colors">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => setValue(Number(e.target.value))}
        onBlur={() => {
          if (value !== initial && value >= min && value <= max) onSave(value);
        }}
        className="bg-transparent text-[14px] text-[#F5F2EA] tabular-nums focus:outline-none w-12"
      />
      {suffix && (
        <span className="text-[14px] text-[#8E8B83] tabular-nums ml-1">{suffix}</span>
      )}
    </div>
  );
}

function DateInput({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (value: string | null) => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  return (
    <input
      type="date"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => {
        if (value !== (initial ?? '')) onSave(value || null);
      }}
      className="w-full bg-[#131215] border border-[#1F1E1A] rounded-lg px-3 py-2.5 text-[14px] text-[#F5F2EA] focus:border-[#D4AF6C] focus:outline-none transition-colors tabular-nums"
    />
  );
}

function TimeInput({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (value: string | null) => void;
}) {
  // DB liefert "18:00:00", Input braucht "18:00"
  const initialUI = initial ? initial.slice(0, 5) : '';
  const [value, setValue] = useState(initialUI);
  return (
    <input
      type="time"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initialUI) onSave(value || null);
      }}
      className="w-full bg-[#131215] border border-[#1F1E1A] rounded-lg px-3 py-2.5 text-[14px] text-[#F5F2EA] focus:border-[#D4AF6C] focus:outline-none transition-colors tabular-nums"
    />
  );
}

function SelectInput({
  initial,
  options,
  onSave,
}: {
  initial: string | number;
  options: { value: string; label: string }[];
  onSave: (value: string) => void;
}) {
  return (
    <select
      defaultValue={String(initial)}
      onChange={e => onSave(e.target.value)}
      className="w-full bg-[#131215] border border-[#1F1E1A] rounded-lg px-3 py-2.5 text-[14px] text-[#F5F2EA] focus:border-[#D4AF6C] focus:outline-none transition-colors"
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function WeekdayPills({
  value,
  onChange,
}: {
  value: Weekday | null;
  onChange: (value: Weekday | null) => void;
}) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAYS.map(day => {
        const isActive = value === day.value;
        return (
          <button
            key={day.value}
            onClick={() => onChange(isActive ? null : day.value)}
            className={`flex-1 py-2.5 rounded-lg text-[12px] font-medium tracking-[0.5px] uppercase transition-colors ${
              isActive
                ? 'bg-[#D4AF6C] text-[#1A1308]'
                : 'bg-[#131215] border border-[#1F1E1A] text-[#8E8B83] hover:border-[#2C2A24] hover:text-[#F5F2EA]'
            }`}
            title={day.long}
          >
            {day.short}
          </button>
        );
      })}
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] tracking-[0.5px] uppercase transition-colors ${
        active
          ? 'bg-[#D4AF6C]/10 border border-[#D4AF6C]/40 text-[#D4AF6C]'
          : 'bg-[#131215] border border-[#1F1E1A] text-[#5C5A55] hover:text-[#8E8B83]'
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? 'bg-[#D4AF6C]' : 'bg-[#3C3A35]'
        }`}
      />
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: TrainingPlan['status'] }) {
  const colors: Record<TrainingPlan['status'], { dot: string; text: string }> = {
    draft:     { dot: '#8E8B83', text: '#8E8B83' },
    active:    { dot: '#D4AF6C', text: '#D4AF6C' },
    paused:    { dot: '#E5A14C', text: '#E5A14C' },
    completed: { dot: '#5C5A55', text: '#5C5A55' },
  };
  const labels = {
    draft: 'Entwurf',
    active: 'Aktiv',
    paused: 'Pausiert',
    completed: 'Abgeschlossen',
  };
  const c = colors[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] tracking-[1px] uppercase px-2.5 py-1.5 border border-[#2C2A24] rounded-full"
      style={{ color: c.text }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: c.dot }}
      />
      {labels[status]}
    </span>
  );
}
