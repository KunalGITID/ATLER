import { expect, test } from '@playwright/test';
import { dbRows, goTo, isoDaysAgo, openSubscription, resetDb, signIn } from './helpers.js';

const spotify = {
    id: 'sub-spotify', name: 'Spotify', cycle: 'Monthly', price: '119.00', date_added: '2026-01-01',
    start_date: '2026-01-05', category: 'unlisted', paused: false, reminder: 'none', last_logged_renewal: isoDaysAgo(0),
};

test('editing the price records it and shows the history and an insight', async ({ page, request }) => {
    await resetDb(request, { subscriptions: [spotify] });
    await signIn(page);
    await openSubscription(page, 'Spotify');
    await expect(page.locator('#detail-price-history')).toBeHidden();

    await page.locator('#edit-price').fill('139');
    await page.locator('#edit-form button[type="submit"]').click();

    await expect(page.locator('#detail-price-history')).toBeVisible();
    await expect(page.locator('#detail-price-history-list')).toContainText('₹119.00 → ₹139.00');
    await expect(page.locator('#detail-price-history-list')).toContainText('+17%');
    await expect.poll(async () => (await dbRows(request, 'price_changes')).map(c => [c.old_price, c.new_price]))
        .toEqual([[119, 139]]);

    await goTo(page, 'dashboard-page');
    await expect(page.locator('#insights-content')).toContainText("Spotify went from ₹119.00 to ₹139.00 (+17%). That's ₹240.00 more a year.");
});

test('the reminder buttons on the details card save the choice', async ({ page, request }) => {
    await resetDb(request, { subscriptions: [spotify] });
    await signIn(page);
    await openSubscription(page, 'Spotify');
    await page.locator('#detail-reminder-group .reminder-pill[data-reminder="1"]').click();

    await expect.poll(async () => (await dbRows(request, 'subscriptions'))[0].reminder).toBe('1day');
    await expect(page.locator('#detail-reminder-group .reminder-pill[data-reminder="1"]')).toHaveClass(/active/);
});
