// Which reminders go out today, and what they say. Used by the app and by the
// send-reminders-v2 Edge Function, so both decide exactly the same way.
import { addDays, daysBetween, type Day } from './dates.ts';
import { formatRupees } from './money.ts';
import type { Plan, PlanEvent, Remind } from './model.ts';
import { renewalsBetween } from './renewals.ts';

const DAYS: Record<Remind, number[]> = { off: [], '3d': [3], '1d': [1], both: [3, 1] };
// A trial converting into a charge is the one reminder you always get.
const TRIAL_DAYS = [3, 1];

export const inTrial = (plan: Plan, today: Day) => plan.status === 'trial' && plan.trialEnds !== null && plan.trialEnds > today;

export interface Reminder {
  plan: Plan;
  on: Day;          // the charge it's about
  daysBefore: number;
  trial: boolean;
}

export function dueReminders(plans: readonly Plan[], events: readonly PlanEvent[], today: Day): Reminder[] {
  const due: Reminder[] = [];
  for (const plan of plans) {
    const trial = inTrial(plan, today);
    const days = trial ? TRIAL_DAYS : DAYS[plan.remind];
    if (!days.length) continue;
    const next = renewalsBetween(plan, events.filter(e => e.planId === plan.id), addDays(today, 1), addDays(today, 4))[0];
    if (!next) continue;
    const daysBefore = daysBetween(today, next.on);
    if (days.includes(daysBefore)) due.push({ plan, on: next.on, daysBefore, trial });
  }
  return due;
}

export function reminderText(r: Reminder): { title: string; body: string; tag: string } {
  const when = r.daysBefore === 1 ? 'tomorrow' : `in ${r.daysBefore} days`;
  const date = new Date(`${r.on}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const price = formatRupees(r.plan.price);
  return r.trial
    ? { title: `${r.plan.name} trial ends ${when}`, body: `Then ${price} from ${date}. Cancel before then if you don't want it.`, tag: `trial-${r.plan.id}-${r.on}-${r.daysBefore}` }
    : { title: `${r.plan.name} renews ${when}`, body: `${price} on ${date}.`, tag: `renewal-${r.plan.id}-${r.on}-${r.daysBefore}` };
}
