import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { addPlan, daysFromToday, signIn, tab } from './helpers.ts';

test.beforeEach(async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
});

test('Plans lists every plan, biggest monthly cost first, with its share', async ({ page }) => {
  await addPlan(page, { name: 'iCloud', amount: '75', lastCharged: daysFromToday(-3) });
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-3) });
  await addPlan(page, { name: 'Prime', amount: '1499', billed: 'Yearly', lastCharged: daysFromToday(-30) });

  const tab = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plans', exact: true });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('₹398.92/mo')).toBeVisible(); // 199 + 75 + 1499/12
  const rows = page.getByRole('region', { name: 'Billing' }).getByRole('listitem');
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0)).toContainText('Netflix');
  await expect(rows.nth(1)).toContainText('Prime');
  await expect(rows.nth(0).getByRole('img', { name: /% of your monthly plans/ })).toBeVisible();
  // Prime was charged 30 days ago and renews a year after that; a date outside
  // this calendar year carries its year.
  const next = new Date();
  next.setDate(next.getDate() - 30);
  next.setFullYear(next.getFullYear() + 1);
  if (next.getFullYear() !== new Date().getFullYear()) await expect(rows.nth(1)).toContainText(String(next.getFullYear()));
  else await expect(rows.nth(1)).not.toContainText(String(next.getFullYear()));

  await rows.nth(2).getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'iCloud' })).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Your plans' })).toBeAttached();
});

test('a paused plan moves to its own group with no share bar', async ({ page }) => {
  await addPlan(page, { name: 'Gym', amount: '1500', lastCharged: daysFromToday(-3) });
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Plans', exact: true }).click();
  await page.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Gym/ }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.getByRole('button', { name: 'Back' }).click();
  const paused = page.getByRole('region', { name: 'Paused' });
  await expect(paused).toContainText('Gym');
  await expect(paused.getByRole('img')).toHaveCount(0);
  await expect(paused).toContainText('if restarted');
});

test('You: backup download, then erasing this phone restores from the account', async ({ page }) => {
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-3) });
  await tab(page, 'You');
  await expect(page.getByText('test@atler.mock')).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download a backup' }).click();
  const file = await (await download).path();
  const backup = JSON.parse(readFileSync(file, 'utf8'));
  expect(backup.plans.map((p: { name: string; price: number }) => [p.name, p.price])).toEqual([['Netflix', 19900]]);

  // Erasing only clears this phone; the synced copy comes back.
  await expect(page.getByRole('status', { name: 'Sync status' })).toHaveText(/^Synced/);
  await expect(page.getByRole('status', { name: 'Sync status' })).not.toContainText('waiting'); // nothing left unsent
  await page.getByRole('button', { name: 'Erase ATLER data on this phone' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Erase it all' }).click();
  await tab(page, 'Month');
  await expect(page.getByRole('link', { name: /Netflix/ }).first()).toBeVisible();
});

test('the avatar opens You; sign out returns to sign in', async ({ page }) => {
  await page.getByRole('link', { name: /^You: / }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: 'SIGN IN →' })).toBeVisible();
});

test('plans and spending export as CSV', async ({ page }) => {
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(0) });
  await tab(page, 'You');
  const plans = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Plans as CSV' }).click();
  const plansText = readFileSync(await (await plans).path(), 'utf8');
  expect(plansText).toContain('Name,Price (₹),Billed');
  expect(plansText).toContain('Netflix,199.00,Monthly,active');

  const spending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Spending as CSV' }).click();
  expect(readFileSync(await (await spending).path(), 'utf8')).toContain(`${daysFromToday(0)},Netflix,199.00,,Renewal`);
});

test('delete my account removes everything and signs out', async ({ page, request }) => {
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-3) });
  await tab(page, 'You');
  await page.getByRole('button', { name: 'Delete my account' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete my account for good' }).click();
  await expect(page.getByRole('button', { name: 'SIGN IN →' })).toBeVisible();
  expect((await (await request.get('http://127.0.0.1:54329/__account')).json()).deleted).toBe(true);
});

test('home-screen shortcuts open the add sheet ready for an expense or a plan', async ({ page }) => {
  await page.goto('/?do=add-expense');
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByRole('radio', { name: 'Expense' })).toBeChecked();
  await expect(page).toHaveURL(/\/(#\/)?$/); // the action isn't left in the address to re-run on reload
  await page.keyboard.press('Escape');
  await page.goto('/?do=add-plan');
  await expect(page.getByRole('dialog').getByRole('radio', { name: 'Plan' })).toBeChecked();
});
