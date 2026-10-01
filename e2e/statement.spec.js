import { expect, test } from '@playwright/test';
import { dbRows, goTo, resetDb, signIn } from './helpers.js';

// dd/mm/yy, n days before today
const ago = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};
const iso = n => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toLocaleDateString('en-CA');
};

function statement() {
    const rows = ['HDFC BANK Ltd.,,,', 'Statement of accounts,,,', 'Date,Narration,Withdrawal Amt.,Deposit Amt.'];
    for (const n of [95, 64, 33, 3]) rows.push(`${ago(n)},UPI-NETFLIX COM-netflixupi@hdfcbank-6273849${n}-PAYMENT,199.00,`);
    for (const n of [86, 58, 30, 2]) rows.push(`${ago(n)},POS AIRTEL PREPAID RECHARGE,349.00,`);
    for (const n of [200, 170, 140]) rows.push(`${ago(n)},UPI-GYM MEMBERSHIP-gym@ybl-${n},1500.00,`);
    for (const [n, amt] of [[80, 412], [61, 233], [12, 598]]) rows.push(`${ago(n)},UPI-SWIGGY-swiggy@icici-${n},${amt}.00,`);
    rows.push(`${ago(20)},SALARY,,50000.00`);
    return rows.join('\n');
}

test('finds subscriptions in a bank statement and adds the ticked ones', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await goTo(page, 'profile-page');
    await page.locator('#open-data-modal-btn').click();
    await page.locator('#statement-file-input').setInputFiles({ name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from(statement()) });

    const items = page.locator('#statement-list .statement-item');
    await expect(page.locator('#statement-overlay')).toBeVisible();
    await expect(items).toHaveCount(3); // Swiggy is irregular and left out
    await expect(items.filter({ hasText: 'Netflix' }).locator('input')).toBeChecked();
    await expect(items.filter({ hasText: 'Airtel' })).toContainText('Every 28 days');
    await expect(items.filter({ hasText: 'Gym' })).toContainText('No recent charge');
    await expect(items.filter({ hasText: 'Gym' }).locator('input')).not.toBeChecked();
    await expect(page.locator('#statement-add-btn')).toHaveText('Add 2');

    await page.locator('#statement-add-btn').click();
    await expect(page.locator('#toast')).toHaveText('2 subscriptions added');
    await expect(page.locator('#statement-overlay')).toBeHidden();

    const subs = await dbRows(request, 'subscriptions');
    expect(subs.map(s => [s.name, s.cycle, s.price, s.start_date]).sort()).toEqual([
        ['Airtel', '28', '349.00', iso(2)],
        ['Netflix', 'Monthly', '199.00', iso(3)],
    ]);
    // The charge already paid this period is logged for each.
    await expect.poll(async () => (await dbRows(request, 'expenses')).map(e => [e.name, e.date]).sort())
        .toEqual([['Airtel', iso(2)], ['Netflix', iso(3)]]);
});

test('a file that is not a statement explains itself', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await goTo(page, 'profile-page');
    await page.locator('#open-data-modal-btn').click();
    await page.locator('#statement-file-input').setInputFiles({ name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('a,b\n1,2\n') });
    await expect(page.locator('#toast')).toContainText('Could not find the Date / Description / Debit columns');
});
