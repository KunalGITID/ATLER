import { expect, test } from '@playwright/test';
import { dbRows, goTo, resetDb, signIn } from './helpers.js';

test('adding several categories quickly saves every one', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await goTo(page, 'analytics-page');
    await page.locator('#toggle-manage-categories-btn').click();
    const chips = page.locator('#preset-category-chips > div');
    for (const name of ['Entertainment', 'Productivity', 'Health']) {
        await chips.filter({ hasText: name }).click();
    }
    await expect.poll(async () => (await dbRows(request, 'categories')).map(c => c.name).sort())
        .toEqual(['Entertainment', 'Health', 'Productivity']);
});
