'use client';

// ============================================================================
// Training Plan Editor V2.1 — mit Duplizieren-Dialog
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
  const [duplicateTarget, setDuplicateTarget] = useState<TrainingDay | null>(null);

  if (!plan) {
    return (
      <section className="bg-[#10151D] rounded-2xl border border-[#1F2733] p-8">
        <div className="flex items-start justify-between pb-6 border-b border-[#1F2733]">
          <div>
            <div className="text-[11px] text-[#5E6B7A] tracking-[1.8px] uppercase">
              Trainingsplan
            </div>
            <div className="text-[22px] font-medium text-[#E7ECF2] mt-1.5 leading-tight">
              Noch kein Plan
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-[14px] text-[#9AA6B4] mb-6 text-center max-w-sm">
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
            className="bg-[#8FAAC6] text-[#10151D] px-5 py-2.5 rounded-lg text-[12px] font-medium uppercase tracking-[0.5px] hover:bg-[#7C98B5] disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            Plan erstellen
          </button>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="bg-[#10151D] rounded-2xl border border-[#1F2733] p-7 text-[#E7ECF2]">
        {/* HEADER */}
        <div className="flex items-start justify-between pb-5 border-b border-[#1F2733]">
          <div>
            <div className="text-[11px] text-[#5E6B7A] tracking-[1.8px] uppercase">
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

        {/* PLAN-SETTINGS */}
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

        {/* TAGE-SECTION-HEADER */}
        <div className="flex items-center justify-between mt-7 pb-3 border-b border-[#1F2733]">
          <div className="text-[11px] text-[#5E6B7A] tracking-[1.8px] uppercase">
            Tage ({plan.days.length})
          </div>
          <button
            onClick={() =>
              startTransition(async () => {
                await addDay(plan.id, customerId);
              })
            }
            disabled={isPending}
            className="px-3 py-1.5 text-[11px] tracking-[1px] uppercase text-[#8FAAC6] hover:bg-[#8FAAC6]/10 border border-[#8FAAC6]/40 rounded flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 transition-colors"
          >
            <PlusIcon />
            Tag hinzufügen
          </button>
        </div>

        {/* ALL DAYS — RENDERED AS CARDS */}
        {plan.days.length === 0 ? (
          <p className="text-[14px] text-[#5E6B7A] italic py-8 text-center">
            Noch keine Tage. Klick &ldquo;Tag hinzufügen&rdquo; um zu starten.
          </p>
        ) : (
          <div className="space-y-6 mt-6">
            {plan.days.map((day) => (
              <div
                key={day.id}
                className="border border-[#1F2733] rounded-xl p-5 bg-[#0B0F15]"
              >
                <DayEditor
                  day={day}
                  customerId={customerId}
                  isPending={isPending}
                  startTransition={startTransition}
                  onDelete={() => {
                    startTransition(async () => {
                      await deleteDay(day.id, customerId);
                    });
                  }}
                  onDuplicate={() => setDuplicateTarget(day)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DUPLIZIEREN-DIALOG */}
      {duplicateTarget && (
        <DuplicateDayDialog
          day={duplicateTarget}
          customerId={customerId}
          onClose={() => setDuplicateTarget(null)}
          onSuccess={() => {
            setDuplicateTarget(null);
          }}
        />
      )}
    </>
  );
}

// ============================================================================
// Duplicate Day Dialog (Modal)
// ============================================================================

function DuplicateDayDialog({
  day,
  customerId,
  onClose,
  onSuccess,
}: {
  day: TrainingDay;
  customerId: string;
  onClose: () => void;
  onSuccess: (newDayId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [weekday, setWeekday] = useState<Weekday | null>(day.weekday);
  const [timeOfDay, setTimeOfDay] = useState<string>(
    day.time_of_day ? day.time_of_day.slice(0, 5) : ''
  );

  const handleConfirm = () => {
    startTransition(async () => {
      const newDay = await duplicateDay(day.id, customerId, {
        weekday,
        time_of_day: timeOfDay || null,
      });
      onSuccess(newDay.id);
    });
  };

  // ESC zum Schließen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#10151D] border border-[#1F2733] rounded-2xl p-7 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="text-[11px] text-[#5E6B7A] tracking-[1.8px] uppercase">
              Tag duplizieren
            </div>
            <div className="text-[18px] font-medium text-[#E7ECF2] mt-1.5">
              {day.title}
            </div>
            {day.subtitle && (
              <div className="text-[12px] text-[#9AA6B4] mt-1">
                {day.subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#5E6B7A] hover:text-[#E7ECF2] p-1 -m-1"
            aria-label="Schließen"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Wochentag-Pills */}
        <div className="mb-4">
          <div className="text-[11px] text-[#5E6B7A] tracking-[1.5px] uppercase mb-2">
            Auf welchen Wochentag?
          </div>
          <div className="flex gap-1.5">
            {WEEKDAYS.map(d => {
              const isActive = weekday === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => setWeekday(isActive ? null : d.value)}
                  className={`flex-1 py-2.5 rounded-lg text-[12px] font-medium tracking-[0.5px] uppercase transition-colors ${
                    isActive
                      ? 'bg-[#8FAAC6] text-[#10151D]'
                      : 'bg-[#161D27] border border-[#1F2733] text-[#9AA6B4] hover:border-[#2A3543] hover:text-[#E7ECF2]'
                  }`}
                  title={d.long}
                >
                  {d.short}
                </button>
              );
            })}
          </div>
        </div>

        {/* Uhrzeit */}
        <div className="mb-6">
          <div className="text-[11px] text-[#5E6B7A] tracking-[1.5px] uppercase mb-2">
            Uhrzeit
          </div>
          <input
            type="time"
            value={timeOfDay}
            onChange={e => setTimeOfDay(e.target.value)}
            className="w-full bg-[#161D27] border border-[#1F2733] rounded-lg px-3 py-2.5 text-[14px] text-[#E7ECF2] focus:border-[#8FAAC6] focus:outline-none transition-colors tabular-nums"
          />
        </div>

        {/* Übungen-Hinweis */}
        <div className="text-[11px] text-[#5E6B7A] mb-5 flex items-center gap-2">
          <CopyIcon className="w-3 h-3" />
          {day.exercises.length} Übung{day.exercises.length !== 1 ? 'en' : ''} werden mitkopiert
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 text-[11px] text-[#9AA6B4] uppercase tracking-[0.5px] hover:text-[#E7ECF2] disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="px-5 py-2 bg-[#8FAAC6] text-[#10151D] text-[11px] font-medium uppercase tracking-[0.5px] rounded-md hover:bg-[#7C98B5] disabled:opacity-50"
          >
            {isPending ? 'Dupliziert…' : 'Duplizieren'}
          </button>
        </div>
      </div>
    </div>
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

      <div className="mt-6">
        <div className="flex items-baseline justify-between mb-3">
          <div className="text-[11px] text-[#5E6B7A] tracking-[1.8px] uppercase">
            Übungen · {day.exercises.length}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onDuplicate}
              disabled={isPending}
              className="text-[11px] text-[#9AA6B4] hover:text-[#8FAAC6] tracking-[0.5px] disabled:opacity-50 flex items-center gap-1.5"
            >
              <CopyIcon />
              Tag duplizieren
            </button>
            <button
              onClick={() => {
                if (confirm(`Tag "${day.title}" wirklich löschen?`)) onDelete();
              }}
              disabled={isPending}
              className="text-[11px] text-[#5E6B7A] hover:text-[#E74C3C] tracking-[0.5px] disabled:opacity-50"
            >
              Tag löschen
            </button>
          </div>
        </div>

        {day.exercises.length === 0 ? (
          <p className="text-[12px] text-[#5E6B7A] py-4 text-center italic">
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
          className="w-full mt-2.5 py-3 border border-dashed border-[#2A3543] rounded-[10px] flex items-center justify-center gap-2 text-[12px] text-[#8FAAC6] tracking-[0.5px] uppercase hover:border-[#8FAAC6] disabled:opacity-50"
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
    <div className="flex items-center gap-3 p-3 bg-[#161D27] border border-[#1F2733] rounded-[10px] hover:border-[#2A3543] group">
      <div className="flex flex-col gap-0.5 -my-1">
        <button
          onClick={() =>
            startTransition(async () => {
              await moveExercise(exercise.id, customerId, 'up');
            })
          }
          disabled={isPending || isFirst}
          className="text-[#5E6B7A] hover:text-[#8FAAC6] disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
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
          className="text-[#5E6B7A] hover:text-[#8FAAC6] disabled:opacity-20 disabled:cursor-not-allowed p-0.5"
          aria-label="Runter"
        >
          <ArrowDownIcon className="w-3 h-3" />
        </button>
      </div>

      <span className="text-[11px] text-[#5E6B7A] w-5 tabular-nums">
        {String(index).padStart(2, '0')}
      </span>

      <span
        className="text-[13px] text-[#E7ECF2] flex-1 truncate cursor-pointer"
        onClick={() => setIsEditing(true)}
      >
        {exercise.name}
      </span>

      <span className="text-[12px] text-[#9AA6B4] tabular-nums min-w-[60px]">
        {exercise.sets} × {formatReps(exercise.reps_min, exercise.reps_max)}
      </span>
      <span className="text-[12px] text-[#8FAAC6] tabular-nums min-w-[50px] text-right">
        {formatWeight(exercise.weight_kg, exercise.weight_type)}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() =>
            startTransition(async () => {
              await duplicateExercise(exercise.id, customerId);
            })
          }
          disabled={isPending}
          className="text-[#5E6B7A] hover:text-[#8FAAC6] disabled:opacity-50 p-1"
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
          className="text-[#5E6B7A] hover:text-[#E74C3C] disabled:opacity-50 p-1"
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
    <div className="p-4 bg-[#161D27] border border-[#8FAAC6] rounded-[10px]">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] text-[#5E6B7A] tabular-nums">
          {String(index).padStart(2, '0')}
        </span>
        <span className="text-[11px] text-[#8FAAC6] uppercase tracking-[1px]">
          Bearbeiten
        </span>
      </div>

      <div className="mb-4 rounded-xl border border-[#8FAAC6]/20 bg-[#8FAAC6]/[0.06] px-3 py-3">
        <p className="text-[11px] leading-relaxed text-[#9AA6B4]">
          <span className="font-medium text-[#8FAAC6]">Kurz erklärt:</span>{' '}
          &ldquo;Sätze&rdquo; = Durchgänge, &ldquo;Wdh.&rdquo; = Wiederholungen pro
          Satz, &ldquo;Pause&rdquo; = Erholung zwischen Sätzen. Bei Gewicht bedeutet
          <span className="text-[#E7ECF2]"> kg</span> ein frei gesetztes
          Arbeitsgewicht, <span className="text-[#E7ECF2]">Body</span>{' '}
          Körpergewicht und <span className="text-[#E7ECF2]">Band</span>{' '}
          Widerstandsband.
        </p>
      </div>

      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2">
        <EditCell label="Übung">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full bg-[#10151D] border border-[#2A3543] rounded-md px-2.5 py-2 text-[13px] text-[#E7ECF2] focus:border-[#8FAAC6] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Sätze">
          <input
            type="number"
            value={sets}
            onChange={e => setSets(Number(e.target.value))}
            min={1}
            max={20}
            className="w-full bg-[#10151D] border border-[#2A3543] rounded-md px-2.5 py-2 text-[13px] text-[#E7ECF2] tabular-nums focus:border-[#8FAAC6] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Wdh. von">
          <input
            type="number"
            value={repsMin}
            onChange={e => setRepsMin(Number(e.target.value))}
            min={1}
            className="w-full bg-[#10151D] border border-[#2A3543] rounded-md px-2.5 py-2 text-[13px] text-[#E7ECF2] tabular-nums focus:border-[#8FAAC6] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Wdh. bis">
          <input
            type="number"
            value={repsMax}
            onChange={e => setRepsMax(e.target.value === '' ? '' : Number(e.target.value))}
            min={Number(repsMin)}
            placeholder="—"
            className="w-full bg-[#10151D] border border-[#2A3543] rounded-md px-2.5 py-2 text-[13px] text-[#E7ECF2] tabular-nums focus:border-[#8FAAC6] focus:outline-none"
          />
        </EditCell>
        <EditCell label="Pause (Sek.)">
          <input
            type="number"
            value={restSeconds}
            onChange={e =>
              setRestSeconds(e.target.value === '' ? '' : Number(e.target.value))
            }
            min={0}
            placeholder="—"
            className="w-full bg-[#10151D] border border-[#2A3543] rounded-md px-2.5 py-2 text-[13px] text-[#E7ECF2] tabular-nums focus:border-[#8FAAC6] focus:outline-none"
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
              className="w-full bg-[#10151D] border border-[#2A3543] rounded-md px-2.5 py-2 text-[13px] text-[#E7ECF2] tabular-nums focus:border-[#8FAAC6] focus:outline-none disabled:opacity-40"
            />
            <select
              value={weightType}
              onChange={e => setWeightType(e.target.value as WeightType)}
              className="bg-[#10151D] border border-[#2A3543] rounded-md px-2 py-2 text-[12px] text-[#E7ECF2] focus:border-[#8FAAC6] focus:outline-none"
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
            className="w-full bg-[#10151D] border border-[#2A3543] rounded-md px-2.5 py-2 text-[12px] text-[#9AA6B4] focus:border-[#8FAAC6] focus:outline-none"
          />
        </EditCell>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onClose}
          disabled={isPending}
          className="px-3 py-1.5 text-[11px] text-[#9AA6B4] uppercase tracking-[0.5px] hover:text-[#E7ECF2] disabled:opacity-50"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-1.5 bg-[#8FAAC6] text-[#10151D] text-[11px] font-medium uppercase tracking-[0.5px] rounded-md hover:bg-[#7C98B5] disabled:opacity-50"
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
      <div className="text-[11px] text-[#5E6B7A] tracking-[1.5px] uppercase mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function EditCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] text-[#5E6B7A] tracking-[1px] uppercase mb-1">
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
  onSave: (value: string) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function handleBlur() {
    if (value !== initial) {
      setSaveState('saving');
      await onSave(value);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    }
  }

  return (
    <div className="relative">
      <input
        value={value}
        placeholder={placeholder}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        className="w-full bg-[#161D27] border border-[#1F2733] rounded-lg px-3 py-2.5 pr-10 text-[14px] text-[#E7ECF2] focus:border-[#8FAAC6] focus:outline-none transition-colors"
      />
      {saveState === 'saving' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#9AA6B4]">…</span>
      )}
      {saveState === 'saved' && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8FAAC6]">✓</span>
      )}
    </div>
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
  onSave: (value: number) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function handleBlur() {
    if (value !== initial && value >= min && value <= max) {
      setSaveState('saving');
      await onSave(value);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    }
  }

  return (
    <div className="flex items-center bg-[#161D27] border border-[#1F2733] rounded-lg px-3 py-2.5 focus-within:border-[#8FAAC6] transition-colors">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={e => setValue(Number(e.target.value))}
        onBlur={handleBlur}
        className="bg-transparent text-[14px] text-[#E7ECF2] tabular-nums focus:outline-none w-12"
      />
      {suffix && (
        <span className="text-[14px] text-[#9AA6B4] tabular-nums ml-1">{suffix}</span>
      )}
      {saveState === 'saving' && (
        <span className="text-[10px] text-[#9AA6B4] ml-2">…</span>
      )}
      {saveState === 'saved' && (
        <span className="text-[12px] text-[#8FAAC6] ml-2">✓</span>
      )}
    </div>
  );
}

function DateInput({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (value: string | null) => void | Promise<void>;
}) {
  const [value, setValue] = useState(initial ?? '');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function handleBlur() {
    if (value !== (initial ?? '')) {
      setSaveState('saving');
      await onSave(value || null);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    }
  }

  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        className="w-full bg-[#161D27] border border-[#1F2733] rounded-lg px-3 py-2.5 pr-10 text-[14px] text-[#E7ECF2] focus:border-[#8FAAC6] focus:outline-none transition-colors tabular-nums"
      />
      {saveState === 'saving' && (
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] text-[#9AA6B4]">…</span>
      )}
      {saveState === 'saved' && (
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[12px] text-[#8FAAC6]">✓</span>
      )}
    </div>
  );
}

function TimeInput({
  initial,
  onSave,
}: {
  initial: string | null;
  onSave: (value: string | null) => void | Promise<void>;
}) {
  const initialUI = initial ? initial.slice(0, 5) : '';
  const [value, setValue] = useState(initialUI);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  async function handleBlur() {
    if (value !== initialUI) {
      setSaveState('saving');
      await onSave(value || null);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 1500);
    }
  }

  return (
    <div className="relative">
      <input
        type="time"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleBlur}
        className="w-full bg-[#161D27] border border-[#1F2733] rounded-lg px-3 py-2.5 pr-10 text-[14px] text-[#E7ECF2] focus:border-[#8FAAC6] focus:outline-none transition-colors tabular-nums"
      />
      {saveState === 'saving' && (
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[10px] text-[#9AA6B4]">…</span>
      )}
      {saveState === 'saved' && (
        <span className="absolute right-10 top-1/2 -translate-y-1/2 text-[12px] text-[#8FAAC6]">✓</span>
      )}
    </div>
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
      className="w-full bg-[#161D27] border border-[#1F2733] rounded-lg px-3 py-2.5 text-[14px] text-[#E7ECF2] focus:border-[#8FAAC6] focus:outline-none transition-colors"
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
                ? 'bg-[#8FAAC6] text-[#10151D]'
                : 'bg-[#161D27] border border-[#1F2733] text-[#9AA6B4] hover:border-[#2A3543] hover:text-[#E7ECF2]'
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
          ? 'bg-[#8FAAC6]/10 border border-[#8FAAC6]/40 text-[#8FAAC6]'
          : 'bg-[#161D27] border border-[#1F2733] text-[#5E6B7A] hover:text-[#9AA6B4]'
      }`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${
          active ? 'bg-[#8FAAC6]' : 'bg-[#323D4B]'
        }`}
      />
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: TrainingPlan['status'] }) {
  const colors: Record<TrainingPlan['status'], { dot: string; text: string }> = {
    draft:     { dot: '#9AA6B4', text: '#9AA6B4' },
    active:    { dot: '#8FAAC6', text: '#8FAAC6' },
    paused:    { dot: '#E5A14C', text: '#E5A14C' },
    completed: { dot: '#5E6B7A', text: '#5E6B7A' },
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
      className="inline-flex items-center gap-1.5 text-[11px] tracking-[1px] uppercase px-2.5 py-1.5 border border-[#2A3543] rounded-full"
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
