import { describe, expect, it } from 'vitest';
import { MONTHLY, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { yearReview } from './year.ts';

const d = (s: string) => s as Day;
const netflix: Plan = { id: 'n', name: 'Netflix', price: paise(19900), cycle: MONTHLY, anchor: d('2026-01-05'), categoryId: 'fun', status: 'active', trialEnds: null, remind: 'day-before' as Plan['remind'], createdOn: d('2026-01-05') };
const rise: PlanEvent = { id: 'e', planId: 'n', on: d('2026-07-01'), at: 1, kind: 'price', from: paise(19900), to: paise(24900) };
const pays: Payment[] = [
  { id: 'a', name: 'Laptop', amount: paise(5000000), on: d('2026-03-10'), categoryId: null, source: 'manual' },
  { id: 'b', name: 'Lunch', amount: paise(30000), on: d('2026-03-11'), categoryId: 'food', source: 'manual' },
];
const cats = [{ id: 'fun', name: 'Fun', budget: null }, { id: 'food', name: 'Food', budget: null }];

describe('yearReview', () => {
  const r = yearReview(2026, d('2026-10-02'), [netflix], [rise], pays, cats, d('2026-01-05'));
  it('counts only what has happened, month by month', () => {
    // Jan–Jun at 199, Jul–Oct at 249 (Oct 5 is after today → not yet).
    expect(r.plansTotal).toBe(6 * 19900 + 3 * 24900);
    expect(r.everydayTotal).toBe(5030000);
    expect(r.months[10]!.total).toBeNull();
    expect(r.months[2]!.total).toBe(19900 + 5030000);
    expect(r.busiest!.month).toBe('2026-03-01');
  });
  it('ranks plans and categories and finds the year’s events', () => {
    expect(r.topPlans[0]!.name).toBe('Netflix');
    expect(r.topCategories.map(c => c.name)).toEqual(['Uncategorised', 'Fun', 'Food']);
    expect(r.biggestExpense!.name).toBe('Laptop');
    expect(r.priceRises).toEqual([{ planId: 'n', name: 'Netflix', on: '2026-07-01', from: 19900, to: 24900 }]);
  });
  it('a future year is empty', () => {
    const f = yearReview(2027, d('2026-10-02'), [netflix], [], pays, cats, d('2026-01-05'));
    expect(f.total).toBe(0);
    expect(f.months.every(m => m.total === null)).toBe(true);
  });
});
