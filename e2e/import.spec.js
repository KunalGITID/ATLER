import { expect, test } from '@playwright/test';
import { dbRows, goTo, resetDb, signIn } from './helpers.js';

test('CSV import skips rows with bad dates or cycles and says so', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await goTo(page, 'profile-page');
    await page.locator('#open-data-modal-btn').click();
    await page.locator('#import-file-input').setInputFiles({
        name: 'subs.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from([
            'Name,Price,Cycle,StartDate',
            'Netflix,199,Monthly,2026-01-05',
            'Gym,1500,30,2026-02-01',
            'Broken date,99,Monthly,05/01/2026',
            'Weekly thing,10,weekly,2026-01-01',
        ].join('\n')),
    });
    await expect(page.locator('#toast')).toHaveText('2 subscriptions imported, 2 skipped');
    expect((await dbRows(request, 'subscriptions')).map(s => s.name).sort()).toEqual(['Gym', 'Netflix']);
});
