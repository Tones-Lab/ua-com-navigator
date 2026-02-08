import { expect, test } from '@playwright/test';
import { getEventField, login, openA3comFile } from './fcom.helpers';

test('Test F: add second override after first save', async ({ page }) => {
  await login(page);

  await openA3comFile(page, 'A3COM-HUAWEI-8021PAE-MIB-FCOM.json');

  const objectCard = page.locator('.object-card').first();
  await objectCard.getByRole('button', { name: 'Edit' }).click();
  await expect(objectCard.locator('.object-panel-editing')).toBeVisible();

  const severityField = getEventField(objectCard, 'Severity');
  const severityInput = severityField.locator('input');
  await expect(severityInput).toBeVisible();
  const currentSeverity = (await severityInput.inputValue()).trim();
  const nextSeverity = currentSeverity === '5' ? '2' : '5';
  await severityInput.fill(nextSeverity);

  await expect(objectCard.getByRole('button', { name: 'Save' })).toBeEnabled();
  await objectCard.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('button', { name: /Review & Save \(1\)/ })).toBeEnabled();

  await objectCard.getByRole('button', { name: 'Edit' }).click();
  await expect(objectCard.locator('.object-panel-editing')).toBeVisible();

  const expireField = getEventField(objectCard, 'Expire Time');
  const expireInput = expireField.locator('input');
  await expect(expireInput).toBeVisible();
  const currentExpire = (await expireInput.inputValue()).trim();
  const nextExpire = currentExpire === '1' ? '3600' : '1';
  await expireInput.fill(nextExpire);

  await objectCard.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('button', { name: /Review & Save \(2\)/ })).toBeEnabled();
  await expect(page.locator('.pill', { hasText: 'Edited objects: 1' })).toBeVisible();

  await page.getByRole('button', { name: /Review & Save \(2\)/ }).click();
  await expect(page.getByRole('heading', { name: 'Review staged changes' })).toBeVisible();
  await expect(page.locator('.staged-change')).toHaveCount(2);
  await page.getByRole('button', { name: 'Continue to Commit' }).click();

  await expect(page.getByRole('heading', { name: 'Commit message' })).toBeVisible();
  await page.getByRole('button', { name: 'Commit Changes' }).click();

  await expect(page.getByRole('heading', { name: 'Commit message' })).toBeHidden();
  await expect(
    page.getByText('Restart FCOM Processor required', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Review & Save/ })).toBeDisabled();
  await expect(page.locator('.file-details .error')).toHaveCount(0);
});
