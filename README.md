# ATLER v2

Rebuilt from scratch. Design direction D ("Block × Orbit"), with one rule:
**every ring, dot, bar and colour must tell you something or do something.**

## Stack
React 19 + TypeScript (strict) + Vite, Tailwind v4 (tokens in `src/styles/tokens.css`),
Supabase (auth, sync), Dexie (local-first storage, next), Vitest.

## Layout
```
src/core/     pure logic: money in paise, calendar days, billing cycles, the month ring
src/ui/       the components every screen is built from (Block, Button, Field, Segmented)
src/screens/  screens
src/styles/   tokens (the only place colours and type are defined) and the launch screen
```

## What it does
- Plans: subscriptions, bills, rent, EMIs (with a last charge), SIPs and insurance; paid automatically
  or marked paid by hand; shared plans count your share; prices in other currencies at your rate.
- Spending: expenses with notes, tags and splits (who owes you, settle up); search and filters;
  bank SMS, bank statements (CSV/PDF), Walnut and Splitwise exports; bills scanned on the phone.
- Income and goals: what's left each month, savings rate, what to put aside to reach a goal.
- On-device insights, nothing sent anywhere: a forecast that learns your seasons and checks itself,
  budgets that warn before they're over, overlapping plans and bundles, forgotten subscriptions,
  expenses logged twice, spending patterns, last month in short, category suggestions that learn
  from your filing, and "Ask" for plain questions about your money.
- Backups: one file, optionally locked with a password (AES-GCM).

## Colours mean one thing each
lime = your money and primary actions · coral = a charge coming soon · white = where you are · greys = surfaces

```bash
npm install
npm run dev
npm test
```
