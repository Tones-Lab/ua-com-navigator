import { expect, type Page } from '@playwright/test';

type LoginOptions = {
  serverLabel?: string;
  username: string;
  password: string;
};

const defaultServerLabel = process.env.COM_UI_SERVER_LABEL || '';
const defaultUsername = process.env.COM_UI_USERNAME || 'admin';
const defaultPassword = process.env.COM_UI_PASSWORD || 'admin';

export const login = async (page: Page, opts?: Partial<LoginOptions>) => {
  const serverLabel = opts?.serverLabel ?? defaultServerLabel;
  const username = opts?.username ?? defaultUsername;
  const password = opts?.password ?? defaultPassword;

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  const serverSelect = page.getByLabel('Server');
  await serverSelect.waitFor({ state: 'visible' });

  if (serverLabel) {
    const options = await serverSelect.locator('option').allTextContents();
    const matchedLabel = options.find((optionLabel) =>
      optionLabel.toLowerCase().includes(serverLabel.toLowerCase()),
    );
    if (matchedLabel) {
      await serverSelect.selectOption({ label: matchedLabel });
    } else {
      await serverSelect.selectOption({ index: 1 });
    }
  } else {
    await serverSelect.selectOption({ index: 1 });
  }

  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
};

export const waitForBrowseList = async (page: Page) => {
  await expect(page.locator('.browse-results')).toBeVisible();
  await expect(page.locator('.browse-loading')).toHaveCount(0);
  await expect(page.locator('.browse-results .error')).toHaveCount(0);
};

export const waitForPreviewReady = async (page: Page) => {
  await expect(page.locator('.file-title')).toBeVisible({ timeout: 120000 });
  await expect(page.locator('.file-preview-loading')).toHaveCount(0, { timeout: 120000 });
  await expect(page.locator('.object-card').first()).toBeVisible({ timeout: 120000 });
};

const clickResetNavigation = async (page: Page) => {
  const resetNavigationButton = page.getByRole('button', { name: 'Reset Navigation' });
  if ((await resetNavigationButton.count()) > 0) {
    await resetNavigationButton.first().click();
    return;
  }
  await page.getByRole('button', { name: 'Reset', exact: true }).first().click();
};

export const openFolderByName = async (page: Page, name: string) => {
  const list = page.locator('.browse-list');
  await expect(list).toBeVisible();
  const target = list.getByRole('button', { name, exact: true });
  await expect(target).toBeVisible();
  await target.click();
  await waitForBrowseList(page);
  await page.waitForURL((url) => {
    const node = url.searchParams.get('node') || '';
    return node.toLowerCase().includes(name.toLowerCase());
  });
};

export const openCastleRockFile = async (page: Page) => {
  await page.getByRole('tab', { name: 'FCOM' }).click();
  await waitForBrowseList(page);

  await clickResetNavigation(page);
  await waitForBrowseList(page);

  await openFolderByName(page, 'core');
  await openFolderByName(page, 'default');
  await openFolderByName(page, 'processing');
  await openFolderByName(page, 'event');
  await openFolderByName(page, 'fcom');
  await openFolderByName(page, '_objects');
  await openFolderByName(page, 'trap');
  await openFolderByName(page, 'CastleRock');

  const browseList = page.locator('.browse-results');
  await browseList.getByRole('button', { name: 'CASTLEROCK-MIB-FCOM.json', exact: true }).click();
  await expect(page.locator('.file-title')).toContainText('CASTLEROCK-MIB-FCOM.json');
};

export const openA3comFile = async (page: Page, filename: string) => {
  await page.getByRole('tab', { name: 'FCOM' }).click();
  await waitForBrowseList(page);

  await clickResetNavigation(page);
  await waitForBrowseList(page);

  await openFolderByName(page, 'core');
  await openFolderByName(page, 'default');
  await openFolderByName(page, 'processing');
  await openFolderByName(page, 'event');
  await openFolderByName(page, 'fcom');
  await openFolderByName(page, '_objects');
  await openFolderByName(page, 'trap');
  await openFolderByName(page, 'a3com');

  const browseList = page.locator('.browse-results');
  await browseList.getByRole('button', { name: filename, exact: true }).click();
  await expect(page.locator('.file-title')).toContainText(filename);
};

export const openAnyFcomFile = async (page: Page) => {
  await page.getByRole('tab', { name: 'FCOM' }).click();
  await waitForBrowseList(page);

  const fileLinks = page.locator('.browse-link.file-link');
  if ((await fileLinks.count()) > 0) {
    await fileLinks.first().click();
    await expect(page.locator('.file-title')).toBeVisible();
    return;
  }

  for (let depth = 0; depth < 12; depth += 1) {
    const folders = page.locator('.browse-link:not(.file-link)');
    if ((await folders.count()) === 0) {
      break;
    }
    await folders.first().click();
    await waitForBrowseList(page);

    if ((await fileLinks.count()) > 0) {
      await fileLinks.first().click();
      await expect(page.locator('.file-title')).toBeVisible();
      return;
    }
  }

  throw new Error('Unable to locate any FCOM file from current browse context.');
};

