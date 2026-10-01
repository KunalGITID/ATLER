import { describe, expect, it } from 'vitest';
import { recentUnusual, unusualness } from '../src/lib/anomalies.js';

const food = (id, amount, date = '2026-09-01') => ({ id, name: 'Food stuff', amount, date, type: 'manual', category: 'cat_food' });
const usual = [food('a', 180), food('b', 250), food('c', 220), food('d', 300), food('e', 260), food('f', 210)];

describe('unusualness', () => {
    it('flags a spend far above the usual for that category', () => {
        const r = unusualness(food('x', 1400), usual);
        expect(r.compared).toBe(6);
        expect(r.median).toBe(235);
        expect(r.ratio).toBeCloseTo(5.96, 1);
    });

    it('leaves normal and mildly high spends alone', () => {
        expect(unusualness(food('x', 320), usual)).toBeNull();
        expect(unusualness(food('x', 400), usual)).toBeNull(); // above the fence but under 2x the median
    });

    it('needs enough history, a minimum amount, and ignores renewals', () => {
        expect(unusualness(food('x', 5000), usual.slice(0, 4))).toBeNull();
        const tiny = ['a', 'b', 'c', 'd', 'e'].map(id => ({ ...food(id, 20), category: 'cat_tea' }));
        expect(unusualness({ ...food('x', 150), category: 'cat_tea' }, tiny)).toBeNull(); // under ₹200
        expect(unusualness({ ...food('x', 1400), type: 'auto' }, usual)).toBeNull();
    });

    it('unlisted expenses compare against the same merchant name', () => {
        const cabs = [90, 120, 100, 110, 95].map((a, i) => ({ id: `u${i}`, name: 'Uber', amount: a, type: 'manual', category: 'unlisted', date: '2026-09-01' }));
        const other = { id: 'z', name: 'Croma', amount: 50000, type: 'manual', category: 'unlisted', date: '2026-09-01' };
        expect(unusualness({ id: 'n', name: ' uber ', amount: 650, type: 'manual', category: 'unlisted' }, [...cabs, other]).compared).toBe(5);
    });
});

describe('recentUnusual', () => {
    it('only looks at the last week and judges each against what came before', () => {
        const today = new Date(2026, 9, 15);
        const list = recentUnusual([...usual, food('old', 2000, '2026-09-20'), food('new', 1500, '2026-10-12')], today);
        expect(list.map(x => x.exp.id)).toEqual(['new']);
    });
});
