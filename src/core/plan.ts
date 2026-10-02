// What the plan details screen shows. Pure: plan + its events + today.
import { addDays, cycleProgress, daysBetween, monthlyCost, nthDate, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import { byWhen, type Plan, type PlanEvent } from './model.ts';
import { renewalsBetween, type Renewal } from './renewals.ts';

export interface PlanView {
  history: Renewal[];        // every charge so far, oldest first (the bars)
  paidSoFar: Paise;
  currentPrice: Paise;
  perYear: Paise;
  countdown: ReturnType<typeof cycleProgress> | null; // null when not billing
  trial: boolean;            // countdown measures the free trial (added -> converts)
  stoppedOn: Day | null;     // paused/cancelled since
  saved: Paise;              // charges skipped since cancelling
  soon: boolean;             // next charge within 7 days -> the block turns coral
}

const lastStop = (plan: Plan, events: readonly PlanEvent[]) =>
  events.filter(e => e.planId === plan.id && (e.kind === 'paused' || e.kind === 'cancelled')).sort(byWhen).at(-1)?.on ?? null;

export function planView(plan: Plan, events: readonly PlanEvent[], today: Day): PlanView {
  const billing = plan.status === 'active' || plan.status === 'trial';
  const anchor = plan.status === 'trial' && plan.trialEnds ? plan.trialEnds : plan.anchor;
  const history = renewalsBetween(plan, events, plan.anchor, today);
  const trial = plan.status === 'trial' && plan.trialEnds !== null && plan.trialEnds > today;
  const countdown = !billing ? null
    : trial ? trialProgress(plan.createdOn, plan.trialEnds!, today)
    : cycleProgress(anchor, plan.cycle, today);
  const stoppedOn = billing ? null : lastStop(plan, events);

  // What cancelling has kept in your pocket: every charge the plan would have
  // made after the day it was cancelled.
  let saved = paise(0);
  if (plan.status === 'cancelled' && stoppedOn) {
    const wouldHave = renewalsBetween({ ...plan, status: 'active' }, events.filter(e => e.planId !== plan.id), addDays(stoppedOn, 1), today);
    saved = sum(wouldHave.map(() => plan.price));
  }

  return {
    history,
    paidSoFar: sum(history.map(r => r.amount)),
    currentPrice: plan.price,
    perYear: paise(monthlyCost(plan.price, plan.cycle) * 12),
    countdown,
    stoppedOn,
    saved,
    soon: countdown !== null && countdown.left <= 7,
    trial,
  };
}

function trialProgress(start: Day, end: Day, today: Day) {
  const total = Math.max(1, daysBetween(start, end));
  const left = daysBetween(today, end);
  return { start, end, total, left, done: (total - left) / total };
}

// The billing date before `day` (used when a plan is created from "next charge").
export const chargeBefore = (plan: Plan, day: Day): Day => nthDate(day, plan.cycle, -1);
