import { expect, test } from '@playwright/test';
import { addSubscription, dbRows, failNextWrite, isoDaysAgo, openSubscription, resetDb, signIn } from './helpers.js';

test.beforeEach(async ({ request }) => resetDb(request));

test('adding a subscription saves it and logs the charge already paid this period', async ({ page, request }) => {
    await signIn(page);
    await addSubscription(page, { name: 'Netflix', price: 199, startDate: isoDaysAgo(3) });

    await expect(page.locator('#portfolio-list')).toContainText('Netflix');
    await expect.poll(async () => (await dbRows(request, 'subscriptions')).map(s => s.name)).toEqual(['Netflix']);
    await expect.poll(async () => (await dbRows(request, 'expenses')).map(e => [e.type, e.amount, e.date]))
        .toEqual([['auto', 199, isoDaysAgo(3)]]);
});

test('a subscription that fails to save does not stay on screen', async ({ page, request }) => {
    await signIn(page);
    await failNextWrite(request, 'subscriptions');
    await addSubscription(page, { name: 'Spotify', price: 119 });

    await expect(page.locator('#toast')).toContainText('Could not save');
    await expect(page.locator('#portfolio-list')).not.toContainText('Spotify');
    expect(await dbRows(request, 'subscriptions')).toEqual([]);
    // ...and the failure is reported for debugging.
    await expect.poll(async () => (await dbRows(request, 'error_log')).map(e => [e.kind, e.message]))
        .toEqual([['write', 'mock failure']]);
    const [logged] = await dbRows(request, 'error_log');
    expect(logged.release).toMatch(/^[0-9a-f]{7}$|^dev$/);
});

const seededSub = overrides => ({
    id: 'sub-netflix', name: 'Netflix', cycle: 'Monthly', price: '199.00',
    date_added: '2026-01-01T09:00:00', start_date: '2026-01-05', category: 'unlisted',
    paused: false, reminder: 'none', last_logged_renewal: null, ...overrides,
});

test('renewals missed while the app was closed are all logged on the next open', async ({ page, request }) => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 3);
    const start = lastMonth.toLocaleDateString('en-CA');
    await resetDb(request, { subscriptions: [seededSub({ date_added: start, start_date: start, last_logged_renewal: start })] });
    await signIn(page);

    // Three monthly renewals since the last logged one (the 3rd may be today).
    await expect.poll(async () => (await dbRows(request, 'expenses')).length).toBe(3);
    await expect.poll(async () => (await dbRows(request, 'subscriptions'))[0].last_logged_renewal).not.toBe(start);
});

test('the reminder choice survives a reload', async ({ page, request }) => {
    await resetDb(request, { subscriptions: [seededSub({ last_logged_renewal: isoDaysAgo(0) })] });
    await signIn(page);
    await openSubscription(page, 'Netflix');
    await page.locator('#reminder-both').click();
    await page.locator('#edit-form button[type="submit"]').click();
    await expect.poll(async () => (await dbRows(request, 'subscriptions'))[0].reminder).toBe('both');

    await page.reload();
    await expect(page.locator('#ls-screen')).toBeHidden({ timeout: 15_000 });
    await openSubscription(page, 'Netflix');
    await expect(page.locator('#reminder-both')).toHaveClass(/active/);
});

test('resuming a paused plan does not bill the months it was paused', async ({ page, request }) => {
    const longAgo = new Date();
    longAgo.setMonth(longAgo.getMonth() - 4);
    const start = longAgo.toLocaleDateString('en-CA');
    await resetDb(request, {
        subscriptions: [seededSub({ date_added: start, start_date: start, last_logged_renewal: start, paused: true })],
    });
    await signIn(page);
    expect(await dbRows(request, 'expenses')).toEqual([]);

    await openSubscription(page, 'Netflix');
    await page.locator('#pause-sub-btn').click();
    await expect(page.locator('#pause-label')).toHaveText('Pause Subscription');
    await expect.poll(async () => (await dbRows(request, 'subscriptions'))[0].paused).toBe(false);
    // At most the renewal due today, never the paused months.
    expect((await dbRows(request, 'expenses')).length).toBeLessThanOrEqual(1);
});

test('deleting a subscription removes its renewal logs', async ({ page, request }) => {
    await resetDb(request, {
        subscriptions: [seededSub({ last_logged_renewal: isoDaysAgo(0) })],
        expenses: [
            { id: 'auto_sub-netflix_2026-02-05', name: 'Netflix', amount: 199, date: '2026-02-05', type: 'auto' },
            { id: 'lunch', name: 'Lunch', amount: 150, date: isoDaysAgo(1), type: 'manual' },
        ],
    });
    await signIn(page);
    await openSubscription(page, 'Netflix');
    await page.locator('#delete-sub-btn').click();
    await page.locator('#confirm-ok-btn').click();

    await expect.poll(async () => (await dbRows(request, 'subscriptions')).length).toBe(0);
    expect((await dbRows(request, 'expenses')).map(e => e.id)).toEqual(['lunch']);
});
