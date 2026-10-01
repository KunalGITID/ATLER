// Every change the app makes goes through here.
import type { Cycle, Day } from '../core/dates.ts';
import type { Paise } from '../core/money.ts';
import type { Payment, Plan } from '../core/model.ts';
import { newId, type AtlerDB } from './db.ts';

export interface NewPlan {
  name: string;
  price: Paise;
  cycle: Cycle;
  lastCharged: Day; // the most recent charge; every renewal is counted from it
  today: Day;
}

export async function addPlan(db: AtlerDB, input: NewPlan): Promise<Plan> {
  // A past date is the last charge; a future one is the first. Either way
  // every renewal is counted from it.
  const anchor = input.lastCharged;
  const plan: Plan = {
    id: newId(),
    name: input.name.trim(),
    price: input.price,
    cycle: input.cycle,
    anchor,
    categoryId: null,
    status: 'active',
    trialEnds: null,
    remind: 'off',
    createdOn: input.today,
  };
  await db.plans.add({ ...plan, updatedAt: Date.now() });
  return plan;
}

export async function addPayment(db: AtlerDB, input: { name: string; amount: Paise; on: Day }): Promise<Payment> {
  const payment: Payment = { id: newId(), name: input.name.trim(), amount: input.amount, on: input.on, categoryId: null, source: 'manual' };
  await db.payments.add({ ...payment, updatedAt: Date.now() });
  return payment;
}
