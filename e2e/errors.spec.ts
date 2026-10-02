import { expect, test } from '@playwright/test';
import { signIn } from './helpers.ts';

const MOCK = 'http://127.0.0.1:54329';

test('a failed sync is reported with the build version', async ({ page, request }) => {
  await request.post(`${MOCK}/__reset`);
  await signIn(page);
  await request.post(`${MOCK}/__fail?table=payments`);
  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Expense' }).click();
  await sheet.getByLabel('What for').fill('Chai');
  await sheet.getByLabel('Amount (₹)').fill('40');
  await sheet.getByRole('button', { name: 'ADD EXPENSE' }).click();

  await expect.poll(async () => (await (await request.get(`${MOCK}/__db`)).json()).error_log.map((e: { kind: string; message: string }) => [e.kind, e.message]))
    .toEqual([['write', 'mock failure']]);
  const [logged] = (await (await request.get(`${MOCK}/__db`)).json()).error_log;
  expect(logged.context).toMatchObject({ app: 2, during: 'sync' });
  expect(logged.release).toMatch(/^[0-9a-f]{7}$|^dev$/);
});
