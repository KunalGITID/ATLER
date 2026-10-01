// Budget usage per category for the current month: the monthly cost of the
// category's active subscriptions plus everyday expenses logged in it.
import { getMonthlyCost, parseDateValue } from './dates.js';

export function expenseCategory(exp, subsById) {
    if (exp.type === 'auto') {
        const sub = subsById.get(String(exp.id).replace(/^auto_/, '').replace(/_\d{4}-\d{2}-\d{2}$/, ''));
        return sub?.category || 'unlisted';
    }
    return exp.category || 'unlisted';
}

export function budgetUsage(categories, subs, expenses, today = new Date()) {
    const sameMonth = d => d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
    return categories
        .filter(cat => Number(cat.budget) > 0)
        .map(cat => {
            const recurring = subs
                .filter(s => !s.paused && (s.category || 'unlisted') === cat.id)
                .reduce((sum, s) => sum + getMonthlyCost(s), 0);
            const everyday = expenses
                .filter(e => e.type !== 'auto' && (e.category || 'unlisted') === cat.id && sameMonth(parseDateValue(e.date)))
                .reduce((sum, e) => sum + parseFloat(e.amount), 0);
            const budget = Number(cat.budget);
            const spent = recurring + everyday;
            return {
                id: cat.id,
                name: cat.name,
                recurring,
                everyday,
                spent,
                budget,
                remaining: budget - spent,
                percent: Math.round((spent / budget) * 100),
                over: spent > budget,
            };
        })
        .sort((a, b) => (a.over === b.over ? b.spent - a.spent : Number(b.over) - Number(a.over)));
}
