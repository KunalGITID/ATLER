// Price-change maths for the details page and insights.
import { getMonthlyCost, normalizeDateOnly } from './dates.js';

// Per-month and per-year effect of going from oldPrice to newPrice on a cycle.
export function priceChangeImpact({ oldPrice, newPrice }, cycle) {
    const before = getMonthlyCost({ price: oldPrice, cycle });
    const after = getMonthlyCost({ price: newPrice, cycle });
    const monthly = after - before;
    return {
        monthly,
        yearly: monthly * 12,
        percent: Number(oldPrice) > 0 ? Math.round(((newPrice - oldPrice) / oldPrice) * 100) : null,
    };
}

// Increases in the last `withinDays`, biggest yearly impact first.
export function recentIncreases(changes, subsById, today = new Date(), withinDays = 60) {
    const cutoff = normalizeDateOnly(today);
    cutoff.setDate(cutoff.getDate() - withinDays);
    return changes
        .filter(c => c.newPrice > c.oldPrice && normalizeDateOnly(c.changedOn) >= cutoff && subsById.has(c.subscriptionId))
        .map(c => {
            const sub = subsById.get(c.subscriptionId);
            return { change: c, sub, impact: priceChangeImpact(c, sub.cycle) };
        })
        .filter(x => !x.sub.paused)
        .sort((a, b) => b.impact.yearly - a.impact.yearly);
}
