// Year in review: what a calendar year cost you, only counting what has
// actually happened (charges after today aren't spent yet).
import { makeDay, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Category, Payment, Plan, PlanEvent } from './model.ts';
import { renewalsBetween } from './renewals.ts';
import { ownAmount } from './share.ts';

export interface YearMonth { month: Day; total: Paise | null } // null = not happened / not tracked yet
export interface YearLine { name: string; amount: Paise; planId?: string; categoryId?: string | null }

export interface YearReview {
  year: number;
  total: Paise;
  plansTotal: Paise;
  everydayTotal: Paise;
  months: YearMonth[];
  busiest: YearMonth | null;
  topPlans: YearLine[];
  topCategories: YearLine[];
  biggestExpense: Payment | null;
  priceRises: Array<{ planId: string; name: string; on: Day; from: Paise; to: Paise }>;
  cancelled: Array<{ planId: string; name: string; on: Day }>;
}

export function yearReview(year: number, today: Day, plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[], categories: readonly Category[], since: Day | null): YearReview {
  const first = makeDay(year, 1, 1)!;
  const yearEnd = makeDay(year, 12, 31)!;
  const last = yearEnd < today ? yearEnd : today;
  const renewals = last < first ? [] : plans.flatMap(p => renewalsBetween(p, events.filter(e => e.planId === p.id), first, last));
  const spent = payments.filter(p => p.on >= first && p.on <= last);

  const months: YearMonth[] = Array.from({ length: 12 }, (_, i) => {
    const month = makeDay(year, i + 1, 1)!;
    const key = month.slice(0, 7);
    if (month > today || (since && key < since.slice(0, 7))) return { month, total: null };
    return { month, total: sum([...renewals.filter(r => r.on.startsWith(key)).map(r => r.amount), ...spent.filter(p => p.on.startsWith(key)).map(p => p.amount)]) };
  });
  const counted = months.filter(m => m.total !== null && m.total > 0);
  const busiest = counted.length > 1 ? counted.reduce((a, b) => (b.total! > a.total! ? b : a)) : null;

  const perPlan = new Map<string, YearLine>();
  for (const r of renewals) {
    const line = perPlan.get(r.planId) ?? { name: r.name, amount: paise(0), planId: r.planId };
    line.amount = sum([line.amount, r.amount]);
    perPlan.set(r.planId, line);
  }

  const catName = new Map(categories.map(c => [c.id, c.name]));
  const planCat = new Map(plans.map(p => [p.id, p.categoryId]));
  const perCat = new Map<string, YearLine>();
  const addTo = (categoryId: string | null, amount: Paise) => {
    const id = categoryId && catName.has(categoryId) ? categoryId : null;
    const k = id ?? '';
    const line = perCat.get(k) ?? { name: id ? catName.get(id)! : 'Uncategorised', amount: paise(0), categoryId: id };
    line.amount = sum([line.amount, amount]);
    perCat.set(k, line);
  };
  for (const r of renewals) addTo(planCat.get(r.planId) ?? null, r.amount);
  for (const p of spent) addTo(p.categoryId, ownAmount(p));

  const names = new Map(plans.map(p => [p.id, p.name]));
  const inYear = events.filter(e => e.on >= first && e.on <= last && names.has(e.planId));
  const byAmount = (a: YearLine, b: YearLine) => b.amount - a.amount;

  return {
    year,
    total: sum([...renewals.map(r => r.amount), ...spent.map(p => p.amount)]),
    plansTotal: sum(renewals.map(r => r.amount)),
    everydayTotal: sum(spent.map(ownAmount)),
    months,
    busiest,
    topPlans: [...perPlan.values()].sort(byAmount).slice(0, 5),
    topCategories: [...perCat.values()].sort(byAmount).slice(0, 5),
    biggestExpense: spent.reduce<Payment | null>((a, b) => (!a || b.amount > a.amount ? b : a), null),
    priceRises: inYear.flatMap(e => (e.kind === 'price' && e.to > e.from ? [{ planId: e.planId, name: names.get(e.planId)!, on: e.on, from: e.from, to: e.to }] : [])),
    cancelled: inYear.flatMap(e => (e.kind === 'cancelled' ? [{ planId: e.planId, name: names.get(e.planId)!, on: e.on }] : [])),
  };
}
