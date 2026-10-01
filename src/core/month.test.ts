import { describe, expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Payment, Plan } from './model.ts';
import { monthRing } from './month.ts';

const d = (s: string) => parseDay(s) as Day;
const plan = (o: Partial<Plan>): Plan => ({
  id: 'p', name: 'Plan', price: paise(10000), cycle: MONTHLY, anchor: d('2026-01-05'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-01'), ...o,
});
const pay = (on: string, amount: number): Payment => ({ id: on, name: 'x', amount: paise(amount), on: d(on), categoryId: null, source: 'manual', planId: null });

describe('monthRing', () => {
  const plans = [
    plan({ id: 'icloud', name: 'iCloud', price: paise(7500), anchor: d('2026-02-05') }),
    plan({ id: 'netflix', name: 'Netflix', price: paise(19900), anchor: d('2026-01-19') }),
    plan({ id: 'airtel', name: 'Airtel', price: paise(34900), anchor: d('2026-09-29'), cycle: { unit: 'day', every: 28 } }),
    plan({ id: 'gym', name: 'Gym', anchor: d('2026-01-10'), status: 'cancelled' }),
  ];
  const ring = monthRing(d('2026-10-18'), plans, [pay('2026-10-05', 7500), pay('2026-10-12', 120000), pay('2026-09-30', 99999)]);

  it('places each renewal of the month as paid or coming, in date order', () => {
    expect(ring.markers.map(m => [m.name, m.on, m.status])).toEqual([
      ['iCloud', '2026-10-05', 'paid'],
      ['Netflix', '2026-10-19', 'coming'],
      ['Airtel', '2026-10-27', 'coming'],
    ]);
  });

  it('the 1st sits at the top of the ring and the arc runs to today', () => {
    expect(ring.markers[0]!.at).toBeCloseTo(4 / 31);
    expect(ring.elapsed).toBeCloseTo(18 / 31);
  });

  it('centre = spent so far this month; side = still to come', () => {
    expect(ring.spent).toBe(127500);
    expect(ring.toCome).toBe(19900 + 34900);
  });

  it('cancelled plans are not on the ring; a trial shows only its first charge', () => {
    const trial = plan({ id: 't', name: 'Spotify', status: 'trial', anchor: d('2026-10-01'), trialEnds: d('2026-10-25') });
    expect(monthRing(d('2026-10-18'), [trial], []).markers.map(m => [m.on, m.status])).toEqual([['2026-10-25', 'coming']]);
  });
});
