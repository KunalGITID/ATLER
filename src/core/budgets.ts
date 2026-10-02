// Budgets per category for the current month.
//   spent  = renewals already paid this month + expenses logged so far
//   coming = renewals still to come this month
//   left   = budget - spent - coming (negative = over)
//   projected = spent + coming + the everyday spending still likely this
//               month (your usual daily rate in that category x days left)
import { addDays, dayOfMonth, daysBetween, daysInMonth, endOfMonth, startOfMonth, type Day } from './dates.ts';
import { paise, sum, type Paise } from './money.ts';
import type { Category, Payment, Plan, PlanEvent } from './model.ts';
import { renewalsBetween } from './renewals.ts';
import { ownAmount } from './share.ts';

export interface BudgetLine {
  category: Category;
  budget: Paise;
  spent: Paise;
  coming: Paise;
  left: Paise;
  over: boolean;
  projected: Paise;
  risk: 'over' | 'likely' | 'close' | 'ok';
}

// Your usual everyday spending per day in a category: the last three complete
// months you were tracking, or this month's pace when there's no history yet
// (once a few days have passed, so one purchase on the 1st isn't a trend).
function dailyRate(payments: readonly Payment[], categoryId: string, today: Day): number {
  const mine = payments.filter(p => p.categoryId === categoryId);
  const first = startOfMonth(today);
  const since = startOfMonth(addDays(startOfMonth(addDays(startOfMonth(addDays(first, -1)), -1)), -1)); // three months back
  const tracked = [...payments].map(p => p.on).sort()[0];
  const from = tracked && startOfMonth(tracked) > since ? startOfMonth(tracked) : since;
  if (tracked && from < first) {
    const days = daysBetween(from, first);
    return sum(mine.filter(p => p.on >= from && p.on < first).map(ownAmount)) / days;
  }
  const elapsed = dayOfMonth(today);
  return elapsed >= 5 ? sum(mine.filter(p => p.on >= first && p.on <= today).map(ownAmount)) / elapsed : 0;
}

export function budgetLines(today: Day, categories: readonly Category[], plans: readonly Plan[], events: readonly PlanEvent[], payments: readonly Payment[]): BudgetLine[] {
  const first = startOfMonth(today);
  const last = endOfMonth(today);
  return categories
    .filter((c): c is Category & { budget: Paise } => c.budget !== null && c.budget > 0)
    .map(category => {
      const renewals = plans
        .filter(p => p.categoryId === category.id)
        .flatMap(p => renewalsBetween(p, events, first, last));
      const spent = sum([
        ...renewals.filter(r => r.on <= today).map(r => r.amount),
        ...payments.filter(p => p.categoryId === category.id && p.on >= first && p.on <= today).map(ownAmount),
      ]);
      const coming = sum(renewals.filter(r => r.on > today).map(r => r.amount));
      const left = paise(category.budget - spent - coming);
      const daysLeft = daysInMonth(today) - dayOfMonth(today);
      const projected = paise(Math.round(spent + coming + dailyRate(payments, category.id, today) * daysLeft));
      const risk = left < 0 ? 'over' as const : projected > category.budget ? 'likely' as const : projected > 0.9 * category.budget ? 'close' as const : 'ok' as const;
      return { category, budget: category.budget, spent, coming, left, over: left < 0, projected, risk };
    })
    // Over-budget first, then the tightest.
    .sort((a, b) => Number(b.over) - Number(a.over) || a.left / a.budget - b.left / b.budget);
}
