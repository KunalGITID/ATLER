// The month ring: the calendar of the current month.
//   arc        = 1st -> today
//   black dot  = a renewal already paid this month
//   coral dot  = a renewal still to come this month
//   centre     = what has been spent so far
import { datesUntil, dayOfMonth, daysInMonth, endOfMonth, startOfMonth, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Payment, Plan } from './model.ts';

export interface RingMarker {
  planId: string;
  name: string;
  on: Day;
  amount: Paise;
  status: 'paid' | 'coming';
  at: number; // position around the ring, 0 = the 1st at the top, 1 = a full turn
}

export interface MonthRing {
  today: Day;
  days: number;
  elapsed: number;      // fraction of the ring covered by the arc
  spent: Paise;
  toCome: Paise;
  markers: RingMarker[];
}

const billable = (p: Plan) => p.status === 'active' || p.status === 'trial';

export function monthRing(today: Day, plans: readonly Plan[], payments: readonly Payment[]): MonthRing {
  const first = startOfMonth(today);
  const last = endOfMonth(today);
  const days = daysInMonth(today);
  const position = (d: Day) => (dayOfMonth(d) - 1) / days;

  const markers: RingMarker[] = [];
  for (const plan of plans.filter(billable)) {
    // A trial bills nothing until it ends: its first charge is trialEnds.
    const anchor = plan.status === 'trial' && plan.trialEnds ? plan.trialEnds : plan.anchor;
    for (const on of datesUntil(anchor, plan.cycle, last)) {
      if (on < first) continue;
      markers.push({ planId: plan.id, name: plan.name, on, amount: plan.price, status: on <= today ? 'paid' : 'coming', at: position(on) });
    }
  }
  markers.sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));

  const spent = sum(payments.filter(p => p.on >= first && p.on <= today).map(p => p.amount));
  const toCome = sum(markers.filter(m => m.status === 'coming').map(m => m.amount));
  return { today, days, elapsed: dayOfMonth(today) / days, spent, toCome: paise(toCome), markers };
}
