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

## Colours mean one thing each
lime = your money and primary actions · coral = a charge coming soon · white = where you are · greys = surfaces

```bash
npm install
npm run dev
npm test
```
