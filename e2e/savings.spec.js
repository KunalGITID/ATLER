import { expect, test } from '@playwright/test';
import { dbRows, goTo, isoDaysAgo, openSubscription, resetDb, signIn } from './helpers.js';

const hotstar = o => ({
    id: 'sub-h', name: 'Hotstar', cycle: 'Monthly', price: '299.00', date_added: '2026-01-01', start_date: '2026-01-05',
    category: 'unlisted', paused: false, reminder: 'none', last_logged_renewal: isoDaysAgo(0), ...o,
});

test('cancelling keeps the plan and starts counting savings', async ({ page, request }) => {
    await resetDb(request, { subscriptions: [hotstar()] });
    await signIn(page);
    await openSubscription(page, 'Hotstar');
    await page.locator('#cancel-sub-btn').click();

    await expect(page.locator('#toast')).toHaveText("Nice. That's ₹3,588.00 a year you keep.");
    await expect(page.locator('#cancel-label')).toContainText('Restart');
    await expect(page.locator('#pause-sub-btn')).toBeHidden();
    const [row] = await dbRows(request, 'subscriptions');
    expect([row.paused, row.cancelled_on]).toEqual([true, isoDaysAgo(0)]);
});

test('savings card totals renewals skipped since cancelling, and restart undoes it', async ({ page, request }) => {
    const longAgo = new Date();
    longAgo.setMonth(longAgo.getMonth() - 3);
    longAgo.setDate(1);
    await resetDb(request, { subscriptions: [hotstar({ paused: true, cancelled_on: longAgo.toLocaleDateString('en-CA') })] });
    await signIn(page);
    await goTo(page, 'analytics-page');
    await expect(page.locator('#savings-section')).toBeVisible();
    await expect(page.locator('#savings-note')).toHaveText('from 1 cancelled plan');
    await expect(page.locator('#savings-yearly')).toHaveText('₹3,588.00');
    // 3 or 4 renewals on the 5th since the 1st three months ago, depending on today's date
    await expect(page.locator('#savings-total')).toHaveText(/₹(897|1,196)\.00/);

    await openSubscription(page, 'Hotstar');
    await page.locator('#cancel-sub-btn').click();
    await expect(page.locator('#toast')).toHaveText('Subscription restarted');
    await expect.poll(async () => (await dbRows(request, 'subscriptions'))[0].cancelled_on).toBeNull();
    expect((await dbRows(request, 'expenses')).length).toBeLessThanOrEqual(1); // never the cancelled months
});
