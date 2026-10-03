# ATLER v2

[![CI](https://github.com/KunalGITID/ATLER/actions/workflows/ci.yml/badge.svg)](https://github.com/KunalGITID/ATLER/actions/workflows/ci.yml)

**Live: [kunalgitid.github.io/ATLER](https://kunalgitid.github.io/ATLER/)** · a local-first expense and subscription tracker (installable PWA).

Rebuilt from scratch. Design direction D ("Block × Orbit"), with one rule:
**every ring, dot, bar and colour must tell you something or do something.**

## Stack
React 19 + TypeScript (strict) + Vite, Tailwind v4 (tokens in `src/styles/tokens.css`),
Supabase (auth, sync, row-level security, Edge Functions for push reminders), Dexie (local-first
storage), Vitest and Playwright.

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
- Learned on the phone: a category prior and a subscription finder trained in
  [atler-ml](https://github.com/KunalGITID/atler-ml) and shipped as small JSON models, and
  unusual-spend alerts that learn your own bar from "Expected / Not expected".
- Backups: one file, optionally locked with a password (AES-GCM).

## Colours mean one thing each
lime = your money and primary actions · coral = a charge coming soon · white = where you are · greys = surfaces

```bash
npm install
npm run dev
npm test        # unit (Vitest)
npm run e2e     # end-to-end (Playwright, against a local Supabase mock)
```

## Licence
[MIT](LICENSE)
