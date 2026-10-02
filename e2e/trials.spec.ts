import { expect, test } from '@playwright/test';
import { addPlan, daysFromToday, signIn, tab } from './helpers.ts';

const MOCK = 'http://127.0.0.1:54329';

test.beforeEach(async ({ page, request }) => {
  await request.post(`${MOCK}/__reset`);
  await signIn(page);
});

test('a free trial charges nothing until it ends, and says so everywhere', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name').fill('Spotify');
  await sheet.getByRole('switch', { name: 'Free trial' }).click();
  await expect(sheet.getByLabel('Price after the trial (₹)')).toBeVisible();
  await expect(sheet.getByText('3 days and 1 day before it turns into a charge')).toBeVisible();
  await sheet.getByLabel('Price after the trial (₹)').fill('139');
  await sheet.getByLabel('Trial ends on').fill(daysFromToday(5));
  await sheet.getByRole('button', { name: 'ADD PLAN' }).click();
  await expect(sheet).toBeHidden();

  // Month: nothing spent; the next charge is the trial ending.
  await expect(page.getByRole('link', { name: /Next up Spotify Trial ends in 5 days · ₹139/ })).toBeVisible();
  await tab(page, 'Plans');
  await expect(page.getByRole('region', { name: 'Billing' })).toContainText('Trial · ends');

  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Spotify/ }).click();
  await expect(page.getByText(/^Free trial · converts/)).toBeVisible();
  await expect(page.getByRole('img', { name: /^5 of \d+ days left until the trial ends$/ })).toBeVisible();
  await expect(page.getByText('3 days and 1 day before the trial turns into a charge.')).toBeVisible();
  await expect(page.getByText('Paid so far')).toHaveCount(0);
});

test('a trial end date has to be in the future', async ({ page }) => {
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Name').fill('Spotify');
  await sheet.getByRole('switch', { name: 'Free trial' }).click();
  await sheet.getByLabel('Price after the trial (₹)').fill('139');
  await sheet.getByLabel('Trial ends on').fill(daysFromToday(0));
  await sheet.getByRole('button', { name: 'ADD PLAN' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('Pick the day the trial ends (after today).');
});

test('the reminder choice is saved and synced', async ({ page, request }) => {
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-10) });
  await tab(page, 'Plans');
  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Netflix/ }).click();
  await page.getByRole('radiogroup', { name: 'Remind me before it renews' }).getByRole('radio', { name: '1 day' }).click();
  await expect(page.getByRole('radio', { name: '1 day' })).toHaveAttribute('aria-checked', 'true');
  await tab(page, 'You');
  await expect(page.getByRole('status').filter({ hasText: /^Synced/ })).not.toContainText('waiting');
  const server = await (await request.get(`${MOCK}/__db`)).json();
  expect(server.plans.map((p: { name: string; remind: string }) => [p.name, p.remind])).toEqual([['Netflix', '1d']]);
});
