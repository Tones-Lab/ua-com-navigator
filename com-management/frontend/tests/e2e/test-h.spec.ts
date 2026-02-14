import { expect, test } from '@playwright/test';
import {
  enterProcessorBuilderMode,
  login,
  openBuilderFromAnyEditableObject,
  openFavoriteFile,
} from './fcom.helpers';

test('Test H: switch and foreach processor configure editors remain functional', async ({ page }) => {
  await login(page);
  await openFavoriteFile(page, 'CASTLEROCK-MIB-FCOM.json');
  await openBuilderFromAnyEditableObject(page);

  const builderSidebar = page.locator('.builder-sidebar');
  await enterProcessorBuilderMode(page);

  await builderSidebar.getByRole('button', { name: /^Switch/ }).click();
  await expect(builderSidebar).toContainText('Processor: Switch');
  await expect(builderSidebar.locator('.flow-switch-cases')).toBeVisible();
  await expect(builderSidebar.getByRole('button', { name: 'Add case' })).toBeVisible();
  await expect(builderSidebar).toContainText('Default processors');

  const cases = builderSidebar.locator('.flow-switch-case');
  const beforeCount = await cases.count();
  await builderSidebar.getByRole('button', { name: 'Add case' }).click();
  await expect(cases).toHaveCount(beforeCount + 1);

  await builderSidebar.locator('.builder-steps').getByRole('button', { name: 'Select' }).click();
  await builderSidebar.getByRole('button', { name: /^Foreach/ }).click();

  const foreachRow = builderSidebar.locator('.processor-row').filter({ hasText: 'Per-item processors' });
  await expect(foreachRow).toBeVisible();
  await expect(foreachRow.getByRole('button', { name: 'Add processor' })).toBeVisible();
});
