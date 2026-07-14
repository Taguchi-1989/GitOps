import { expect, test } from '@playwright/test';

test('an improvement card can be created from the UI', async ({ page }) => {
  const title = `E2E 改善カード ${Date.now()}`;

  await page.addInitScript(() => localStorage.setItem('flowops-welcome-dismissed', 'true'));
  await page.goto('/issues/new');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: '改善カードを作る' })).toBeVisible();

  const description = page.getByLabel(/^説明/);
  await expect(async () => {
    await page.getByRole('button', { name: 'テンプレートを使う' }).click();
    await expect(description).not.toHaveValue('');
  }).toPass();
  await page.getByLabel(/改善カードのタイトル/).fill(title);
  await description.fill('Playwright によるクリティカルパスの回帰確認です。');
  const createResponse = page.waitForResponse(
    response => response.url().endsWith('/api/issues') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: '改善カードを作成' }).click();
  expect((await createResponse).status()).toBe(201);

  await expect(page).toHaveURL(/\/issues\/(?!new(?:$|[/?#]))[^/?#]+$/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText(/^ISS-\d+$/)).toBeVisible();
});
