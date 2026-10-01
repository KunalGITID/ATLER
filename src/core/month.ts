// The month ring: the calendar of the current month.
//   arc        = 1st -> today
//   black dot  = a renewal already paid this month
//   coral dot  = a renewal still to come this month
//   centre     = what has been spent so far (renewals paid + expenses logged)
import { addDays, dayOfMonth, daysInMonth, endOfMonth, monthlyCost, startOfMonth, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Payment, Plan, PlanEvent } from './model.ts';
import { renewalsBetween, type Renewal } from './renewals.ts';

export interface RingMarker extends Renewal {
  status: 'paid' | 'coming';
  at: number; // position around the ring: 0 = the 1st at the top, 1 = a full turn
}

export interface MonthRing {
  today: Day;
  days: number;
  elapsed: number;   // fraction of the ring the arc covers (1st -> today)
  spent: Paise;
  toCome: Paise;
  markers: RingMarker[];
}

const byDay = <T extends { on: Day }>(a: T, b: T) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0);

function renewalsIn(plans: readonly Plan[], events: readonly PlanEvent[], from: Day, to: Day): Renewal[] {
  return plans.flatMap(p => renewalsBetween(p, events, from, to)).sort(byDay);
}

const paymentsIn = (payments: readonly Payment[], from: Day, to: Day) => payments.filter(p => p.on >= from && p.on <= to);

export function monthRing(today: Day, plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[]): MonthRing {
  const first = startOfMonth(today);
  const days = daysInMonth(today);
  const markers: RingMarker[] = renewalsIn(plans, events, first, endOfMonth(today)).map(r => ({
    ...r,
    status: r.on <= today ? 'paid' : 'coming',
    at: (dayOfMonth(r.on) - 1) / days,
  }));
  const paid = markers.filter(m => m.status === 'paid').map(m => m.amount);
  const logged = paymentsIn(payments, first, today).map(p => p.amount);
  return {
    today,
    days,
    elapsed: dayOfMonth(today) / days,
    spent: sum([...paid, ...logged]),
    toCome: sum(markers.filter(m => m.status === 'coming').map(m => m.amount)),
    markers,
  };
}

// Everything a whole month costs: its renewals plus expenses logged in it.
export function monthTotal(anyDayInMonth: Day, plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[]): Paise {
  const first = startOfMonth(anyDayInMonth);
  const last = endOfMonth(anyDayInMonth);
  return sum([...renewalsIn(plans, events, first, last).map(r => r.amount), ...paymentsIn(payments, first, last).map(p => p.amount)]);
}

// This month as it's heading (spent + still to come) against all of last month.
export function vsLastMonth(today: Day, plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[]): Paise {
  const ring = monthRing(today, plans, events, payments);
  const lastMonth = addDays(startOfMonth(today), -1);
  return paise(ring.spent + ring.toCome - monthTotal(lastMonth, plans, events, payments));
}

// The next charge after today, if one is due within `withinDays`.
export function nextUp(today: Day, plans: readonly Plan[], events: readonly PlanEvent[], withinDays = 45): Renewal | null {
  return renewalsIn(plans, events, addDays(today, 1), addDays(today, withinDays))[0] ?? null;
}

// The biggest recent price rise (last 60 days) on a plan still billing, with
// what it adds per year. null when nothing went up — then the tile isn't shown.
export function priceCreep(today: Day, plans: readonly Plan[], events: readonly PlanEvent[]) {
  const since = addDays(today, -60);
  const rises = events
    .filter((e): e is Extract<PlanEvent, { kind: 'price' }> => e.kind === 'price' && e.to > e.from && e.on >= since && e.on <= today)
    .map(e => {
      const plan = plans.find(p => p.id === e.planId);
      if (!plan || plan.status === 'cancelled' || plan.status === 'paused') return null;
      const perYear = paise((monthlyCost(e.to, plan.cycle) - monthlyCost(e.from, plan.cycle)) * 12);
      return { plan, from: e.from, to: e.to, perYear };
    })
    .filter(<T,>(x: T | null): x is T => x !== null)
    .sort((a, b) => b.perYear - a.perYear);
  return rises[0] ?? null;
}

// The first day ATLER knows about: the earliest plan added or expense logged.
export function trackingSince(plans: readonly Plan[], payments: readonly Payment[]): Day | null {
  const days = [...plans.map(p => p.createdOn), ...payments.map(p => p.on)].sort();
  return days[0] ?? null;
}

// "vs last month" only means something once all of last month was tracked.
export function canCompareWithLastMonth(today: Day, plans: readonly Plan[], payments: readonly Payment[]): boolean {
  const since = trackingSince(plans, payments);
  const lastMonthStart = startOfMonth(addDays(startOfMonth(today), -1));
  return since !== null && since <= lastMonthStart;
}

// The steady monthly cost of every plan still billing.
export function plansPerMonth(plans: readonly Plan[]): Paise {
  return sum(plans.filter(p => p.status === 'active' || p.status === 'trial').map(p => monthlyCost(p.price, p.cycle)));
}
