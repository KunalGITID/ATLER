import { describe, expect, it } from 'vitest';
import { parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { duplicatePayments, overlaps, stillUsing } from './overlap.ts';

const d = (s: string) => parseDay(s) as Day;
let n = 0;
const plan = (name: string, price: number, over: Partial<Plan> = {}): Plan => ({
  id: `p${++n}`, name, price: paise(price), cycle: { unit: 'month', every: 1 }, anchor: d('2026-01-10'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-10'), ...over,
});

describe('overlaps', () => {
  it('finds plans doing the same job', () => {
    const o = overlaps([plan('Netflix', 64900), plan('JioHotstar', 29900), plan('Spotify', 11900), plan('SonyLIV', 39900, { status: 'cancelled' })]);
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ group: 'video streaming', perMonth: 94800 });
    expect(o[0]!.plans.map(p => p.name)).toEqual(['Netflix', 'JioHotstar']);
  });
  it('spots a bundle that already includes another plan', () => {
    const o = overlaps([plan('YouTube Premium', 14900), plan('Spotify', 11900)]);
    expect(o[0]).toMatchObject({ group: 'bundle', perMonth: 11900 });
    expect(o[0]!.note).toMatch(/YouTube Music/);
  });
  it('nothing when each plan is different', () => expect(overlaps([plan('Netflix', 1), plan('Spotify', 1)])).toEqual([]));
});

describe('duplicatePayments', () => {
  const pay = (id: string, name: string, amount: number, on: string): Payment => ({ id, name, amount: paise(amount), on: d(on), categoryId: null, source: 'manual' });
  it('same name, amount and day', () => {
    const pairs = duplicatePayments([pay('a', 'Swiggy', 25000, '2026-09-30'), pay('b', 'swiggy ', 25000, '2026-09-30'), pay('c', 'Swiggy', 25000, '2026-09-29')], d('2026-10-02'));
    expect(pairs.map(([x, y]) => [x.id, y.id])).toEqual([['a', 'b']]);
  });
});

describe('stillUsing', () => {
  it('asks about subscriptions untouched for 6 months', () => {
    const gym = plan('Gym app', 49900);
    const recent = plan('Notion', 80000, { createdOn: d('2026-08-01') });
    const cheap = plan('iCloud', 7500);
    const reviewed = plan('Kindle', 16900);
    const ev: PlanEvent[] = [{ id: 'e', planId: reviewed.id, on: d('2026-09-01'), at: 1, kind: 'reviewed' }];
    const s = stillUsing([gym, recent, cheap, reviewed], ev, d('2026-10-02'));
    expect(s.map(x => x.plan.name)).toEqual(['Gym app']);
    expect(s[0]!.lastSixMonths).toBe(49900 * 6);
  });
});
