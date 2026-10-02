import { describe, expect, it } from 'vitest';
import { parseDay, type Day } from '../core/dates.ts';
import { paise } from '../core/money.ts';
import type { Goal, Income, Payment, Plan, PlanEvent } from '../core/model.ts';
import type { Stored } from './stored.ts';
import { keepLocal, tables, type Remote } from './syncMap.ts';

const d = (s: string) => parseDay(s) as Day;
const asRemote = (row: Record<string, unknown>, revision = 1) => ({ ...row, revision }) as Remote;

describe('row mapping round-trips', () => {
  it('plans', () => {
    const plan: Stored<Plan> = {
      id: 'a', name: 'Airtel', price: paise(34900), cycle: { unit: 'day', every: 28 }, anchor: d('2026-09-29'), categoryId: 'c1',
      status: 'trial', trialEnds: d('2026-10-20'), remind: 'both', createdOn: d('2026-09-29'), updatedAt: 1700, dirty: 1,
    };
    const remote = tables.plans.toRemote(plan, 'u1');
    expect(remote).toMatchObject({ user_id: 'u1', cycle_unit: 'day', cycle_every: 28, deleted: false, updated_at: 1700 });
    const { dirty, ...sent } = plan;
    expect(dirty).toBe(1);
    // Rows from before bills/sharing existed come back with the defaults.
    expect(tables.plans.fromRemote(asRemote(remote))).toEqual({ ...sent, kind: 'subscription', autopay: true, endsOn: null, sharedBy: 1, foreign: null });
  });

  it('plans: bills, EMIs, sharing and a foreign price', () => {
    const emi: Stored<Plan> = {
      id: 'b', name: 'Car EMI', price: paise(1250000), cycle: { unit: 'month', every: 1 }, anchor: d('2026-01-05'), categoryId: null,
      status: 'active', trialEnds: null, remind: 'off', createdOn: d('2026-01-05'), updatedAt: 2,
      kind: 'emi', autopay: false, endsOn: d('2028-12-05'), sharedBy: 2, foreign: { currency: 'USD', amount: 2000 },
    };
    const remote = tables.plans.toRemote(emi, 'u');
    expect(remote).toMatchObject({ kind: 'emi', autopay: false, ends_on: '2028-12-05', shared_by: 2, foreign_currency: 'USD', foreign_amount: 2000 });
    expect(tables.plans.fromRemote(asRemote(remote))).toEqual(emi);
  });

  it('payments keep notes, tags, splits and a foreign amount', () => {
    const p: Stored<Payment> = {
      id: 'p', name: 'Dinner', amount: paise(240000), on: d('2026-10-01'), categoryId: null, source: 'manual', updatedAt: 4,
      note: 'Birthday', tags: ['friends', 'goa'], split: [{ who: 'Asha', amount: paise(80000), settled: false }], foreign: null,
    };
    expect(tables.payments.fromRemote(asRemote(tables.payments.toRemote(p, 'u')))).toEqual(p);
    // An older row without the new columns.
    expect(tables.payments.fromRemote(asRemote({ id: 'q', name: 'Tea', amount: 2000, on: '2026-10-01', category_id: null, source: 'sms', updated_at: 1, deleted: false })))
      .toMatchObject({ note: '', tags: [], split: [], foreign: null });
  });

  it('incomes and goals', () => {
    const i: Stored<Income> = { id: 'i', name: 'Salary', amount: paise(8000000), on: d('2026-10-01'), repeat: 'monthly', updatedAt: 1 };
    expect(tables.incomes.fromRemote(asRemote(tables.incomes.toRemote(i, 'u')))).toEqual(i);
    const g: Stored<Goal> = { id: 'g', name: 'Laptop', target: paise(9000000), saved: paise(1500000), by: d('2027-03-01'), updatedAt: 1 };
    const r = tables.goals.toRemote(g, 'u');
    expect(r.by_date).toBe('2027-03-01');
    expect(tables.goals.fromRemote(asRemote(r))).toEqual(g);
  });

  it('price events keep from/to; other events have none', () => {
    const price: Stored<PlanEvent> = { id: 'e', planId: 'a', on: d('2026-10-01'), at: 5, kind: 'price', from: paise(14900), to: paise(19900), updatedAt: 9 };
    expect(tables.events.fromRemote(asRemote(tables.events.toRemote(price, 'u')))).toEqual(price);
    const paused: Stored<PlanEvent> = { id: 'f', planId: 'a', on: d('2026-10-01'), at: 6, kind: 'paused', updatedAt: 9 };
    const r = tables.events.toRemote(paused, 'u');
    expect([r.from_price, r.to_price]).toEqual([null, null]);
    expect(tables.events.fromRemote(asRemote(r))).toEqual(paused);
  });

  it('tombstones travel both ways', () => {
    const r = tables.categories.toRemote({ id: 'c', name: 'Food', budget: null, updatedAt: 3, deleted: 1 }, 'u');
    expect(r.deleted).toBe(true);
    expect(tables.categories.fromRemote(asRemote(r))).toEqual({ id: 'c', name: 'Food', budget: null, updatedAt: 3, deleted: 1 });
  });
});

describe('keepLocal (merge rule)', () => {
  const remote = asRemote({ id: 'x', updated_at: 100, deleted: false });
  it('an unsent newer local edit stays; anything else takes the server copy', () => {
    expect(keepLocal({ updatedAt: 200, dirty: 1 }, remote)).toBe(true);
    expect(keepLocal({ updatedAt: 50, dirty: 1 }, remote)).toBe(false);
    expect(keepLocal({ updatedAt: 200 }, remote)).toBe(false); // already sent: server is truth
    expect(keepLocal(undefined, remote)).toBe(false);
  });
});
