import { describe, expect, it } from 'vitest';
import { priceChangeImpact, recentIncreases } from '../src/lib/prices.js';

describe('priceChangeImpact', () => {
    it('monthly plan', () => {
        expect(priceChangeImpact({ oldPrice: 119, newPrice: 139 }, 'Monthly')).toEqual({ monthly: 20, yearly: 240, percent: 17 });
    });

    it('yearly plan is spread per month', () => {
        const r = priceChangeImpact({ oldPrice: 1200, newPrice: 1500 }, 'Yearly');
        expect(r.monthly).toBeCloseTo(25);
        expect(r.yearly).toBeCloseTo(300);
        expect(r.percent).toBe(25);
    });

    it('a price cut is negative', () => {
        expect(priceChangeImpact({ oldPrice: 200, newPrice: 150 }, 'Monthly').yearly).toBe(-600);
    });
});

describe('recentIncreases', () => {
    const subs = new Map([
        ['a', { id: 'a', name: 'Spotify', cycle: 'Monthly', paused: false }],
        ['b', { id: 'b', name: 'Prime', cycle: 'Yearly', paused: false }],
        ['c', { id: 'c', name: 'Old gym', cycle: 'Monthly', paused: true }],
    ]);
    const today = new Date(2026, 9, 1);
    const change = (subscriptionId, oldPrice, newPrice, changedOn) => ({ subscriptionId, oldPrice, newPrice, changedOn });

    it('keeps recent increases on active plans, largest yearly impact first', () => {
        const out = recentIncreases([
            change('a', 119, 139, '2026-09-20'),
            change('b', 1499, 1999, '2026-09-01'),
            change('a', 99, 119, '2026-03-01'),   // too old
            change('a', 139, 129, '2026-09-25'),  // a cut
            change('c', 500, 800, '2026-09-25'),  // paused
            change('zz', 1, 2, '2026-09-25'),     // deleted subscription
        ], subs, today);
        expect(out.map(x => [x.sub.name, Math.round(x.impact.yearly)])).toEqual([['Prime', 500], ['Spotify', 240]]);
    });
});
