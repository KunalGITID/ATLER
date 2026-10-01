import { describe, expect, it } from 'vitest';
import { MONTHLY, YEARLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Plan } from './model.ts';
import { plansSummary } from './plans.ts';

const d = (s: string) => parseDay(s) as Day;
const plan = (o: Partial<Plan>): Plan => ({
  id: o.name ?? 'p', name: 'Plan', price: paise(10000), cycle: MONTHLY, anchor: d('2026-01-05'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01'), ...o,
});

describe('plansSummary', () => {
  const s = plansSummary([
    plan({ name: 'iCloud', price: paise(7500) }),
    plan({ name: 'Prime', price: paise(149900), cycle: YEARLY, anchor: d('2026-03-01') }),
    plan({ name: 'Netflix', price: paise(19900), anchor: d('2026-01-19') }),
    plan({ name: 'Gym', status: 'paused' }),
    plan({ name: 'Hotstar', status: 'cancelled' }),
  ], [], d('2026-10-18'));

  it('orders billing plans by what they cost per month, biggest first', () => {
    expect(s.billing.map(r => [r.plan.name, r.perMonth])).toEqual([['Netflix', 19900], ['Prime', 12492], ['iCloud', 7500]]);
  });

  it('shares add up to the whole; totals per month and per year', () => {
    expect(s.billing.reduce((a, r) => a + r.share, 0)).toBeCloseTo(1);
    expect(s.perMonth).toBe(19900 + 12492 + 7500);
    expect(s.perYear).toBe((19900 + 12492 + 7500) * 12);
  });

  it('knows each billing plan\'s next charge; stopped plans have none and no share', () => {
    expect(s.billing.find(r => r.plan.name === 'Prime')!.next).toBe('2027-03-01');
    expect([...s.paused, ...s.cancelled].map(r => [r.plan.name, r.next, r.share])).toEqual([['Gym', null, 0], ['Hotstar', null, 0]]);
  });
});
