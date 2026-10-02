import { expect, test, type Browser, type Page } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn, tab } from './helpers.ts';

const MOCK = 'http://127.0.0.1:54329';

async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:4796', viewport: { width: 412, height: 915 } });
  const page = await context.newPage();
  await signIn(page);
  return page;
}

async function synced(page: Page) {
  await tab(page, 'You');
  await expect(page.getByRole('status', { name: 'Sync status' }).filter({ hasText: /^Synced/ })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Sync status' })).not.toContainText('waiting');
}

test.beforeEach(async ({ request }) => {
  await request.post(`${MOCK}/__reset`);
});

test('a plan added on one phone shows up on another', async ({ browser }) => {
  const a = await phone(browser);
  await addPlan(a, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-29) });
  await addExpense(a, { name: 'Groceries', amount: '1200', on: daysFromToday(0) });
  await synced(a);

  // A brand-new phone: nothing local, so launch waits for the first sync.
  const b = await phone(browser);
  await expect(b.getByRole('link', { name: /Next up Netflix/ })).toBeVisible();
  await tab(b, 'Plans');
  await expect(b.getByRole('region', { name: 'Billing' })).toContainText('Netflix');
});

test('edits and deletes travel both ways; the newest edit wins', async ({ browser }) => {
  const a = await phone(browser);
  await addPlan(a, { name: 'Spotify', amount: '119', lastCharged: daysFromToday(-3) });
  await synced(a);
  const b = await phone(browser);

  // Price change on B...
  await tab(b, 'Plans');
  await b.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Spotify/ }).click();
  await b.getByRole('button', { name: 'Edit' }).click();
  await b.getByRole('dialog').getByLabel('Amount (₹)').fill('139');
  await b.getByRole('dialog').getByRole('button', { name: 'SAVE' }).click();
  await synced(b);

  // ...arrives on A with its history (price creep on the month).
  await a.reload(); // reload keeps the current screen (You), so go back to the month
  await tab(a, 'Month');
  await expect(a.getByRole('link', { name: /Price creep \+₹240\/yr Spotify went up/ })).toBeVisible();

  // Delete on A reaches B.
  await tab(a, 'Plans');
  await a.getByRole('region', { name: 'Billing' }).getByRole('link', { name: /Spotify/ }).click();
  await a.getByRole('button', { name: 'Delete', exact: true }).click();
  await synced(a);
  await b.reload();
  await tab(b, 'Month');
  await expect(b.getByText('Your month is empty')).toBeVisible();
});

test('changes made offline wait, then sync when the connection is back', async ({ page, request }) => {
  await signIn(page);
  await request.post(`${MOCK}/__offline?on=1`);
  await addExpense(page, { name: 'Chai', amount: '40', on: daysFromToday(0) });
  await tab(page, 'You');
  await expect(page.getByRole('status', { name: 'Sync status' })).toContainText('1 change waiting');

  await request.post(`${MOCK}/__offline?on=0`);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.getByRole('status', { name: 'Sync status' })).toHaveText(/^Synced/);
  const server = await (await request.get(`${MOCK}/__db`)).json();
  expect(server.payments.map((p: { name: string; amount: number }) => [p.name, p.amount])).toEqual([['Chai', 4000]]);
});
