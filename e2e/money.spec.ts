import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn, tab } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
});

async function openAdd(page: Page, kind: 'Plan' | 'Expense' | 'Income') {
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: kind }).click();
  return sheet;
}

test('rent paid by hand shows up to pay; marking it paid clears it, undo brings it back', async ({ page }) => {
  const sheet = await openAdd(page, 'Plan');
  await sheet.getByLabel('Name').fill('Flat rent');
  await sheet.getByLabel('Amount (₹)').fill('25000');
  await sheet.getByLabel('Last charged on').fill(daysFromToday(-27));
  await sheet.getByText('+ More options').click();
  await sheet.getByLabel('Type').selectOption({ label: 'Rent' });
  await expect(sheet.getByRole('switch', { name: 'Paid automatically' })).toHaveAttribute('aria-checked', 'false');
  await sheet.getByRole('button', { name: 'ADD PLAN' }).click();
  await expect(sheet).toBeHidden();

  const toPay = page.getByRole('region', { name: /To pay/ });
  await expect(toPay).toContainText('Flat rent · ₹25,000');
  await toPay.getByRole('button', { name: 'Mark paid' }).click();
  await expect(toPay).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('region', { name: /To pay/ })).toContainText('Flat rent');
});

test('a plan shared four ways counts your share; a dollar plan shows both prices', async ({ page }) => {
  let sheet = await openAdd(page, 'Plan');
  await sheet.getByLabel('Name').fill('Netflix Premium');
  await sheet.getByLabel('Amount (₹)').fill('649');
  await sheet.getByLabel('Last charged on').fill(daysFromToday(-3));
  await sheet.getByText('+ More options').click();
  await sheet.getByLabel('People sharing it (you included)').fill('4');
  await expect(sheet.getByText('Your share: ₹162.25 of ₹649.')).toBeVisible();
  await sheet.getByRole('button', { name: 'ADD PLAN' }).click();

  sheet = await openAdd(page, 'Plan');
  await sheet.getByLabel('Name').fill('ChatGPT');
  await sheet.getByLabel('Currency').selectOption('USD');
  await sheet.getByLabel('Amount (USD)').fill('20');
  await sheet.getByLabel('₹ per 1 USD').fill('85');
  await expect(sheet.getByText('≈ ₹1,700')).toBeVisible();
  await sheet.getByLabel('Last charged on').fill(daysFromToday(-3));
  await sheet.getByRole('button', { name: 'ADD PLAN' }).click();

  await tab(page, 'Plans');
  await expect(page.getByText('₹1,862.25/mo').first()).toBeVisible(); // 162.25 + 1,700
  await page.getByRole('link', { name: /Netflix Premium/ }).click();
  await expect(page.getByText('your share of ₹649, split 4 ways')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('link', { name: /ChatGPT/ }).click();
  await expect(page.getByText(/\$20 billed \(₹1,700\)/)).toBeVisible();
  await expect(page.getByRole('link', { name: /ChatGPT’s account page/ })).toHaveAttribute('href', /chatgpt\.com/);
});

test('income and goals: what is left this month, and saving toward a goal', async ({ page }) => {
  const sheet = await openAdd(page, 'Income');
  await sheet.getByLabel('From').fill('Salary');
  await sheet.getByLabel('Amount (₹)').fill('80000');
  await sheet.getByLabel('First paid on').fill(`${daysFromToday(0).slice(0, 8)}01`);
  await sheet.getByRole('button', { name: 'ADD INCOME' }).click();
  await addExpense(page, { name: 'Groceries', amount: '2000', on: daysFromToday(0) });

  await expect(page.getByRole('link', { name: /This month: ₹80,000 income, ₹78,000 left/ })).toBeVisible();
  await page.getByRole('link', { name: 'Income & goals ›' }).click();
  const panel = page.getByRole('dialog', { name: 'Income & goals' });
  await expect(panel).toContainText('₹78,000');
  await expect(panel).toContainText('98% saved');

  await panel.getByRole('button', { name: 'Add a goal' }).click();
  const goal = page.getByRole('dialog', { name: 'New goal' });
  await goal.getByLabel('Saving for').fill('Laptop');
  await goal.getByLabel('Amount needed (₹)').fill('90000');
  await goal.getByLabel('Saved so far (₹)').fill('30000');
  await goal.getByRole('button', { name: 'SAVE' }).click();
  await expect(panel.getByRole('img', { name: /Laptop: 33% saved/ })).toBeVisible();
  await panel.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog', { name: 'Add to Laptop' }).getByLabel('Amount (₹)').fill('15000');
  await page.getByRole('dialog', { name: 'Add to Laptop' }).getByRole('button', { name: 'ADD' }).click();
  await expect(panel.getByRole('img', { name: /Laptop: 50% saved/ })).toBeVisible();
});

test('a split expense counts your part; who owes you settles up; tags filter', async ({ page }) => {
  const sheet = await openAdd(page, 'Expense');
  await sheet.getByLabel('What for').fill('Goa dinner');
  await sheet.getByLabel('Amount (₹)').fill('3000');
  await sheet.getByLabel('Date').fill(daysFromToday(0));
  await sheet.getByText('+ More options').click();
  await sheet.getByLabel('Tags').fill('goa, friends');
  await sheet.getByLabel('Note').fill('Beach shack');
  await sheet.getByLabel('Split with').fill('Asha, Ravi');
  await expect(sheet.getByText('each owes you ₹1,000; your part is ₹1,000')).toBeVisible();
  await sheet.getByRole('button', { name: 'ADD EXPENSE' }).click();
  await addExpense(page, { name: 'Bus ticket', amount: '400', on: daysFromToday(0) });

  await page.getByRole('link', { name: 'What I spent ›' }).click();
  const panel = page.getByRole('dialog', { name: 'What I spent' });
  await expect(panel.getByRole('region', { name: 'Today' })).toContainText('₹1,400');
  await expect(panel.getByRole('button', { name: /Goa dinner/ })).toContainText('#goa');
  await expect(panel.getByRole('button', { name: /Goa dinner/ })).toContainText('Beach shack');

  await panel.getByLabel('Only tag').selectOption('goa');
  await expect(panel.getByRole('button', { name: /Bus ticket/ })).toHaveCount(0);
  await expect(panel.getByRole('status').filter({ hasText: 'matches' })).toContainText('₹1,000 matches');
  await panel.getByRole('button', { name: 'Clear' }).click();
  await panel.getByLabel('Search this month').fill('bus');
  await expect(panel.getByRole('button', { name: /Goa dinner/ })).toHaveCount(0);
  await panel.getByLabel('Search this month').fill('');

  const owed = panel.getByRole('region', { name: 'Owed to you' });
  await expect(owed).toContainText('Asha');
  await expect(owed).toContainText('Ravi');
  await owed.getByRole('listitem').filter({ hasText: 'Asha' }).getByRole('button', { name: 'Settle up' }).click();
  await expect(owed).not.toContainText('Asha');
  await expect(owed).toContainText('Ravi');
});

test('ask answers from your own data', async ({ page }) => {
  await addPlan(page, { name: 'Netflix', amount: '649', lastCharged: daysFromToday(-3) });
  await addExpense(page, { name: 'Swiggy', amount: '450', on: daysFromToday(0) });
  await page.getByRole('link', { name: 'Ask ›' }).click();
  const panel = page.getByRole('dialog', { name: 'Ask about your money' });
  await panel.getByLabel('Your question').fill('what if I cancel netflix?');
  await panel.getByRole('button', { name: 'ASK', exact: true }).click();
  await expect(panel.getByRole('status')).toHaveText('Cancelling Netflix keeps ₹7,788 a year (₹649 a month).');
  await panel.getByRole('button', { name: 'How much do my subscriptions cost?' }).click();
  await expect(panel.getByRole('status')).toHaveText('Your plans cost ₹649 a month, ₹7,788 a year.');
});

test('import expenses from a Walnut export, skipping ones already here', async ({ page }) => {
  await addExpense(page, { name: 'Swiggy', amount: '450', on: '2026-09-04' });
  await tab(page, 'You');
  const csv = `DATE,TIME,PLACE,AMOUNT,DR/CR,ACCOUNT,EXPENSE,INCOME,CATEGORY,TAGS,NOTE
04-09-26,08:15 PM,SWIGGY BANGALORE,450.00,DR,HDFC,Yes,No,Food,,
05-09-26,09:00 AM,UBER INDIA,220.00,DR,HDFC,Yes,No,Travel,work,
06-09-26,10:00 AM,SALARY,90000.00,CR,HDFC,No,Yes,Income,,`;
  await page.getByLabel('Expenses file').setInputFiles({ name: 'walnut.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const sheet = page.getByRole('dialog', { name: 'Import expenses' });
  await expect(sheet).toContainText('Walnut export');
  await expect(sheet).toContainText('1 new expense, ₹220 · 1 already in ATLER · 1 rows skipped');
  await sheet.getByRole('button', { name: 'ADD 1' }).click();
  await expect(page.getByText('1 expense added.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Travel/ })).toBeVisible(); // its category was added
});

test('a password-locked backup restores only with its password', async ({ page }) => {
  await addPlan(page, { name: 'Spotify', amount: '119', lastCharged: daysFromToday(-3) });
  await tab(page, 'You');
  await page.getByRole('button', { name: 'Locked backup' }).click();
  const lockSheet = page.getByRole('dialog', { name: 'Lock the backup' });
  await lockSheet.getByLabel('Password', { exact: true }).fill('river-stone-42');
  await lockSheet.getByLabel('Same password again').fill('river-stone-42');
  const download = page.waitForEvent('download');
  await lockSheet.getByRole('button', { name: 'DOWNLOAD' }).click();
  const text = readFileSync(await (await download).path(), 'utf8');
  expect(text).not.toContain('Spotify');

  await page.getByLabel('Backup file').setInputFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(text) });
  const pw = page.getByRole('dialog', { name: 'Backup password' });
  await pw.getByLabel('Password').fill('wrong-password');
  await pw.getByRole('button', { name: 'OPEN' }).click();
  await expect(pw.getByRole('alert')).toHaveText('That password doesn’t open this backup.');
  await pw.getByLabel('Password').fill('river-stone-42');
  await pw.getByRole('button', { name: 'OPEN' }).click();
  const restore = page.getByRole('dialog', { name: 'Restore this backup?' });
  await expect(restore).toContainText('1 plans');
  await restore.getByRole('button', { name: /RESTORE/ }).click();
  await expect(page.getByText(/Restored \d+ items?\./)).toBeVisible();
});

test('home flags a forgotten subscription and an expense logged twice', async ({ page, request }) => {
  const long = daysFromToday(-250);
  const row = { updated_at: 1, deleted: false };
  await request.post('http://127.0.0.1:54329/__seed', { data: {
    plans: [{ ...row, id: '00000000-0000-4000-8000-00000000c001', name: 'Gym app', price: 49900, cycle_unit: 'month', cycle_every: 1, anchor: long, category_id: null,
      status: 'active', trial_ends: null, remind: 'off', created_on: long, revision: 1 }],
    payments: [
      { ...row, id: '00000000-0000-4000-8000-00000000d001', name: 'Chai', amount: 4000, on: daysFromToday(-1), category_id: null, source: 'sms', revision: 2 },
      { ...row, id: '00000000-0000-4000-8000-00000000d002', name: 'Chai', amount: 4000, on: daysFromToday(-1), category_id: null, source: 'manual', revision: 3 },
    ],
  } });
  await page.reload();

  await expect(page.getByText('Still using it?')).toBeVisible();
  await page.getByRole('button', { name: 'Yes, I use it' }).click();
  await expect(page.getByText('Still using it?')).toHaveCount(0);

  await expect(page.getByText('Logged twice?')).toBeVisible();
  await page.getByRole('button', { name: 'Delete the copy' }).click();
  await expect(page.getByText('Logged twice?')).toHaveCount(0);
  await page.getByRole('link', { name: 'What I spent ›' }).click();
  await expect(page.getByRole('dialog', { name: 'What I spent' }).getByRole('button', { name: /Chai/ })).toHaveCount(1);
});
