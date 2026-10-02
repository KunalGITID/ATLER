// The local database: the app reads and writes here first, so every screen is
// instant and works offline. One database per signed-in user. Sync with
// Supabase comes later and uses `updatedAt` / `deleted`.
import Dexie, { type EntityTable } from 'dexie';
import type { Category, Payment, Plan, PlanEvent } from '../core/model.ts';

// updatedAt: when this row was last edited (on any device), for last-edit-wins.
// dirty: edited on this phone and not yet sent. deleted: a tombstone.
export type Stored<T> = T & { updatedAt: number; deleted?: 1; dirty?: 1 };

export interface Meta { key: string; value: number }

export class AtlerDB extends Dexie {
  plans!: EntityTable<Stored<Plan>, 'id'>;
  payments!: EntityTable<Stored<Payment>, 'id'>;
  categories!: EntityTable<Stored<Category>, 'id'>;
  events!: EntityTable<Stored<PlanEvent>, 'id'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(userId: string) {
    super(`atler-${userId}`);
    this.version(1).stores({
      plans: 'id, status, updatedAt',
      payments: 'id, on, updatedAt',
      categories: 'id, updatedAt',
      events: 'id, planId, on, updatedAt',
    });
    this.version(2).stores({
      plans: 'id, status, updatedAt, dirty',
      payments: 'id, on, updatedAt, dirty',
      categories: 'id, updatedAt, dirty',
      events: 'id, planId, on, updatedAt, dirty',
      meta: 'key',
    });
  }
}

const open = new Map<string, AtlerDB>();
export function dbFor(userId: string): AtlerDB {
  let db = open.get(userId);
  if (!db) {
    db = new AtlerDB(userId);
    open.set(userId, db);
  }
  return db;
}

export const newId = () => crypto.randomUUID();
const live = <T extends { deleted?: 1 }>(rows: T[]) => rows.filter(r => !r.deleted);

export async function readAll(db: AtlerDB) {
  const [plans, payments, categories, events] = await Promise.all([
    db.plans.toArray(), db.payments.toArray(), db.categories.toArray(), db.events.toArray(),
  ]);
  return { plans: live(plans), payments: live(payments), categories: live(categories), events: live(events) };
}
