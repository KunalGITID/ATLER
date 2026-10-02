import { expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Payment, Plan } from './model.ts';
import { spentInMonth } from './spent.ts';

const d = (s: string) => parseDay(s) as Day;
const netflix: Plan = { id: 'n', name: 'Netflix', price: paise(19900), cycle: MONTHLY, anchor: d('2026-01-05'), categoryId: null, status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01') };
const pay = (on: string, r: number): Payment => ({ id: on + r, name: 'x', amount: paise(r * 100), on: d(on), categoryId: null, source: 'manual' });

it('a month is its expenses plus renewals, by day, newest first, only up to today', () => {
  const s = spentInMonth(d('2026-10-01'), d('2026-10-18'), [netflix], [], [pay('2026-10-05', 100), pay('2026-10-12', 50), pay('2026-10-25', 999)]);
  expect(s.days.map(x => [x.on, x.items.map(i => i.kind), x.total])).toEqual([
    ['2026-10-12', ['expense'], 5000],
    ['2026-10-05', ['expense', 'renewal'], 10000 + 19900],
  ]);
  expect(s.total).toBe(34900);
  expect(s.expenses).toBe(2);
});
