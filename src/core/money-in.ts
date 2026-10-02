// Bills to pay by hand, money coming in, what's left, goals and who owes you.
// Pure: the screens pass in what's stored and today.
import { addDays, daysBetween, endOfMonth, nthDate, startOfMonth, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Goal, Income, Payment, Plan, PlanEvent } from './model.ts';
import { monthRing } from './month.ts';
import { renewalsBetween } from './renewals.ts';
import { isAutopay, owed } from './share.ts';

// ---------- bills ----------

export interface Due { plan: Plan; on: Day; amount: Paise; overdue: boolean }

// Charges of plans that aren't paid automatically, from the last `lookback`
// days to a week ahead, that haven't been marked paid. Charges on or before
// the day a plan was added were paid already (you told ATLER the last one).
export function billsToPay(plans: readonly Plan[], events: readonly PlanEvent[], today: Day, lookback = 60): Due[] {
  const paid = new Set(events.filter(e => e.kind === 'paid').map(e => `${e.planId}|${e.on}`));
  return plans
    .filter(p => !isAutopay(p) && p.status === 'active')
    .flatMap(plan => renewalsBetween(plan, events.filter(e => e.planId === plan.id), addDays(today, -lookback), addDays(today, 7))
      .filter(r => r.on > plan.createdOn && !paid.has(`${plan.id}|${r.on}`))
      .map(r => ({ plan, on: r.on, amount: r.amount, overdue: r.on < today })))
    .sort((a, b) => (a.on < b.on ? -1 : a.on > b.on ? 1 : 0));
}

// ---------- income ----------

export interface IncomeItem { income: Income; on: Day; amount: Paise }

// Every time income arrives in [from, to]. A monthly one repeats on its day
// (clamped: the 31st becomes the 30th or 28th in short months).
export function incomeBetween(incomes: readonly Income[], from: Day, to: Day): IncomeItem[] {
  const out: IncomeItem[] = [];
  for (const income of incomes) {
    if (income.repeat === 'none') {
      if (income.on >= from && income.on <= to) out.push({ income, on: income.on, amount: income.amount });
      continue;
    }
    for (let n = 0; n < 1200; n++) {
      const on = nthDate(income.on, { unit: 'month', every: 1 }, n);
      if (on > to) break;
      if (on >= from) out.push({ income, on, amount: income.amount });
    }
  }
  return out.sort((a, b) => (a.on < b.on ? -1 : 1));
}

export interface MonthMoney {
  income: Paise;          // this whole month
  received: Paise;        // of it, arrived by today
  spent: Paise;           // so far
  toCome: Paise;          // renewals still due this month
  left: Paise;            // income - spent - toCome (negative: overspending)
  savingsRate: number | null; // left / income; null without income
}

export function monthMoney(today: Day, incomes: readonly Income[], plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[]): MonthMoney {
  const items = incomeBetween(incomes, startOfMonth(today), endOfMonth(today));
  const income = sum(items.map(i => i.amount));
  const ring = monthRing(today, plans, events, payments);
  const left = paise(income - ring.spent - ring.toCome);
  return {
    income,
    received: sum(items.filter(i => i.on <= today).map(i => i.amount)),
    spent: ring.spent,
    toCome: ring.toCome,
    left,
    savingsRate: income > 0 ? left / income : null,
  };
}

// ---------- goals ----------

export interface GoalView {
  goal: Goal;
  done: number;              // 0..1
  left: Paise;
  monthsLeft: number | null; // whole months until `by` (at least 1), null without a date
  perMonth: Paise | null;    // to save each month to make it
  reached: boolean;
}

export function goalView(goal: Goal, today: Day): GoalView {
  const left = paise(Math.max(0, goal.target - goal.saved));
  const monthsLeft = goal.by ? Math.max(1, Math.ceil(daysBetween(today, goal.by) / 30.44)) : null;
  return {
    goal,
    done: Math.min(1, goal.saved / goal.target),
    left,
    monthsLeft,
    perMonth: monthsLeft && left > 0 ? paise(Math.ceil(left / monthsLeft)) : null,
    reached: goal.saved >= goal.target,
  };
}

// ---------- splits ----------

export interface Owes { who: string; amount: Paise; payments: Payment[] }

// Who owes you what, from expenses you split and haven't settled. Names
// match whatever the case: "asha" and "Asha" are one person.
export function owedByPerson(payments: readonly Payment[]): Owes[] {
  const people = new Map<string, Owes>();
  for (const p of payments) {
    if (!owed(p)) continue;
    for (const s of p.split ?? []) {
      if (s.settled) continue;
      const key = s.who.trim().toLowerCase();
      const entry = people.get(key) ?? { who: s.who.trim(), amount: paise(0), payments: [] };
      entry.amount = sum([entry.amount, s.amount]);
      if (!entry.payments.includes(p)) entry.payments.push(p);
      people.set(key, entry);
    }
  }
  return [...people.values()].sort((a, b) => b.amount - a.amount);
}

// Split `amount` evenly between you and the named people: what each of them
// owes. Any odd paise stay with you.
export function evenSplit(amount: Paise, people: readonly string[]): Array<{ who: string; amount: Paise }> {
  const names = people.map(p => p.trim()).filter(Boolean);
  if (!names.length) return [];
  const each = Math.floor(amount / (names.length + 1));
  return names.map(who => ({ who, amount: paise(each) }));
}
