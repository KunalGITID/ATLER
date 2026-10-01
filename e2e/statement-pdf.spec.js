import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { goTo, resetDb, signIn } from './helpers.js';
import { makeStatementPdf } from './statement-pdf.js';

const ago = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};

async function pickStatement(page, file) {
    await goTo(page, 'profile-page');
    await page.locator('#open-data-modal-btn').click();
    await page.locator('#statement-file-input').setInputFiles(file);
}

test('finds subscriptions in a PDF statement, not the salary', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    const rows = [];
    for (const n of [95, 64, 33, 3]) rows.push([ago(n), 'UPI-NETFLIX COM-netflixupi@hdfcbank-1', '199.00', '', '']);
    for (const n of [86, 58, 30, 2]) rows.push([ago(n), 'POS AIRTEL PREPAID RECHARGE', '349.00', '', '']);
    for (const n of [80, 50, 20]) rows.push([ago(n), 'SALARY CREDIT', '', '50000.00', '']);
    await pickStatement(page, { name: 'statement.pdf', mimeType: 'application/pdf', buffer: await makeStatementPdf(rows) });

    const items = page.locator('#statement-list .statement-item');
    await expect(items).toHaveCount(2, { timeout: 15_000 });
    await expect(items.filter({ hasText: 'Netflix' })).toContainText('₹199.00 · Monthly');
    await expect(items.filter({ hasText: 'Airtel' })).toContainText('Every 28 days');
    await expect(page.locator('#statement-summary')).toContainText('in 8 debits'); // the 3 salary credits aren't debits
});

test('a password-protected PDF asks for the password', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await pickStatement(page, { name: 'locked.pdf', mimeType: 'application/pdf', buffer: readFileSync('e2e/fixtures/statement-locked.pdf') });

    await expect(page.locator('#statement-title')).toHaveText('Password needed', { timeout: 15_000 });
    await page.locator('#statement-password').fill('wrong');
    await page.locator('#statement-password-form button').click();
    await expect(page.locator('#statement-summary')).toContainText('That password is not right.');

    await page.locator('#statement-password').fill('01011990');
    await page.locator('#statement-password-form button').click();
    await expect(page.locator('#statement-title')).toHaveText('Found in your statement');
    await expect(page.locator('#statement-list .statement-item')).toContainText('Spotify');
});
