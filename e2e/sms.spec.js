import { expect, test } from '@playwright/test';
import { dbRows, resetDb, signIn } from './helpers.js';

async function openSmsPaste(page) {
    await page.locator('#fab-btn').click();
    await page.locator('#fab-option-expense').click();
    await page.locator('#sms-paste summary').click();
}

test('one pasted SMS fills the expense form', async ({ page, request }) => {
    await resetDb(request, { categories: [{ id: 'cat_food', name: 'Food', budget: null }] });
    await signIn(page);
    await openSmsPaste(page);
    await page.locator('#sms-text').fill('Rs.250.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici (UPI Ref No 627384910283).');
    await page.locator('#sms-read-btn').click();

    await expect(page.locator('#exp-name')).toHaveValue('Swiggy');
    await expect(page.locator('#exp-amount')).toHaveValue('250');
    await expect(page.locator('#exp-date')).toHaveValue('2026-10-01');
    await expect(page.locator('#exp-category')).toHaveValue('cat_food');
    await page.locator('#add-expense-form button[type="submit"]').click();
    await expect.poll(async () => (await dbRows(request, 'expenses')).map(e => [e.name, e.amount, e.category]))
        .toEqual([['Swiggy', 250, 'cat_food']]);
});

test('several pasted messages are added together after a confirm', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await openSmsPaste(page);
    await page.locator('#sms-text').fill([
        'Rs.250.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici (UPI Ref No 1).',
        'Your OTP is 123456',
        'Sent Rs.1,499.00 From HDFC Bank A/C *1234 To AMAZON PAY On 02/10/26 Ref 2',
    ].join('\n'));
    await page.locator('#sms-read-btn').click();
    await expect(page.locator('#confirm-message')).toHaveText('Add 2 expenses totalling ₹1,749.00?');
    await page.locator('#confirm-ok-btn').click();
    await expect(page.locator('#toast')).toHaveText('2 expenses added');
    expect((await dbRows(request, 'expenses')).map(e => e.name).sort()).toEqual(['Amazon Pay', 'Swiggy']);
});

test('a non-debit SMS is rejected', async ({ page, request }) => {
    await resetDb(request);
    await signIn(page);
    await openSmsPaste(page);
    await page.locator('#sms-text').fill('Rs.500.00 credited to a/c **1234 by VPA friend@okaxis');
    await page.locator('#sms-read-btn').click();
    await expect(page.locator('#toast')).toHaveText("That doesn't look like a debit SMS");
});
