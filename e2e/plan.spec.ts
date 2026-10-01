import { expect, test } from '@playwright/test';
import { addPlan, daysFromToday, signIn } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
  // Charged 29 days ago, so the next charge is tomorrow.
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-29) });
});

test('Next up opens the plan with its countdown and payments', async ({ page }) => {
  await page.getByRole('link', { name: /Next up Netflix/ }).click();
  await expect(page.getByRole('heading', { name: 'Netflix' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^1 of \d+ days left until the next charge$/ })).toBeVisible();
  await expect(page.getByText('Paid so far')).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Your month' })).toBeAttached();
});

test('a price change is recorded and shows up as price creep on the month', async ({ page }) => {
  await page.getByRole('link', { name: /Next up Netflix/ }).click();
  await page.getByRole('button', { name: 'Edit' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Amount (₹)').fill('249');
  await expect(sheet.getByText('Recorded as a price change from today')).toBeVisible();
  await sheet.getByRole('button', { name: 'SAVE' }).click();
  await expect(page.getByText('₹249/MO')).toBeVisible();

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('link', { name: /Price creep \+₹600\/yr Netflix went up/ })).toBeVisible();
});

test('pause and resume, then cancel keeps the plan as cancelled', async ({ page }) => {
  await page.getByRole('link', { name: /Next up Netflix/ }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText(/^Paused since/)).toBeVisible();
  await expect(page.getByRole('img', { name: /days left/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('img', { name: /days left/ })).toBeVisible();

  await page.getByRole('button', { name: /I CANCELLED IT/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Yes, I cancelled it' }).click();
  await expect(page.getByText(/^Cancelled /)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Restart' })).toBeVisible();

  // Off the month: nothing coming from a cancelled plan.
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('link', { name: /Next up/ })).toHaveCount(0);
});

test('delete removes the plan everywhere', async ({ page }) => {
  await page.getByRole('link', { name: /Next up Netflix/ }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete for good' }).click();
  await expect(page.getByText('Your month is empty')).toBeVisible();
});

test('a coral dot on the ring opens its plan', async ({ page }) => {
  await page.getByRole('group').getByRole('link', { name: /^Netflix, ₹199 on the \d+$/ }).click();
  await expect(page.getByRole('heading', { name: 'Netflix' })).toBeVisible();
});
