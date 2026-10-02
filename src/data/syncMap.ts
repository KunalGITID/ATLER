// How each local row maps to its Supabase table, and the merge rule.
// Pure: no network, no Dexie, so it's unit-tested.
import type { Day } from '../core/dates.ts';
import type { Paise } from '../core/money.ts';
import type { Category, Payment, Plan, PlanEvent } from '../core/model.ts';
import type { Stored } from './stored.ts';

export type Remote = Record<string, unknown> & { id: string; updated_at: number; deleted: boolean; revision: number };

const base = (r: { id: string; updatedAt: number; deleted?: 1 }, userId: string) => ({
  id: r.id, user_id: userId, updated_at: r.updatedAt, deleted: r.deleted === 1,
});
const back = <T,>(remote: Remote, fields: T): Stored<T> => ({
  ...fields,
  updatedAt: Number(remote.updated_at),
  ...(remote.deleted ? { deleted: 1 as const } : {}),
});

export const tables = {
  plans: {
    remote: 'plans',
    toRemote: (p: Stored<Plan>, userId: string) => ({
      ...base(p, userId), name: p.name, price: p.price, cycle_unit: p.cycle.unit, cycle_every: p.cycle.every,
      anchor: p.anchor, category_id: p.categoryId, status: p.status, trial_ends: p.trialEnds, remind: p.remind, created_on: p.createdOn,
    }),
    fromRemote: (r: Remote): Stored<Plan> => back(r, {
      id: r.id, name: String(r.name), price: Number(r.price) as Paise,
      cycle: { unit: r.cycle_unit as Plan['cycle']['unit'], every: Number(r.cycle_every) },
      anchor: r.anchor as Day, categoryId: (r.category_id as string | null) ?? null, status: r.status as Plan['status'],
      trialEnds: (r.trial_ends as Day | null) ?? null, remind: r.remind as Plan['remind'], createdOn: r.created_on as Day,
    }),
  },
  events: {
    remote: 'plan_events',
    toRemote: (e: Stored<PlanEvent>, userId: string) => ({
      ...base(e, userId), plan_id: e.planId, on: e.on, at: e.at, kind: e.kind,
      from_price: e.kind === 'price' ? e.from : null, to_price: e.kind === 'price' ? e.to : null,
    }),
    fromRemote: (r: Remote): Stored<PlanEvent> => {
      const common = { id: r.id, planId: String(r.plan_id), on: r.on as Day, at: Number(r.at) };
      return r.kind === 'price'
        ? back(r, { ...common, kind: 'price' as const, from: Number(r.from_price) as Paise, to: Number(r.to_price) as Paise })
        : back(r, { ...common, kind: r.kind as Exclude<PlanEvent['kind'], 'price'> });
    },
  },
  payments: {
    remote: 'payments',
    toRemote: (p: Stored<Payment>, userId: string) => ({
      ...base(p, userId), name: p.name, amount: p.amount, on: p.on, category_id: p.categoryId, source: p.source,
    }),
    fromRemote: (r: Remote): Stored<Payment> => back(r, {
      id: r.id, name: String(r.name), amount: Number(r.amount) as Paise, on: r.on as Day,
      categoryId: (r.category_id as string | null) ?? null, source: r.source as Payment['source'],
    }),
  },
  categories: {
    remote: 'spend_categories',
    toRemote: (c: Stored<Category>, userId: string) => ({ ...base(c, userId), name: c.name, budget: c.budget }),
    fromRemote: (r: Remote): Stored<Category> => back(r, {
      id: r.id, name: String(r.name), budget: r.budget === null || r.budget === undefined ? null : (Number(r.budget) as Paise),
    }),
  },
} as const;

// A pulled row replaces the local one unless this phone holds a newer edit
// that hasn't been sent yet (it will win on the server when it's pushed).
export function keepLocal(local: { updatedAt: number; dirty?: 1 } | undefined, remote: Remote): boolean {
  return !!local && local.dirty === 1 && local.updatedAt > Number(remote.updated_at);
}
