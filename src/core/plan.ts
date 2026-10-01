// What the plan details screen shows. Pure: plan + its events + today.
import { addDays, cycleProgress, monthlyCost, nthDate, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Plan, PlanEvent } from './model.ts';
import { renewalsBetween, type Renewal } from './renewals.ts';

export interface PlanView {
  history: Renewal[];        // every charge so far, oldest first (the bars)
  paidSoFar: Paise;
  currentPrice: Paise;
  perYear: Paise;
  countdown: ReturnType<typeof cycleProgress> | null; // null when not billing
  stoppedOn: Day | null;     // paused/cancelled since
  saved: Paise;              // charges skipped since cancelling
  soon: boolean;             // next charge within 7 days -> the block turns coral
}

const lastStop = (plan: Plan, events: readonly PlanEvent[]) =>
  [...events].filter(e => e.planId === plan.id && (e.kind === 'paused' || e.kind === 'cancelled')).sort((a, b) => (a.on < b.on ? 1 : -1))[0]?.on ?? null;

export function planView(plan: Plan, events: readonly PlanEvent[], today: Day): PlanView {
  const billing = plan.status === 'active' || plan.status === 'trial';
  const anchor = plan.status === 'trial' && plan.trialEnds ? plan.trialEnds : plan.anchor;
  const history = renewalsBetween(plan, events, plan.anchor, today);
  const countdown = billing ? cycleProgress(anchor, plan.cycle, today) : null;
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
  };
}

// The billing date before `day` (used when a plan is created from "next charge").
export const chargeBefore = (plan: Plan, day: Day): Day => nthDate(day, plan.cycle, -1);
