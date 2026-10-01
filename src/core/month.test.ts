import { describe, expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { monthRing, monthTotal, nextUp, priceCreep, vsLastMonth } from './month.ts';

const d = (s: string) => parseDay(s) as Day;
const plan = (o: Partial<Plan>): Plan => ({
  id: 'p', name: 'Plan', price: paise(10000), cycle: MONTHLY, anchor: d('2026-01-05'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01'), ...o,
});
const pay = (on: string, amount: number): Payment => ({ id: on, name: 'x', amount: paise(amount), on: d(on), categoryId: null, source: 'manual' });
const today = d('2026-10-18');

const plans = [
  plan({ id: 'icloud', name: 'iCloud', price: paise(7500), anchor: d('2026-02-05') }),
  plan({ id: 'netflix', name: 'Netflix', price: paise(19900), anchor: d('2026-01-19') }),
  plan({ id: 'airtel', name: 'Airtel', price: paise(34900), anchor: d('2026-09-29'), cycle: { unit: 'day', every: 28 } }),
  plan({ id: 'gym', name: 'Gym', anchor: d('2026-01-10'), status: 'cancelled' }),
];
const events: PlanEvent[] = [{ id: 'g', planId: 'gym', on: d('2026-06-01'), kind: 'cancelled' }];
const payments = [pay('2026-10-12', 120000), pay('2026-09-30', 99999)];

describe('monthRing', () => {
  const ring = monthRing(today, plans, events, payments);

  it('places each renewal of the month as paid or coming, in date order; cancelled plans stop', () => {
    expect(ring.markers.map(m => [m.name, m.on, m.status])).toEqual([
      ['iCloud', '2026-10-05', 'paid'],
      ['Netflix', '2026-10-19', 'coming'],
      ['Airtel', '2026-10-27', 'coming'],
    ]);
  });

  it('the 1st is at the top; the arc runs to today', () => {
    expect(ring.markers[0]!.at).toBeCloseTo(4 / 31);
    expect(ring.elapsed).toBeCloseTo(18 / 31);
  });

  it('centre = renewals paid + expenses logged so far; side = still to come', () => {
    expect(ring.spent).toBe(7500 + 120000);
    expect(ring.toCome).toBe(19900 + 34900);
  });
});

describe('month comparisons and tiles', () => {
  it('a whole month costs its renewals plus its expenses', () => {
    // September: iCloud 5th, Netflix 19th, Airtel 29th, plus the 30th's expense
    expect(monthTotal(d('2026-09-10'), plans, events, payments)).toBe(7500 + 19900 + 34900 + 99999);
  });

  it('vs last month compares where this month is heading with all of last month', () => {
    const thisMonth = 7500 + 120000 + 19900 + 34900;
    const september = 7500 + 19900 + 34900 + 99999;
    expect(vsLastMonth(today, plans, events, payments)).toBe(thisMonth - september);
  });

  it('next up is the first charge after today', () => {
    expect(nextUp(today, plans, events)).toMatchObject({ name: 'Netflix', on: '2026-10-19', amount: 19900 });
  });

  it('price creep is the biggest recent rise on a live plan, per year', () => {
    const rises: PlanEvent[] = [
      { id: 'a', planId: 'netflix', on: d('2026-10-01'), kind: 'price', from: paise(14900), to: paise(19900) },
      { id: 'b', planId: 'icloud', on: d('2026-03-01'), kind: 'price', from: paise(5000), to: paise(7500) }, // too old
    ];
    expect(priceCreep(today, plans, rises)).toMatchObject({ plan: { name: 'Netflix' }, perYear: 60000 });
    expect(priceCreep(today, plans, [])).toBeNull();
  });
});

describe('the second number on the month block', () => {
  it('compares with last month only after a full month of tracking', async () => {
    const { canCompareWithLastMonth } = await import('./month.ts');
    const newUser = [plan({ createdOn: d('2026-10-02') })];
    expect(canCompareWithLastMonth(d('2026-10-18'), newUser, [])).toBe(false);
    const sinceSeptember = [plan({ createdOn: d('2026-09-01') })];
    expect(canCompareWithLastMonth(d('2026-10-18'), sinceSeptember, [])).toBe(true);
    // an expense logged back in August also counts as tracking
    expect(canCompareWithLastMonth(d('2026-10-18'), newUser, [pay('2026-08-20', 100)])).toBe(true);
  });

  it('otherwise shows the steady monthly cost of live plans', async () => {
    const { plansPerMonth } = await import('./month.ts');
    expect(plansPerMonth(plans)).toBe(7500 + 19900 + 37938); // gym is cancelled
  });
});
