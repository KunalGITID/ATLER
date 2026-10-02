// Renewals are computed, never stored: a plan + its history (price changes,
// pauses, cancellation) says exactly what was charged on which day. Nothing to
// backfill, nothing to duplicate, nothing billed while paused.
import { datesUntil, type Day } from './dates.ts';
import type { Paise } from './money.ts';
import { byWhen, type Plan, type PlanEvent } from './model.ts';
import { yourShare } from './share.ts';

export interface Renewal {
  planId: string;
  name: string;
  on: Day;
  amount: Paise;
}

// Price in effect on a day: the newest price change on or before it, or the
// price before the first change.
export function priceOn(plan: Plan, events: readonly PlanEvent[], on: Day): Paise {
  const changes = events
    .filter((e): e is Extract<PlanEvent, { kind: 'price' }> => e.planId === plan.id && e.kind === 'price')
    .sort(byWhen);
  if (!changes.length) return plan.price;
  let price = changes[0]!.from;
  for (const c of changes) if (c.on <= on) price = c.to;
  return price;
}

// Days the plan was not billing: paused..resumed, cancelled..restarted.
function stoppedSpans(planId: string, events: readonly PlanEvent[]): Array<[Day, Day | null]> {
  const spans: Array<[Day, Day | null]> = [];
  let stoppedAt: Day | null = null;
  for (const e of events.filter(e => e.planId === planId).sort(byWhen)) {
    if ((e.kind === 'paused' || e.kind === 'cancelled') && !stoppedAt) stoppedAt = e.on;
    if ((e.kind === 'resumed' || e.kind === 'restarted') && stoppedAt) {
      spans.push([stoppedAt, e.on]);
      stoppedAt = null;
    }
  }
  if (stoppedAt) spans.push([stoppedAt, null]);
  return spans;
}

// Every charge of a plan in [from, to]. Stopping on a billing day keeps that
// charge; resuming on a billing day charges it.
export function renewalsBetween(plan: Plan, events: readonly PlanEvent[], from: Day, to: Day): Renewal[] {
  const anchor = plan.trialEnds && plan.status === 'trial' ? plan.trialEnds : plan.anchor;
  const spans = stoppedSpans(plan.id, events);
  const stopped = (d: Day) => spans.some(([start, end]) => d > start && (end === null || d < end));
  const last = plan.endsOn && plan.endsOn < to ? plan.endsOn : to;
  return datesUntil(anchor, plan.cycle, last)
    .filter(d => d >= from && !stopped(d))
    .map(on => ({ planId: plan.id, name: plan.name, on, amount: yourShare(plan, priceOn(plan, events, on)) }));
}
