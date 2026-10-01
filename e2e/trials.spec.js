import { expect, test } from '@playwright/test';
import { dbRows, goTo, resetDb, signIn } from './helpers.js';

const inDays = n => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
};

test('a free trial bills nothing until it ends and is flagged before it converts', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await page.locator('#fab-btn').click();
    await page.locator('#fab-option-sub').click();
    await page.locator('#add-name').fill('Spotify');
    await page.locator('#add-is-trial').check();
    await expect(page.locator('#add-price-label')).toHaveText('Price after the trial (₹)');
    await page.locator('#add-price').fill('119');
    await page.locator('#add-trial-ends').fill(inDays(2));
    await page.locator('#add-form button[type="submit"]').click();

    await expect.poll(async () => (await dbRows(request, 'subscriptions')).map(s => [s.trial_ends, s.start_date]))
        .toEqual([[inDays(2), inDays(2)]]);
    expect(await dbRows(request, 'expenses')).toEqual([]); // nothing charged during the trial

    await goTo(page, 'dashboard-page');
    await expect(page.locator('#portfolio-list .trial-badge')).toContainText('Trial · ends');
    await expect(page.locator('#insights-content')).toContainText("Spotify's trial ends in 2 days, then it's ₹119.00 monthly.");
});

test('a trial end date in the past is rejected', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await page.locator('#fab-btn').click();
    await page.locator('#fab-option-sub').click();
    await page.locator('#add-name').fill('Spotify');
    await page.locator('#add-is-trial').check();
    await page.locator('#add-price').fill('119');
    await page.locator('#add-trial-ends').fill(inDays(-1));
    await page.locator('#add-form button[type="submit"]').click();
    await expect(page.locator('#toast')).toHaveText('Pick a trial end date after today');
    expect(await dbRows(request, 'subscriptions')).toEqual([]);
});
