import { describe, expect, it } from 'vitest';
import { budgetUsage, expenseCategory } from '../src/lib/budgets.js';

const today = new Date(2026, 9, 15);
const cats = [
    { id: 'food', name: 'Food', budget: 3000 },
    { id: 'fun', name: 'Fun', budget: 500 },
    { id: 'misc', name: 'Misc', budget: null },
];
const subs = [
    { id: 'sub_1', category: 'fun', price: '199', cycle: 'Monthly', paused: false },
    { id: 'sub_2', category: 'fun', price: '1200', cycle: 'Yearly', paused: false },
    { id: 'sub_3', category: 'fun', price: '999', cycle: 'Monthly', paused: true },
];

describe('budgetUsage', () => {
    it('adds subscriptions (per month) and this month\'s everyday spending', () => {
        const usage = budgetUsage(cats, subs, [
            { id: 'a', type: 'manual', category: 'food', amount: 1200, date: '2026-10-02' },
            { id: 'b', type: 'manual', category: 'food', amount: 800, date: '2026-10-10' },
            { id: 'c', type: 'manual', category: 'food', amount: 5000, date: '2026-09-30' }, // last month
            { id: 'd', type: 'manual', category: 'fun', amount: 250, date: '2026-10-03' },
            { id: 'auto_sub_1_2026-10-05', type: 'auto', amount: 199, date: '2026-10-05' }, // counted via the sub
        ], today);
        expect(usage.map(u => [u.name, u.recurring, u.everyday, u.spent, u.over])).toEqual([
            ['Fun', 299, 250, 549, true],
            ['Food', 0, 2000, 2000, false],
        ]);
        expect(usage[1]).toMatchObject({ remaining: 1000, percent: 67 });
    });
});

describe('expenseCategory', () => {
    const byId = new Map(subs.map(s => [s.id, s]));
    it('uses the subscription\'s category for renewals, even with underscores in its id', () => {
        expect(expenseCategory({ id: 'auto_sub_2_2026-10-01', type: 'auto' }, byId)).toBe('fun');
        expect(expenseCategory({ id: 'auto_gone_2026-10-01', type: 'auto' }, byId)).toBe('unlisted');
        expect(expenseCategory({ id: 'x', type: 'manual', category: 'food' }, byId)).toBe('food');
        expect(expenseCategory({ id: 'y', type: 'manual' }, byId)).toBe('unlisted');
    });
});