export const openFavoriteFile = async (page: Page, fileName: string) => {
  await page.getByRole('tab', { name: 'FCOM' }).click();
  await waitForBrowseList(page);

  const favoriteFilesDetails = page
    .locator('.favorites-section details')
    .filter({ hasText: 'Favorite Files' })
    .first();
  if ((await favoriteFilesDetails.count()) > 0) {
    await favoriteFilesDetails.evaluate((node) => {
      (node as HTMLDetailsElement).open = true;
    });
  }

  const favoriteFileButton = page
    .locator('.favorites-section .favorite-link')
    .filter({ hasText: fileName })
    .first();

  await favoriteFileButton.scrollIntoViewIfNeeded();
  await expect(favoriteFileButton).toBeVisible();
  await favoriteFileButton.click();
  await expect(page.locator('.file-title')).toContainText(fileName);
  await waitForPreviewReady(page);
};

export const openBuilderFromAnyEditableObject = async (page: Page) => {
  await waitForPreviewReady(page);

  const objectCards = page.locator('.object-card');
  const cardCount = await objectCards.count();

  if (cardCount === 0) {
    throw new Error('No object cards rendered after preview load; builder cannot be opened.');
  }

  for (let index = 0; index < cardCount; index += 1) {
    const card = objectCards.nth(index);
    await card.scrollIntoViewIfNeeded();

    const editButton = card.getByRole('button', { name: 'Edit' });
    if ((await editButton.count()) === 0) {
      continue;
    }

    await editButton.first().click();
    await expect(card.locator('.object-panel-editing')).toBeVisible();

    const builderButtons = card
      .locator('button.builder-link.builder-link-iconic')
      .filter({ hasText: 'Builder' });
    const builderCount = await builderButtons.count();

    for (let idx = 0; idx < builderCount; idx += 1) {
      await builderButtons.nth(idx).click();

      const processorTypeButton = page
        .locator('.builder-sidebar .builder-body')
        .getByRole('button', { name: 'Processor' });

      if ((await processorTypeButton.count()) > 0) {
        return;
      }

      const advancedFlowModalClose = page
        .locator('.modal-flow .modal-actions button')
        .filter({ hasText: 'Close' })
        .first();
      if ((await advancedFlowModalClose.count()) > 0) {
        await advancedFlowModalClose.click();
        const discardButton = page
          .locator('.modal-actions button')
          .filter({ hasText: 'Discard' })
          .first();
        if ((await discardButton.count()) > 0) {
          await discardButton.click();
        }
      }
    }
  }

  throw new Error('Unable to locate an editable object field with an Open Builder action.');
};

export const enterProcessorBuilderMode = async (page: Page) => {
  const builderSidebar = page.locator('.builder-sidebar');
  await builderSidebar.getByRole('button', { name: 'Processor' }).click();

  const switchTypeModal = page
    .locator('.modal')
    .filter({ hasText: 'Switch builder type' })
    .first();

  if ((await switchTypeModal.count()) > 0) {
    await switchTypeModal.getByRole('button', { name: 'Switch', exact: true }).click();
  }

  await expect(builderSidebar).toContainText(/Processor Builder|V3 Patch Builder/);
};

export const getEventField = (objectCard: ReturnType<Page['locator']>, label: string) =>
  objectCard
    .locator('.object-row-additional > div')
    .filter({ hasText: label })
    .first();

export const commitStagedChanges = async (page: Page, expectedCount?: number) => {
  const reviewLabel =
    typeof expectedCount === 'number'
      ? new RegExp(`Review & Save \\(${expectedCount}\\)`)
      : /Review & Save \(\d+\)/;
  await page.getByRole('button', { name: reviewLabel }).click();
  await expect(page.getByRole('heading', { name: 'Review staged changes' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Commit' }).click();

  await expect(page.getByRole('heading', { name: 'Commit message' })).toBeVisible();
  await page.getByRole('button', { name: 'Commit Changes' }).click();

  await expect(page.getByRole('heading', { name: 'Commit message' })).toBeHidden();
  await expect(
    page.getByText(
      /Overrides saved\. Literal changes are stored as patch operations\.|Overrides committed for .*\(restart required\)/,
    ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Review & Save/ })).toBeDisabled();
  await expect(page.locator('.file-details .error')).toHaveCount(0);
};
