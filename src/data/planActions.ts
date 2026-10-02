// Changing a plan always records what happened as an event, so renewals,
// history and savings stay right without rewriting anything.
import type { Cycle, Day } from '../core/dates.ts';
import type { Paise } from '../core/money.ts';
import type { Plan, PlanEvent } from '../core/model.ts';
import { newId, type AtlerDB } from './db.ts';
import { touched } from './touch.ts';


// Omit applied to each member of the union, so a price event keeps from/to.
type NewEvent = PlanEvent extends infer E ? (E extends PlanEvent ? Omit<E, 'id' | 'at'> : never) : never;

async function record(db: AtlerDB, event: NewEvent) {
  await db.events.add({ ...event, id: newId(), at: Date.now(), ...touched() } as PlanEvent & { updatedAt: number });
}

export async function editPlan(db: AtlerDB, plan: Plan, changes: { name: string; price: Paise; cycle: Cycle }, today: Day) {
  await db.transaction('rw', db.plans, db.events, async () => {
    if (changes.price !== plan.price) {
      await record(db, { planId: plan.id, on: today, kind: 'price', from: plan.price, to: changes.price });
    }
    await db.plans.update(plan.id, { name: changes.name.trim(), price: changes.price, cycle: changes.cycle, ...touched() });
  });
}

export async function setStatus(db: AtlerDB, plan: Plan, action: 'pause' | 'resume' | 'cancel' | 'restart', today: Day) {
  const next = { pause: 'paused', resume: 'active', cancel: 'cancelled', restart: 'active' } as const;
  const kind = { pause: 'paused', resume: 'resumed', cancel: 'cancelled', restart: 'restarted' } as const;
  await db.transaction('rw', db.plans, db.events, async () => {
    await record(db, { planId: plan.id, on: today, kind: kind[action] });
    await db.plans.update(plan.id, { status: next[action], ...touched() });
  });
}

// Soft delete (kept as a tombstone so sync can pass the delete on).
export async function deletePlan(db: AtlerDB, plan: Plan) {
  await db.transaction('rw', db.plans, db.events, async () => {
    await db.plans.update(plan.id, { deleted: 1, ...touched() });
    await db.events.where('planId').equals(plan.id).modify({ deleted: 1, ...touched() });
  });
}
