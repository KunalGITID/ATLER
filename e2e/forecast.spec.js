import { expect, test } from '@playwright/test';
import { goTo, isoDaysAgo, resetDb, signIn } from './helpers.js';

const monthsAgo = (n, day) => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - n, day).toLocaleDateString('en-CA');
};

test('analytics shows next month: renewals plus the everyday range', async ({ page, request }) => {
    await resetDb(request, {
        subscriptions: [{
            id: 'sub-n', name: 'Netflix', cycle: 'Monthly', price: '199.00', date_added: '2026-01-01',
            start_date: '2026-01-05', category: 'unlisted', paused: false, reminder: 'none', last_logged_renewal: isoDaysAgo(0),
        }],
        expenses: [
            { id: 'e1', name: 'Groceries', amount: 2000, date: monthsAgo(2, 10), type: 'manual' },
            { id: 'e2', name: 'Groceries', amount: 3000, date: monthsAgo(1, 10), type: 'manual' },
        ],
    });
    await signIn(page);
    await goTo(page, 'analytics-page');

    const next = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString('en-IN', { month: 'long' });
    await expect(page.locator('#forecast-title')).toHaveText(`${next} Forecast`);
    await expect(page.locator('#forecast-total')).toHaveText('₹2,699.00');
    await expect(page.locator('#forecast-range')).toHaveText('Probably between ₹2,199.00 and ₹3,199.00');
    await expect(page.locator('#forecast-fixed-note')).toContainText('1 renewal, biggest Netflix on 5');
});
