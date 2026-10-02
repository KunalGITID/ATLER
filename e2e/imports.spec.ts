import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { signIn, tab } from './helpers.ts';
import { makeStatementPdf } from './statementPdf.ts';

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
});

// dd/mm/yy, n days before today
const ago = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`;
};

function statementRows(): string[][] {
  const rows: string[][] = [];
  for (const n of [95, 64, 33, 3]) rows.push([ago(n), 'UPI-NETFLIX COM-netflixupi@hdfcbank-1', '199.00', '', '']);
  for (const n of [86, 58, 30, 2]) rows.push([ago(n), 'POS AIRTEL PREPAID RECHARGE', '349.00', '', '']);
  for (const n of [200, 170, 140]) rows.push([ago(n), 'UPI-GYM MEMBERSHIP-gym@ybl-1', '1500.00', '', '']);
  for (const [n, amt] of [[80, '412.00'], [61, '233.00'], [12, '598.00']] as const) rows.push([ago(n), 'UPI-SWIGGY-swiggy@icici-1', amt, '', '']);
  rows.push([ago(20), 'SALARY CREDIT', '', '50000.00', '']);
  return rows;
}

async function choose(page: Page, file: { name: string; mimeType: string; buffer: Buffer }) {
  await tab(page, 'You');
  await page.getByLabel('Bank statement file').setInputFiles(file);
}

test('a CSV statement: review what repeats and add the ticked ones', async ({ page }) => {
  const csv = ['HDFC BANK Ltd.,,,', 'Date,Narration,Withdrawal Amt.,Deposit Amt.', ...statementRows().map(r => r.slice(0, 4).join(','))].join('\n');
  await choose(page, { name: 'statement.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });

  const sheet = page.getByRole('dialog', { name: 'Found in your statement' });
  const items = sheet.getByRole('listitem');
  await expect(items).toHaveCount(3); // Swiggy is irregular, the salary isn't a debit
  await expect(items.filter({ hasText: 'Netflix' }).getByRole('checkbox')).toBeChecked();
  await expect(items.filter({ hasText: 'Airtel' })).toContainText('Every 28 days');
  await expect(items.filter({ hasText: 'Gym' })).toContainText('No recent charge');
  await expect(items.filter({ hasText: 'Gym' }).getByRole('checkbox')).not.toBeChecked();
  await sheet.getByRole('button', { name: 'ADD 2' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 plans added.' })).toBeVisible();

  await tab(page, 'Plans');
  const billing = page.getByRole('region', { name: 'Billing' });
  await expect(billing).toContainText('Airtel');
  await expect(billing).toContainText('Netflix');
});

test('a PDF statement reads the same, and the salary is not counted', async ({ page }) => {
  await choose(page, { name: 'statement.pdf', mimeType: 'application/pdf', buffer: await makeStatementPdf(statementRows()) });
  const sheet = page.getByRole('dialog', { name: 'Found in your statement' });
  await expect(sheet.getByRole('listitem')).toHaveCount(3, { timeout: 15_000 });
  await expect(sheet).toContainText('in 14 payments');
});

test('a locked PDF asks for its password', async ({ page }) => {
  await choose(page, { name: 'locked.pdf', mimeType: 'application/pdf', buffer: readFileSync('e2e/fixtures/statement-locked.pdf') });
  const ask = page.getByRole('dialog', { name: 'Password needed' });
  await expect(ask).toBeVisible({ timeout: 15_000 });
  await ask.getByLabel('PDF password').fill('wrong');
  await ask.getByRole('button', { name: 'OPEN' }).click();
  await expect(ask).toContainText('That password is not right.');
  await ask.getByLabel('PDF password').fill('01011990');
  await ask.getByRole('button', { name: 'OPEN' }).click();
  await expect(page.getByRole('dialog', { name: 'Found in your statement' })).toContainText('Spotify');
});

test('one pasted SMS fills the expense; several are added together', async ({ page, request }) => {
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  await sheet.getByRole('button', { name: 'Paste a bank SMS instead' }).click();
  await sheet.getByLabel('Bank SMS').fill('Rs.250.00 debited from a/c **1234 on 01-10-26 to VPA swiggy@icici (UPI Ref No 1).');
  await sheet.getByRole('button', { name: 'Read SMS' }).click();
  await expect(sheet.getByLabel('What for')).toHaveValue('Swiggy');
  await expect(sheet.getByLabel('Amount (₹)')).toHaveValue('250');
  await expect(sheet.getByLabel('Date')).toHaveValue('2026-10-01');
  await sheet.getByRole('button', { name: 'ADD EXPENSE' }).click();

  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  await sheet.getByRole('button', { name: 'Paste a bank SMS instead' }).click();
  await sheet.getByLabel('Bank SMS').fill([
    'Sent Rs.1,499.00 From HDFC Bank A/C *1234 To AMAZON PAY On 02/10/26 Ref 2',
    'Your OTP is 123456',
    'Paid Rs.40 to CHAI POINT via UPI',
  ].join('\n'));
  await sheet.getByRole('button', { name: 'Read SMS' }).click();
  await sheet.getByRole('button', { name: 'ADD 2 · ₹1,539' }).click();
  await expect(sheet).toBeHidden();

  await tab(page, 'You');
  await expect(page.getByRole('status', { name: 'Sync status' }).filter({ hasText: /^Synced/ })).not.toContainText('waiting');
  const server = await (await request.get('http://127.0.0.1:54329/__db')).json();
  expect(server.payments.map((p: { name: string; amount: number }) => [p.name, p.amount]).sort()).toEqual([['Amazon Pay', 149900], ['Chai Point', 4000], ['Swiggy', 25000]]);
});
