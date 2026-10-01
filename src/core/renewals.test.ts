import { describe, expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Plan, PlanEvent } from './model.ts';
import { priceOn, renewalsBetween } from './renewals.ts';

const d = (s: string) => parseDay(s) as Day;
const plan: Plan = {
  id: 'n', name: 'Netflix', price: paise(19900), cycle: MONTHLY, anchor: d('2026-01-19'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-19'),
};
let seq = 0;
const ev = (on: string, kind: PlanEvent['kind'], extra: object = {}) => ({ id: on + kind, planId: 'n', on: d(on), at: ++seq, kind, ...extra }) as PlanEvent;

describe('renewalsBetween', () => {
  it('lists every charge in the window', () => {
    expect(renewalsBetween(plan, [], d('2026-08-01'), d('2026-10-31')).map(r => r.on)).toEqual(['2026-08-19', '2026-09-19', '2026-10-19']);
  });

  it('charges the price in effect on each date', () => {
    const events = [ev('2026-07-01', 'price', { from: paise(14900), to: paise(19900) })];
    expect(renewalsBetween(plan, events, d('2026-05-01'), d('2026-08-31')).map(r => [r.on, r.amount]))
      .toEqual([['2026-05-19', 14900], ['2026-06-19', 14900], ['2026-07-19', 19900], ['2026-08-19', 19900]]);
    expect(priceOn(plan, events, d('2026-06-30'))).toBe(14900);
  });

  it('bills nothing while paused, and resumes billing', () => {
    const events = [ev('2026-05-01', 'paused'), ev('2026-07-25', 'resumed')];
    expect(renewalsBetween(plan, events, d('2026-04-01'), d('2026-09-30')).map(r => r.on)).toEqual(['2026-04-19', '2026-08-19', '2026-09-19']);
  });

  it('stops at cancellation; a charge on the cancel day itself stands', () => {
    expect(renewalsBetween(plan, [ev('2026-09-19', 'cancelled')], d('2026-08-01'), d('2026-12-31')).map(r => r.on)).toEqual(['2026-08-19', '2026-09-19']);
  });

  it('a trial charges from the day it ends', () => {
    const trial = { ...plan, status: 'trial' as const, trialEnds: d('2026-10-25') };
    expect(renewalsBetween(trial, [], d('2026-10-01'), d('2026-11-30')).map(r => r.on)).toEqual(['2026-10-25', '2026-11-25']);
  });

  it('several changes on one day apply in the order they were made', () => {
    // paused, resumed, then cancelled — all on the 1st. Written out of order on purpose.
    const sameDay = [
      { ...ev('2026-10-01', 'cancelled'), at: 30 },
      { ...ev('2026-10-01', 'paused'), at: 10 },
      { ...ev('2026-10-01', 'resumed'), at: 20 },
    ] as PlanEvent[];
    expect(renewalsBetween(plan, sameDay, d('2026-10-01'), d('2026-12-31'))).toEqual([]);
    // and the reverse story: cancelled, then restarted the same day -> billing continues
    const restarted = [{ ...ev('2026-10-01', 'cancelled'), at: 1 }, { ...ev('2026-10-01', 'restarted'), at: 2 }] as PlanEvent[];
    expect(renewalsBetween(plan, restarted, d('2026-10-01'), d('2026-11-30')).map(r => r.on)).toEqual(['2026-10-19', '2026-11-19']);
  });
});
