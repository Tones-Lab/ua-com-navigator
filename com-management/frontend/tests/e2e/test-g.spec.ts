import { expect, test } from '@playwright/test';
import {
  enterProcessorBuilderMode,
  login,
  openBuilderFromAnyEditableObject,
  openFavoriteFile,
} from './fcom.helpers';

test('Test G: processor builder step progression remains stable', async ({ page }) => {
  await login(page);
  await openFavoriteFile(page, 'CASTLEROCK-MIB-FCOM.json');
  await openBuilderFromAnyEditableObject(page);

  const builderSidebar = page.locator('.builder-sidebar');
  await expect(builderSidebar).toContainText('Builder');

  await enterProcessorBuilderMode(page);

  const selectStep = builderSidebar.locator('.builder-steps').getByRole('button', { name: 'Select' });
  const configureStep = builderSidebar
    .locator('.builder-steps')
    .getByRole('button', { name: 'Configure' });
  const reviewStep = builderSidebar.locator('.builder-steps').getByRole('button', { name: 'Review/Save' });

  await expect(selectStep).toBeEnabled();
  await expect(configureStep).toBeDisabled();
  await expect(reviewStep).toBeDisabled();

  await builderSidebar.getByRole('button', { name: 'Set', exact: true }).click();

  await expect(builderSidebar).toContainText('Processor: Set');
  await expect(configureStep).toBeEnabled();

  await builderSidebar.getByRole('button', { name: 'Next: Review/Save' }).click();
  await expect(builderSidebar.locator('.builder-preview-label')).toContainText('Preview');
  await expect(builderSidebar.getByRole('button', { name: 'Back to Configure' })).toBeVisible();
});
