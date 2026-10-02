import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { addExpense, addPlan, daysFromToday, signIn } from './helpers.ts';

// Every screen, with real content on it, must have no WCAG 2.x A/AA violations.
async function noViolations(page: Page, where: string) {
  await expect(page.locator('#launch')).toHaveCount(0); // not mid-fade
  await page.waitForTimeout(350); // floating cards fade in over 200 ms
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(violations.map(v => `${where}: ${v.id} — ${v.help} (${v.nodes.map(n => n.target.join(' ')).slice(0, 3).join(' | ')})`)).toEqual([]);
}

test('sign-in screen is accessible', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await page.goto('/');
  await expect(page.getByRole('button', { name: /sign in/i }).first()).toBeVisible();
  await noViolations(page, 'sign in');
});

test('every signed-in screen is accessible', async ({ page, request }) => {
  await request.post('http://127.0.0.1:54329/__reset');
  await signIn(page);
  await addPlan(page, { name: 'Netflix', amount: '199', lastCharged: daysFromToday(-10) });
  await addExpense(page, { name: 'Lunch', amount: '250', on: daysFromToday(0) });

  for (const [hash, where] of [['#/', 'month'], ['#/plans', 'plans'], ['#/you', 'you'], ['#/spent', 'spent'], ['#/calendar', 'calendar'], ['#/year', 'year'], ['#/money', 'income & goals'], ['#/ask', 'ask']] as const) {
    await page.goto(`/${hash}`);
    await expect(page.locator('main')).toBeVisible();
    await page.waitForTimeout(300);
    await noViolations(page, where);
  }
  await page.goto('/#/plans');
  await page.getByRole('link', { name: /Netflix/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Netflix' })).toBeVisible();
  await noViolations(page, 'plan');

  await page.getByRole('button', { name: 'Add a plan or expense' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await noViolations(page, 'add sheet');
});
