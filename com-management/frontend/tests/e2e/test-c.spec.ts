import { expect, test } from '@playwright/test';
import { commitStagedChanges, getEventField, login, openCastleRockFile } from './fcom.helpers';

test('Test C: edit CastleRock severity then remove override', async ({ page }) => {
  await login(page);

  await openCastleRockFile(page);

  const objectCard = page.locator('.object-card').first();
  await objectCard.getByRole('button', { name: 'Edit' }).click();
  await expect(objectCard.locator('.object-panel-editing')).toBeVisible();

  const severityField = getEventField(objectCard, 'Severity');
  const severityInput = severityField.locator('input');
  await expect(severityInput).toBeVisible();
  const currentSeverity = (await severityInput.inputValue()).trim();
  const nextSeverity = currentSeverity === '5' ? '2' : '5';
  await severityInput.fill(nextSeverity);

  await expect(severityField.locator('.dirty-indicator')).toBeVisible();
  await expect(objectCard.getByRole('button', { name: 'Save' })).toBeEnabled();

  const unsavedPill = objectCard.locator('.unsaved-pill');
  if ((await unsavedPill.count()) > 0) {
    await expect(unsavedPill).toContainText('Unsaved (1)');
  }

  await objectCard.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /Review & Save \(1\)/ })).toBeEnabled();
  await expect(page.locator('.pill', { hasText: 'Edited objects: 1' })).toBeVisible();

  await commitStagedChanges(page, 1);

  await openCastleRockFile(page);

  const refreshedCard = page.locator('.object-card').first();
  await expect(refreshedCard.locator('.override-pill')).toHaveCount(1);

  await refreshedCard.getByRole('button', { name: 'Edit' }).click();
  await expect(refreshedCard.locator('.object-panel-editing')).toBeVisible();

  const removeButtons = refreshedCard.locator(
    'button[aria-label^="Remove"][aria-label$="override"]',
  );
  const removeCount = await removeButtons.count();
  expect(removeCount).toBeGreaterThan(0);
  for (let i = 0; i < removeCount; i += 1) {
    await removeButtons.nth(0).click();
  }

  await refreshedCard.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /Review & Save \(\d+\)/ })).toBeEnabled();
  await commitStagedChanges(page);

  await expect(refreshedCard.locator('.override-pill')).toHaveCount(0);
});
