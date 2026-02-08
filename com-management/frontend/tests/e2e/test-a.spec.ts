import { expect, test } from '@playwright/test';
import { login } from './fcom.helpers';

test('Test A: login routes to overview with a fresh URL', async ({ page }) => {
  await login(page);

  const url = new URL(page.url());
  expect(url.searchParams.get('file')).toBeNull();
  expect(url.searchParams.get('view')).toBe('preview');
});
