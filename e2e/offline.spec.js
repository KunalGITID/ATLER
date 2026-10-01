import { expect, test } from '@playwright/test';
import { dbRows, isoDaysAgo, resetDb, signIn } from './helpers.js';

async function addExpense(page, name, amount) {
    await page.locator('#fab-btn').click();
    await page.locator('#fab-option-expense').click();
    await page.locator('#exp-name').fill(name);
    await page.locator('#exp-amount').fill(String(amount));
    await page.locator('#add-expense-form button[type="submit"]').click();
}

test('expenses added offline are kept and synced when back online', async ({ page, context, request }) => {
    await resetDb(request);
    await signIn(page);
    await context.setOffline(true);

    await addExpense(page, 'Chai', 40);
    await expect(page.locator('#toast')).toContainText("You're offline. Saved on this phone");
    await addExpense(page, 'Auto', 60);
    expect(await dbRows(request, 'expenses')).toEqual([]);

    await context.setOffline(false);
    await expect(page.locator('#toast')).toHaveText('Offline changes synced');
    expect((await dbRows(request, 'expenses')).map(e => e.name)).toEqual(['Chai', 'Auto']);
});

test.describe('with the service worker', () => {
    test.use({ serviceWorkers: 'allow' });

    test('the app opens offline with the last data and a queued change survives a restart', async ({ page, context, request }) => {
        await resetDb(request, {
            subscriptions: [{
                id: 'sub-n', name: 'Netflix', cycle: 'Monthly', price: '199.00', date_added: '2026-01-01',
                start_date: '2026-01-05', category: 'unlisted', paused: false, reminder: 'none', last_logged_renewal: isoDaysAgo(0),
            }],
        });
        await signIn(page);
        await expect(page.locator('#portfolio-list')).toContainText('Netflix');
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload(); // let the worker control the page and cache the shell
        await expect(page.locator('#portfolio-list')).toContainText('Netflix');

        await context.setOffline(true);
        await addExpense(page, 'Chai', 40);
        await page.waitForTimeout(600); // snapshot is saved after a short debounce

        await page.reload();
        await expect(page.locator('#ls-screen')).toBeHidden({ timeout: 15_000 });
        await expect(page.locator('#auth-screen')).toBeHidden(); // still signed in
        await expect(page.locator('#portfolio-list')).toContainText('Netflix');
        expect(await dbRows(request, 'expenses')).toEqual([]);

        await context.setOffline(false);
        await expect.poll(async () => (await dbRows(request, 'expenses')).map(e => e.name)).toEqual(['Chai']);
    });
});
