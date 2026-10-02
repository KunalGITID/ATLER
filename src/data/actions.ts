// Every change the app makes goes through here.
import type { Cycle, Day } from '../core/dates.ts';
import type { Paise } from '../core/money.ts';
import type { Payment, Plan } from '../core/model.ts';
import { addCategory } from './categoryActions.ts';
import { newId, type AtlerDB } from './db.ts';
import { touched } from './touch.ts';

export interface NewPlan {
  name: string;
  price: Paise;
  cycle: Cycle;
  lastCharged: Day; // the most recent charge; every renewal is counted from it
  today: Day;
  categoryId?: string | null;
  trialEnds?: Day | null;    // a free trial: nothing is charged until this day
}

export async function addPlan(db: AtlerDB, input: NewPlan): Promise<Plan> {
  // A past date is the last charge; a future one is the first. Either way
  // every renewal is counted from it.
  const anchor = input.trialEnds ?? input.lastCharged;
  const plan: Plan = {
    id: newId(),
    name: input.name.trim(),
    price: input.price,
    cycle: input.cycle,
    anchor,
    categoryId: input.categoryId ?? null,
    status: input.trialEnds ? 'trial' : 'active',
    trialEnds: input.trialEnds ?? null,
    remind: 'off',
    createdOn: input.today,
  };
  await db.plans.add({ ...plan, ...touched() });
  return plan;
}

export async function addPayment(db: AtlerDB, input: { name: string; amount: Paise; on: Day; categoryId?: string | null }): Promise<Payment> {
  const payment: Payment = { id: newId(), name: input.name.trim(), amount: input.amount, on: input.on, categoryId: input.categoryId ?? null, source: 'manual' };
  await db.payments.add({ ...payment, ...touched() });
  return payment;
}

// The category id to save: an existing one, none, or a new one created now.
export async function resolveCategory(db: AtlerDB, picked: string, newName: string): Promise<string | null> {
  if (picked === '__new__') {
    if (!newName.trim()) return null;
    return (await addCategory(db, newName)).id;
  }
  return picked || null;
}

export async function updatePayment(db: AtlerDB, id: string, changes: { name: string; amount: Paise; on: Day; categoryId: string | null }) {
  await db.payments.update(id, { ...changes, name: changes.name.trim(), ...touched() });
}

// Soft delete with undo: the tombstone syncs, and undo clears it again.
export async function deletePayment(db: AtlerDB, id: string) {
  await db.payments.update(id, { deleted: 1, ...touched() });
}
export async function restorePayment(db: AtlerDB, id: string) {
  await db.payments.where('id').equals(id).modify(r => { delete r.deleted; Object.assign(r, touched()); });
}
