import { expect, test } from '@playwright/test';
import { isoDaysAgo, resetDb, signIn } from './helpers.js';

test('a much bigger than usual expense gets a heads-up and an insight', async ({ page, request }) => {
    await resetDb(request, {
        categories: [{ id: 'cat_food', name: 'Food', budget: null }],
        expenses: [180, 250, 220, 300, 260, 210].map((amount, i) => ({
            id: `e${i}`, name: 'Swiggy', amount, date: isoDaysAgo(30 + i), type: 'manual', category: 'cat_food',
        })),
    });
    await signIn(page);
    await page.locator('#fab-btn').click();
    await page.locator('#fab-option-expense').click();
    await page.locator('#exp-name').fill('Birthday dinner');
    await page.locator('#exp-amount').fill('1400');
    await page.locator('#exp-category').selectOption({ label: 'Food' });
    await page.locator('#add-expense-form button[type="submit"]').click();

    await expect(page.locator('#toast')).toHaveText("Saved. Heads up: that's 6.0× your usual Food spend (₹235.00)");
    await expect(page.locator('#insights-content')).toContainText('₹1,400.00 on Birthday dinner is 6.0× your usual Food spend of ₹235.00.');
});
