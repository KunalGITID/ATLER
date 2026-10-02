import { describe, expect, it } from 'vitest';
import { MONTHLY, parseDay, type Day } from './dates.ts';
import { paise } from './money.ts';
import type { Plan, PlanEvent } from './model.ts';
import { planView } from './plan.ts';

const d = (s: string) => parseDay(s) as Day;
const netflix: Plan = {
  id: 'n', name: 'Netflix', price: paise(19900), cycle: MONTHLY, anchor: d('2026-01-19'), categoryId: null,
  status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-19'),
};
let seq = 0;
const ev = (on: string, kind: PlanEvent['kind'], extra: object = {}) => ({ id: on + kind, planId: 'n', on: d(on), at: ++seq, kind, ...extra }) as PlanEvent;
const today = d('2026-10-18');

describe('planView', () => {
  it('history is every charge so far at the price of its day', () => {
    const v = planView(netflix, [ev('2026-07-01', 'price', { from: paise(14900), to: paise(19900) })], today);
    expect(v.history.map(r => r.amount)).toEqual([14900, 14900, 14900, 14900, 14900, 14900, 19900, 19900, 19900]);
    expect(v.paidSoFar).toBe(6 * 14900 + 3 * 19900);
    expect(v.perYear).toBe(238800);
  });

  it('countdown: 1 day left of 30, and the block turns coral within a week', () => {
    const v = planView(netflix, [], today);
    expect(v.countdown).toMatchObject({ left: 1, total: 30 });
    expect(v.soon).toBe(true);
    expect(planView(netflix, [], d('2026-10-01')).soon).toBe(false);
  });

  it('a cancelled plan has no countdown and counts what it saved', () => {
    const cancelled = { ...netflix, status: 'cancelled' as const };
    const v = planView(cancelled, [ev('2026-07-01', 'cancelled')], today);
    expect(v.countdown).toBeNull();
    expect(v.stoppedOn).toBe('2026-07-01');
    expect(v.saved).toBe(3 * 19900); // Jul 19, Aug 19, Sep 19 (Oct 19 is still ahead)
    expect(v.history.at(-1)!.on).toBe('2026-06-19');
  });

  it('a running trial counts down to the day it converts', () => {
    const trial = { ...netflix, status: 'trial' as const, createdOn: d('2026-10-04'), anchor: d('2026-10-25'), trialEnds: d('2026-10-25') };
    const v = planView(trial, [], today);
    expect(v.trial).toBe(true);
    expect(v.countdown).toMatchObject({ start: '2026-10-04', end: '2026-10-25', total: 21, left: 7 });
    expect(v.soon).toBe(true);
    expect(v.history).toEqual([]); // nothing paid during the trial
  });
});
