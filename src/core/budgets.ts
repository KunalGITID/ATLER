// Budgets per category for the current month.
//   spent  = renewals already paid this month + expenses logged so far
//   coming = renewals still to come this month
//   left   = budget - spent - coming (negative = over)
import { endOfMonth, startOfMonth, type Day } from './dates.ts';
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
      return { category, budget: category.budget, spent, coming, left, over: left < 0 };
    })
    // Over-budget first, then the tightest.
    .sort((a, b) => Number(b.over) - Number(a.over) || a.left / a.budget - b.left / b.budget);
}
