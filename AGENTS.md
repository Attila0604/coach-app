# AGENTS.md

Kontext fuer Coding Agents, die an `coach-app` arbeiten. Diese App ist die
Coach-Seite eines Coaching-Oekosystems und teilt sich eine Supabase-Datenbank
mit `coach-bot` (Telegram-Bot, Python/FastAPI) und `coach-customer-app`
(Kunden-PWA).

## Architektur

- Next.js 14 App Router, React 18, TypeScript und Tailwind CSS.
- Supabase liefert Auth, Postgres und RLS. Es gibt in diesem Repo keine
  SQL-Migrations oder Schema-Dateien; das aktive Datenmodell muss aus Code und
  Supabase-Projektkontext abgeleitet werden.
- Server Components laden Daten direkt ueber `lib/supabase-server.ts`.
  Interaktive Formulare und Editoren liegen in Client Components unter
  `components/**`.
- Supabase Auth schuetzt `/coach/**` ueber `middleware.ts`. `app/page.tsx`
  leitet je nach Session nach `/coach` oder `/login` weiter.
- Claude-Aufrufe laufen serverseitig ueber `lib/claude.ts` und benoetigen
  `ANTHROPIC_API_KEY`.
- UI- und Fehlermeldungen sind auf Deutsch gehalten.

## Wichtige Bereiche

- `app/coach/page.tsx` - Coach-Dashboard mit Tagesstatus, inaktiven Kunden und
  Aktivitaetsstream.
- `app/coach/customers/page.tsx` - Kundenliste.
- `app/coach/customers/[id]/**` - Kunden-Hub, Profil, Ernaehrung, Training und
  Aktivitaetsverlauf.
- `app/coach/customers/[id]/actions.ts` - Server Actions fuer Ziele,
  Coach-Notizen, Foods, Settings und Meal-Plan-Workflows.
- `lib/actions/training-plan.ts` - Server Actions fuer Trainingsplaene,
  Trainingstage, Uebungen und KI-Generierung.
- `lib/coach-customer-helpers.ts` - zentrale Coach-/Customer-Guards,
  Status-Labels und Vienna-Zeitzonenhelfer.

## Datenmodell-Kontext

Die DB wird von mehreren Apps genutzt. Aenderungen an Tabellen, Spalten,
Enums oder JSON-Formaten koennen `coach-bot` und `coach-customer-app`
beeinflussen.

Aus dem Code ersichtliche Kernbeziehungen:

```text
auth.users
  -> coaches(user_id)
    -> customers(coach_id)
      -> customer_profiles(customer_id)
      -> customer_foods(customer_id, coach_id)
      -> coach_notes(customer_id, coach_id)
      -> meal_plans(customer_id, coach_id)
      -> food_logs(customer_id)
      -> messages(customer_id)
      -> training_plans(customer_id, coach_id)
        -> training_days(training_plan_id)
          -> exercises(training_day_id)
      -> workout_sessions(customer_id, training_day_id)
        -> workout_logs(workout_session_id, exercise_id)
```

Wichtige Konventionen:

- Tabellen und Spalten verwenden snake_case.
- Coach-Zugriff laeuft ueber `coaches.user_id = auth.users.id`; normale Coaches
  sehen nur `customers.coach_id = coaches.id`, Admin-Coaches koennen alle Kunden
  sehen.
- `customers.status` wird im Code vor allem als `active`, `intake`, `paused`
  oder `archived` behandelt.
- `messages.direction` kennt in der gemeinsamen DB nur `in` und `out`:
  - `in` = Kunde/Bot-User -> System
  - `out` = System/Bot/Coach -> Kunde
- Tagesgrenzen und Datumslabels sollen die Zeitzone `Europe/Vienna` verwenden.
  Keine hardcodierten UTC-Offsets einbauen.
- `meal_plans.meals` ist JSON und wird sowohl von Claude generiert als auch in
  der UI bearbeitet. Strukturierte Parser/Normalizer bevorzugen statt String-
  Manipulation.
- Trainingsplan-Statuswerte sind in `lib/types/training.ts` typisiert; bei
  DB-nahen Aenderungen diese Typen mitpflegen.

## Umgebungsvariablen

`.env.example` soll alle benoetigten Variablen enthalten:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`

Keine Service-Role-Keys oder Secrets in das Repo committen.

## Build und Verifikation

- Standard-Check: `npm run build`
- Dev-Server: `npm run dev`
- Es gibt aktuell keine automatisierten Tests im Repo. Bei Server Actions oder
  DB-Verhalten gezielt manuell pruefen und Build-Fehler ernst nehmen.

## Pflege-Hinweis

Diese Datei ist Arbeitskontext fuer zukuenftige Agents. Wenn sich Routen,
Supabase-Tabellen, gemeinsam genutzte DB-Konventionen, Env-Variablen oder
Integrationspunkte zu `coach-bot`/`coach-customer-app` aendern, diese
`AGENTS.md` im selben PR aktualisieren. Veralteter Kontext fuehrt sonst schnell
zu Cross-App-Regressions in der gemeinsamen Supabase-Datenbank.
