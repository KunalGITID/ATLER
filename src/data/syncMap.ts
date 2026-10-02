// How each local row maps to its Supabase table, and the merge rule.
// Pure: no network, no Dexie, so it's unit-tested.
import type { Day } from '../core/dates.ts';
import type { Paise } from '../core/money.ts';
import { CURRENCIES, type Category, type Currency, type Foreign, type Goal, type Income, type Payment, type Plan, type PlanEvent, type Split } from '../core/model.ts';
import type { Stored } from './stored.ts';

export type Remote = Record<string, unknown> & { id: string; updated_at: number; deleted: boolean; revision: number };

const base = (r: { id: string; updatedAt: number; deleted?: 1 }, userId: string) => ({
  id: r.id, user_id: userId, updated_at: r.updatedAt, deleted: r.deleted === 1,
});
const foreignTo = (f: Foreign | null | undefined) => ({ foreign_currency: f?.currency ?? null, foreign_amount: f?.amount ?? null });
const foreignFrom = (r: Remote): Foreign | null =>
  CURRENCIES.includes(r.foreign_currency as Currency) && r.foreign_amount !== null && r.foreign_amount !== undefined
    ? { currency: r.foreign_currency as Currency, amount: Number(r.foreign_amount) } : null;
const splitFrom = (raw: unknown): Split[] => (Array.isArray(raw) ? raw : [])
  .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
  .map(s => ({ who: String(s.who ?? ''), amount: Number(s.amount ?? 0) as Paise, settled: s.settled === true }));

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
      kind: p.kind ?? 'subscription', autopay: p.autopay ?? true, ends_on: p.endsOn ?? null, shared_by: p.sharedBy ?? 1, ...foreignTo(p.foreign),
    }),
    fromRemote: (r: Remote): Stored<Plan> => back(r, {
      id: r.id, name: String(r.name), price: Number(r.price) as Paise,
      cycle: { unit: r.cycle_unit as Plan['cycle']['unit'], every: Number(r.cycle_every) },
      anchor: r.anchor as Day, categoryId: (r.category_id as string | null) ?? null, status: r.status as Plan['status'],
      trialEnds: (r.trial_ends as Day | null) ?? null, remind: r.remind as Plan['remind'], createdOn: r.created_on as Day,
      kind: (r.kind as Plan['kind']) ?? 'subscription', autopay: r.autopay !== false, endsOn: (r.ends_on as Day | null) ?? null,
      sharedBy: Number(r.shared_by ?? 1), foreign: foreignFrom(r),
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
      note: p.note ?? '', tags: p.tags ?? [], split: p.split ?? [], ...foreignTo(p.foreign),
    }),
    fromRemote: (r: Remote): Stored<Payment> => back(r, {
      id: r.id, name: String(r.name), amount: Number(r.amount) as Paise, on: r.on as Day,
      categoryId: (r.category_id as string | null) ?? null, source: r.source as Payment['source'],
      note: String(r.note ?? ''), tags: Array.isArray(r.tags) ? r.tags.map(String) : [], split: splitFrom(r.split), foreign: foreignFrom(r),
    }),
  },
  categories: {
    remote: 'spend_categories',
    toRemote: (c: Stored<Category>, userId: string) => ({ ...base(c, userId), name: c.name, budget: c.budget }),
    fromRemote: (r: Remote): Stored<Category> => back(r, {
      id: r.id, name: String(r.name), budget: r.budget === null || r.budget === undefined ? null : (Number(r.budget) as Paise),
    }),
  },
  incomes: {
    remote: 'incomes',
    toRemote: (i: Stored<Income>, userId: string) => ({ ...base(i, userId), name: i.name, amount: i.amount, on: i.on, repeat: i.repeat }),
    fromRemote: (r: Remote): Stored<Income> => back(r, {
      id: r.id, name: String(r.name), amount: Number(r.amount) as Paise, on: r.on as Day, repeat: r.repeat === 'monthly' ? 'monthly' as const : 'none' as const,
    }),
  },
  goals: {
    remote: 'goals',
    toRemote: (g: Stored<Goal>, userId: string) => ({ ...base(g, userId), name: g.name, target: g.target, saved: g.saved, by_date: g.by }),
    fromRemote: (r: Remote): Stored<Goal> => back(r, {
      id: r.id, name: String(r.name), target: Number(r.target) as Paise, saved: Number(r.saved ?? 0) as Paise, by: (r.by_date as Day | null) ?? null,
    }),
  },
} as const;

// A pulled row replaces the local one unless this phone holds a newer edit
// that hasn't been sent yet (it will win on the server when it's pushed).
export function keepLocal(local: { updatedAt: number; dirty?: 1 } | undefined, remote: Remote): boolean {
  return !!local && local.dirty === 1 && local.updatedAt > Number(remote.updated_at);
}
