import { describe, expect, it } from 'vitest';
import { parseDay, type Day } from '../core/dates.ts';
import { paise } from '../core/money.ts';
import type { Plan, PlanEvent } from '../core/model.ts';
import type { Stored } from './db.ts';
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
    expect(tables.plans.fromRemote(asRemote(remote))).toEqual(sent);
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
