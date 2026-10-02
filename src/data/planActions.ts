// Changing a plan always records what happened as an event, so renewals,
// history and savings stay right without rewriting anything.
import type { Cycle, Day } from '../core/dates.ts';
import type { Paise } from '../core/money.ts';
import type { Foreign, Plan, PlanEvent, PlanKind, Remind } from '../core/model.ts';
import { newId, type AtlerDB } from './db.ts';
import { touched } from './touch.ts';


// Omit applied to each member of the union, so a price event keeps from/to.
type NewEvent = PlanEvent extends infer E ? (E extends PlanEvent ? Omit<E, 'id' | 'at'> : never) : never;

async function record(db: AtlerDB, event: NewEvent) {
  await db.events.add({ ...event, id: newId(), at: Date.now(), ...touched() } as PlanEvent & { updatedAt: number });
}

export interface PlanExtras { kind?: PlanKind; autopay?: boolean; endsOn?: Day | null; sharedBy?: number; foreign?: Foreign | null }

export async function editPlan(db: AtlerDB, plan: Plan, changes: { name: string; price: Paise; cycle: Cycle; anchor?: Day } & PlanExtras, today: Day) {
  await db.transaction('rw', db.plans, db.events, async () => {
    if (changes.price !== plan.price) {
      await record(db, { planId: plan.id, on: today, kind: 'price', from: plan.price, to: changes.price });
    }
    // A new billing date re-times every renewal (a trial's end moves with it).
    const anchor = changes.anchor ?? plan.anchor;
    const trialEnds = plan.status === 'trial' && changes.anchor ? changes.anchor : plan.trialEnds;
    const extras: PlanExtras = {};
    for (const k of ['kind', 'autopay', 'endsOn', 'sharedBy', 'foreign'] as const) if (changes[k] !== undefined) Object.assign(extras, { [k]: changes[k] });
    await db.plans.update(plan.id, { name: changes.name.trim(), price: changes.price, cycle: changes.cycle, anchor, trialEnds, ...extras, ...touched() });
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

// A charge you pay by hand was paid (`due` is the day it was due), or not after all.
export async function markPaid(db: AtlerDB, plan: Plan, due: Day) {
  await record(db, { planId: plan.id, on: due, kind: 'paid' });
}
export async function unmarkPaid(db: AtlerDB, planId: string, due: Day) {
  await db.events.where('planId').equals(planId).filter(e => e.kind === 'paid' && e.on === due && !e.deleted).modify({ deleted: 1, ...touched() });
}

// "Yes, I still use it": quiets the check-in for a while.
export async function stillUsing(db: AtlerDB, plan: Plan, today: Day) {
  await record(db, { planId: plan.id, on: today, kind: 'reviewed' });
}

export async function setRemind(db: AtlerDB, plan: Plan, remind: Remind) {
  await db.plans.update(plan.id, { remind, ...touched() });
}

export async function restorePlan(db: AtlerDB, planId: string) {
  await db.transaction('rw', db.plans, db.events, async () => {
    await db.plans.where('id').equals(planId).modify(r => { delete r.deleted; Object.assign(r, touched()); });
    await db.events.where('planId').equals(planId).modify(r => { delete r.deleted; Object.assign(r, touched()); });
  });
}
