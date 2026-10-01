import { describe, expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Category, Payment, Plan } from './model.ts';
import { budgetLines } from './budgets.ts';

const d = (s: string) => parseDay(s) as Day;
const plan = (o: Partial<Plan>): Plan => ({
  id: 'p', name: 'Plan', price: paise(10000), cycle: MONTHLY, anchor: d('2026-01-05'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01'), ...o,
});
const pay = (on: string, amount: number, categoryId: string | null): Payment => ({ id: on + amount, name: 'x', amount: paise(amount), on: d(on), categoryId, source: 'manual' });
const cats: Category[] = [
  { id: 'fun', name: 'Entertainment', budget: paise(50000) },
  { id: 'food', name: 'Food', budget: paise(300000) },
  { id: 'misc', name: 'Misc', budget: null },
];

describe('budgetLines', () => {
  const lines = budgetLines(d('2026-10-18'), cats, [
    plan({ id: 'nf', categoryId: 'fun', price: paise(19900), anchor: d('2026-01-19') }),   // coming on the 19th
    plan({ id: 'sp', categoryId: 'fun', price: paise(13900), anchor: d('2026-01-07') }),   // paid on the 7th
    plan({ id: 'hs', categoryId: 'fun', price: paise(29900), anchor: d('2026-01-25') }),   // coming on the 25th
  ], [], [pay('2026-10-02', 120000, 'food'), pay('2026-10-12', 80000, 'food'), pay('2026-09-30', 999999, 'food'), pay('2026-10-03', 500, 'fun')]);

  it('splits each budget into spent, still coming and left; only categories with a budget', () => {
    expect(lines.map(l => [l.category.name, l.spent, l.coming, l.left, l.over])).toEqual([
      ['Entertainment', 13900 + 500, 19900 + 29900, 50000 - 14400 - 49800, true],
      ['Food', 200000, 0, 100000, false],
    ]);
  });
});
