# Atler

[![CI](https://github.com/KunalGITID/ATLER/actions/workflows/ci.yml/badge.svg)](https://github.com/KunalGITID/ATLER/actions/workflows/ci.yml)

A subscription and expense tracker that installs as a PWA. Live at **[kunalgitid.github.io/ATLER](https://kunalgitid.github.io/ATLER/)**.

Add your subscriptions once and Atler logs each renewal as an expense on its billing date, warns you before the next one, and shows where the money goes each month.

## Features
- **Subscriptions** with monthly, yearly or custom-day cycles; pause, resume, categorise.
- **Automatic renewal logging.** Every renewal since the last one you saw is logged, even if you didn't open the app for months.
- **Reminders** 3 days and/or 1 day before a renewal (while the app is opened that day).
- **Expenses** logged by hand next to the automatic ones.
- **Analytics**: monthly trend, spending by category, per-category budgets, insights.
- **Import/export** as CSV or a full JSON backup.
- **Sign in** with email or Google; works offline with the last synced data.

## Stack
- Vanilla JavaScript (no framework) built with **Vite**
- **Supabase**: Postgres with row-level security on every table, and Auth
- A generated service worker for offline use (`vite.config.js`)
- **Vitest** for the billing-date and CSV logic; ESLint; GitHub Actions for CI and Pages deploys

```
src/
  main.js          UI, state and Supabase calls
  lib/dates.js     billing-cycle math (month-end clamping, leap years, backfill)
  lib/csv.js       CSV import/export
  sw.template.js   service worker; the build fills in the asset list
supabase/migrations/   schema history
test/              unit tests
```

## How renewals are calculated
A renewal date is always **start date + n cycles**, never "previous renewal + 1 cycle". The difference shows up at month-end: a plan started on 31 January renews on 28 February and then on **31 March**. Stepping from the previous date would leave it stuck on the 28th. The tests in `test/dates.test.js` cover this, leap years, and backfilling missed months, in three time zones on CI.

## Run locally
```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests
npm run lint
npm run build    # production build in dist/
```
The app talks to the hosted Supabase project. The key in `src/main.js` is the public *anon* key; row-level security policies keep each user's rows private.

## Database
Migrations live in `supabase/migrations/`. `001_baseline.sql` records the schema as it was before migrations were tracked here. Apply new ones in order from the Supabase SQL editor.

## Errors from real users
Uncaught errors, unhandled rejections and failed saves are written to `error_log` (insert-only from the app; max 20 per session, duplicates dropped). Read them in the Supabase SQL editor:
```sql
select created_at, kind, message, release, context, url
from error_log order by created_at desc limit 50;
```
