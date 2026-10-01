// Next month's spending: renewals are known exactly; everyday (manual)
// spending is estimated from recent complete months.
import { getRenewalDatesUntil, normalizeDateOnly, parseDateValue } from './dates.js';

const monthKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

// Renewals of active plans that fall inside [start, end].
export function renewalsBetween(subs, start, end) {
    const items = [];
    for (const sub of subs) {
        if (sub.paused) continue;
        for (const date of getRenewalDatesUntil(sub.startDate || sub.dateAdded, sub.cycle, end)) {
            if (date >= start) items.push({ sub, date, amount: parseFloat(sub.price) });
        }
    }
    return items;
}

// Manual spending per complete month, oldest first, for up to `maxMonths`
// months before the current one. Months before the first expense are left
// out so a new user isn't averaged with empty months they never tracked.
export function manualMonthlyTotals(expenses, today = new Date(), maxMonths = 6) {
    const manual = expenses.filter(e => e.type !== 'auto');
    if (!manual.length) return [];
    const first = manual.reduce((min, e) => {
        const d = parseDateValue(e.date);
        return d < min ? d : min;
    }, parseDateValue(manual[0].date));

    const totals = new Map(manual.map(e => [monthKey(parseDateValue(e.date)), 0]));
    manual.forEach(e => {
        const k = monthKey(parseDateValue(e.date));
        totals.set(k, totals.get(k) + parseFloat(e.amount));
    });

    const out = [];
    const t = normalizeDateOnly(today);
    for (let back = maxMonths; back >= 1; back--) {
        const month = new Date(t.getFullYear(), t.getMonth() - back, 1);
        const monthEnd = new Date(t.getFullYear(), t.getMonth() - back + 1, 0);
        if (monthEnd < new Date(first.getFullYear(), first.getMonth(), 1)) continue;
        out.push({ month: monthKey(month), total: totals.get(monthKey(month)) || 0 });
    }
    return out;
}

export function forecastNextMonth(subs, expenses, today = new Date()) {
    const t = normalizeDateOnly(today);
    const start = new Date(t.getFullYear(), t.getMonth() + 1, 1);
    const end = new Date(t.getFullYear(), t.getMonth() + 2, 0);

    const renewals = renewalsBetween(subs, start, end);
    const fixed = renewals.reduce((sum, r) => sum + r.amount, 0);

    const history = manualMonthlyTotals(expenses, t);
    const values = history.map(h => h.total);
    const everyday = values.length
        ? {
            estimate: values.reduce((a, b) => a + b, 0) / values.length,
            low: Math.min(...values),
            high: Math.max(...values),
            months: values.length,
        }
        : { estimate: 0, low: 0, high: 0, months: 0 };

    return {
        month: start,
        renewals,
        fixed,
        everyday,
        estimate: fixed + everyday.estimate,
        low: fixed + everyday.low,
        high: fixed + everyday.high,
    };
}
