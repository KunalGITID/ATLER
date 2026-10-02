// Every change the app makes goes through here.
import type { Cycle, Day } from '../core/dates.ts';
import type { Paise } from '../core/money.ts';
import type { Foreign, Goal, Income, Payment, PaymentSource, Plan, PlanKind, Split } from '../core/model.ts';
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
  kind?: PlanKind;
  autopay?: boolean;
  endsOn?: Day | null;
  sharedBy?: number;
  foreign?: Foreign | null;
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
    kind: input.kind ?? 'subscription',
    autopay: input.autopay ?? true,
    endsOn: input.endsOn ?? null,
    sharedBy: input.sharedBy ?? 1,
    foreign: input.foreign ?? null,
  };
  await db.plans.add({ ...plan, ...touched() });
  return plan;
}

export interface PaymentExtras { note?: string; tags?: string[]; split?: Split[]; foreign?: Foreign | null }

export async function addPayment(db: AtlerDB, input: { name: string; amount: Paise; on: Day; categoryId?: string | null; source?: PaymentSource } & PaymentExtras): Promise<Payment> {
  const payment: Payment = {
    id: newId(), name: input.name.trim(), amount: input.amount, on: input.on, categoryId: input.categoryId ?? null, source: input.source ?? 'manual',
    note: input.note?.trim() ?? '', tags: input.tags ?? [], split: input.split ?? [], foreign: input.foreign ?? null,
  };
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

export async function updatePayment(db: AtlerDB, id: string, changes: { name: string; amount: Paise; on: Day; categoryId: string | null } & PaymentExtras) {
  await db.payments.update(id, { ...changes, name: changes.name.trim(), ...(changes.note !== undefined ? { note: changes.note.trim() } : {}), ...touched() });
}

// Mark everything a person owes you as settled.
export async function settleUp(db: AtlerDB, who: string) {
  const key = who.trim().toLowerCase();
  await db.payments.filter(p => !p.deleted && (p.split ?? []).some(s => !s.settled && s.who.trim().toLowerCase() === key))
    .modify(p => {
      p.split = (p.split ?? []).map(s => (s.who.trim().toLowerCase() === key ? { ...s, settled: true } : s));
      Object.assign(p, touched());
    });
}

// ---------- income ----------

export async function addIncome(db: AtlerDB, input: Omit<Income, 'id'>): Promise<Income> {
  const income: Income = { ...input, id: newId(), name: input.name.trim() };
  await db.incomes.add({ ...income, ...touched() });
  return income;
}
export async function updateIncome(db: AtlerDB, id: string, changes: Omit<Income, 'id'>) {
  await db.incomes.update(id, { ...changes, name: changes.name.trim(), ...touched() });
}
export async function deleteIncome(db: AtlerDB, id: string) {
  await db.incomes.update(id, { deleted: 1, ...touched() });
}

// ---------- goals ----------

export async function addGoal(db: AtlerDB, input: Omit<Goal, 'id'>): Promise<Goal> {
  const goal: Goal = { ...input, id: newId(), name: input.name.trim() };
  await db.goals.add({ ...goal, ...touched() });
  return goal;
}
export async function updateGoal(db: AtlerDB, id: string, changes: Partial<Omit<Goal, 'id'>>) {
  await db.goals.update(id, { ...changes, ...(changes.name !== undefined ? { name: changes.name.trim() } : {}), ...touched() });
}
export async function deleteGoal(db: AtlerDB, id: string) {
  await db.goals.update(id, { deleted: 1, ...touched() });
}

// Soft delete with undo: the tombstone syncs, and undo clears it again.
export async function deletePayment(db: AtlerDB, id: string) {
  await db.payments.update(id, { deleted: 1, ...touched() });
}
export async function restorePayment(db: AtlerDB, id: string) {
  await db.payments.where('id').equals(id).modify(r => { delete r.deleted; Object.assign(r, touched()); });
}
