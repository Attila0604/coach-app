# AGENTS.md — Projekt- & Ökosystem-Kontext (coach-app)

> Dauerhaftes Gedächtnis für KI-Agenten und Menschen. Ein neuer Agent startet
> ohne Vorwissen — diese Datei bringt ihn auf Stand.
> PFLEGE: Bei Änderungen an Datenmodell, Auth, Routen oder Repo-Zusammenspiel
> diese Datei im selben PR aktualisieren.

## 1. Das große Ganze: drei Repos, eine Datenbank

Dieses Repo (`coach-app`) ist die **Coach-Steuerzentrale** — eine von drei
Komponenten, die sich EINE Supabase-(Postgres-)DB teilen:

- `coach-bot` (Python/FastAPI): Telegram-Bot. Onboarding + Food-Logging
  (Text/Foto via Claude), Coach-Quick-Commands. Schreibt `customers`,
  `customer_profiles`, `food_logs`, `messages`, `conversation_states`.
- `coach-app` (DIESES Repo, Next.js): Coach-Dashboard,
  KI-Trainings-/Meal-Plan-Generator (Claude), Kunden-Monitoring. Schreibt
  `training_*`, `meal_plans`, `coach_notes`, Makro-Ziele.
- `coach-customer-app` (Next.js): Kunden-PWA. Telegram-Magic-Code-Login,
  zeigt Pläne, Workout-Player. Schreibt `workout_sessions`, `workout_logs`.

> Cloud-Agenten arbeiten pro Repo: von hier ist nur `coach-app` commit-bar.
> Das vollständige, rekonstruierte DB-Schema liegt in
> `coach-customer-app/db/schema.reference.sql`.

## 2. Dieses Repo im Detail

Stack: Next.js 14 (App Router), React 18, TypeScript, Tailwind, Supabase
(`@supabase/ssr`), Anthropic Claude. Look: ink/bone/gold, Fraunces. Sprache: DE.

Auth: ECHTE Supabase-Auth (E-Mail/Passwort, `signInWithPassword` in
`app/login/actions.ts`). `middleware.ts` schützt `/coach/*` via
`supabase.auth.getUser()`. Tabelle `coaches` mit `user_id` (Auth-Link) und
`role` (`admin` sieht alle Kunden, sonst nur eigene via `coach_id`).

Routen:

- `app/login/` — Login.
- `app/coach/page.tsx` — Dashboard (Stat-Cards, heute aktiv, inaktiv, Stream).
- `app/coach/customers/page.tsx` — Kundenliste.
- `app/coach/customers/[id]/` — Detail + Unterseiten `profile` / `nutrition` /
  `training` / `activity`, plus `charts.tsx`, `actions.ts`.

lib:

- `claude.ts` — Anthropic-Wrapper (Modell-Default `claude-sonnet-4-6`).
- `coach-customer-helpers.ts` — DST-sichere Europe/Vienna-Helfer +
  `getCustomerForCoach()` (Auth + Ownership-Scoping).
- `supabase-server.ts` / `supabase-browser.ts`.
- `actions/training-plan.ts` — KI-Generator + Approval-Workflow
  (`draft` → `activate`/`discard`) + CRUD Pläne/Tage/Übungen.
- `actions/customer-profile.ts`, `types/training.ts`.
- `components/` — Editor-Werkzeugkasten (`TrainingPlanEditor`,
  `WeeklyMealPlanEditor`, `GoalsEditor`, `ProfileEditor`, `CoachNotesEditor`,
  `NutritionSetup`, ...).

Env-Variablen: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`ANTHROPIC_API_KEY` (für die KI-Generatoren).

## 3. Konventionen

- Sprache DE (UI + Commits/PRs). Branches `cursor/<name>`, Draft-PRs gegen
  `main`.
- Zeit immer Europe/Vienna-sicher (`coach-customer-helpers.ts`).
- `messages.direction` kennt in der gemeinsamen DB nur `in` und `out`.
- `meal_plans.meals[].meal_type` ist ENGLISCH (`breakfast`/`lunch`/`dinner`/
  `snack`); `food_logs.meal_type` ist DEUTSCH
  (`fruehstueck`/`mittag`/`abend`/`snack`).
- Build prüfen mit `npm run build`.

## 4. Kürzlich adressierte Punkte

- `ANTHROPIC_API_KEY` muss in `.env.example` dokumentiert sein, weil
  `lib/claude.ts` ihn braucht.
- Toter Code `direction === 'outbound'` im Dashboard wurde entfernt; die DB
  verwendet `messages.direction` nur als `in`/`out`.
