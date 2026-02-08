import { expect, test } from '@playwright/test';
import { login, openFolderByName, waitForBrowseList } from './fcom.helpers';

test('Test B: navigate to A10 and open first file', async ({ page }) => {
  await login(page);

  await page.getByRole('tab', { name: 'FCOM' }).click();
  await waitForBrowseList(page);

  await openFolderByName(page, 'core');
  await openFolderByName(page, 'default');
  await openFolderByName(page, 'processing');
  await openFolderByName(page, 'event');
  await openFolderByName(page, 'fcom');
  await openFolderByName(page, '_objects');
  await openFolderByName(page, 'trap');
  await openFolderByName(page, 'a10');

  const fileLinks = page.locator('.browse-link.file-link');
  await expect(fileLinks).toHaveCount(2);
  const browseList = page.locator('.browse-results');
  await expect(
    browseList.getByRole('button', { name: 'A10-AX-MIB-FCOM.json', exact: true }),
  ).toBeVisible();
  await expect(
    browseList.getByRole('button', { name: 'A10-AX-NOTIFICATIONS-FCOM.json', exact: true }),
  ).toBeVisible();

  await browseList.getByRole('button', { name: 'A10-AX-MIB-FCOM.json', exact: true }).click();
  await expect(page.locator('.file-title')).toContainText('A10-AX-MIB-FCOM.json');
});
