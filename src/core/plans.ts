// The Plans tab: every plan, what it costs per month, and its share of the total.
import { addDays, monthlyCost, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Plan, PlanEvent } from './model.ts';
import { renewalsBetween } from './renewals.ts';

export interface PlanRow {
  plan: Plan;
  perMonth: Paise;
  share: number;        // of the monthly total of billing plans (0..1); 0 when not billing
  next: Day | null;     // next charge, if it's billing
}

export interface PlansSummary {
  billing: PlanRow[];   // biggest monthly cost first
  paused: PlanRow[];
  cancelled: PlanRow[];
  perMonth: Paise;
  perYear: Paise;
}

export function plansSummary(plans: readonly Plan[], events: readonly PlanEvent[], today: Day): PlansSummary {
  const live = plans.filter(p => p.status === 'active' || p.status === 'trial');
  const perMonth = sum(live.map(p => monthlyCost(p.price, p.cycle)));
  const row = (plan: Plan): PlanRow => {
    const billing = plan.status === 'active' || plan.status === 'trial';
    const cost = monthlyCost(plan.price, plan.cycle);
    const next = billing ? renewalsBetween(plan, events, addDays(today, 1), addDays(today, 800))[0]?.on ?? null : null;
    return { plan, perMonth: cost, share: billing && perMonth > 0 ? cost / perMonth : 0, next };
  };
  const byName = (a: PlanRow, b: PlanRow) => a.plan.name.localeCompare(b.plan.name);
  return {
    billing: live.map(row).sort((a, b) => b.perMonth - a.perMonth || byName(a, b)),
    paused: plans.filter(p => p.status === 'paused').map(row).sort(byName),
    cancelled: plans.filter(p => p.status === 'cancelled').map(row).sort(byName),
    perMonth,
    perYear: paise(perMonth * 12),
  };
}
