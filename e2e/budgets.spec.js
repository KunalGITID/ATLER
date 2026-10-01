import { expect, test } from '@playwright/test';
import { dbRows, goTo, isoDaysAgo, resetDb, signIn } from './helpers.js';

test('everyday expenses count toward their category budget', async ({ page, request }) => {
    await resetDb(request, {
        categories: [{ id: 'cat_food', name: 'Food', budget: 3000 }],
        subscriptions: [{
            id: 'sub-swiggy', name: 'Swiggy One', cycle: 'Monthly', price: '149.00', date_added: '2026-01-01',
            start_date: '2026-01-05', category: 'cat_food', paused: false, reminder: 'none', last_logged_renewal: isoDaysAgo(0),
        }],
    });
    await signIn(page);

    await page.locator('#fab-btn').click();
    await page.locator('#fab-option-expense').click();
    await page.locator('#exp-name').fill('Groceries');
    await page.locator('#exp-amount').fill('1200');
    await page.locator('#exp-category').selectOption({ label: 'Food' });
    await page.locator('#add-expense-form button[type="submit"]').click();

    await expect.poll(async () => (await dbRows(request, 'expenses')).map(e => [e.name, e.category]))
        .toEqual([['Groceries', 'cat_food']]);

    await goTo(page, 'analytics-page');
    const card = page.locator('.budget-card', { hasText: 'Food' });
    await expect(card).toContainText('₹149.00 subscriptions · ₹1,200.00 everyday this month');
    await expect(card).toContainText('45% used');
});

test('deleting a category moves its expenses to Unlisted', async ({ page, request }) => {
    await resetDb(request, {
        categories: [{ id: 'cat_food', name: 'Food', budget: null }],
        expenses: [{ id: 'e1', name: 'Lunch', amount: 150, date: isoDaysAgo(1), type: 'manual', category: 'cat_food' }],
    });
    await signIn(page);
    await goTo(page, 'analytics-page');
    await page.locator('#toggle-manage-categories-btn').click();
    await page.locator('#active-category-chips > div', { hasText: 'Food' }).locator('.material-symbols-outlined').click();
    await page.locator('#confirm-ok-btn').click();

    await expect.poll(async () => (await dbRows(request, 'categories')).length).toBe(0);
    expect((await dbRows(request, 'expenses'))[0].category).toBe('unlisted');
});
