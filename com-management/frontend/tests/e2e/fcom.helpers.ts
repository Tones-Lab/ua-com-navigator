import { expect, type Page } from '@playwright/test';

declare const process: { env?: Record<string, string | undefined> };

type LoginOptions = {
  serverLabel?: string;
  username: string;
  password: string;
};

const env = process.env || {};
const defaultServerLabel = env.COM_UI_SERVER_LABEL || '';
const defaultUsername = env.COM_UI_USERNAME || 'admin';
const defaultPassword = env.COM_UI_PASSWORD || 'admin';

export const login = async (page: Page, opts?: Partial<LoginOptions>) => {
  const serverLabel = opts?.serverLabel ?? defaultServerLabel;
  const username = opts?.username ?? defaultUsername;
  const password = opts?.password ?? defaultPassword;

  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

      const serverSelect = page.getByLabel('Server');
      await serverSelect.waitFor({ state: 'visible' });

      await expect
        .poll(
          async () => {
            const options = await serverSelect.locator('option').allTextContents();
            const hasSelectableServer = options.slice(1).some((entry) => entry.trim().length > 0);
            return hasSelectableServer;
          },
          {
            timeout: 12000,
          },
        )
        .toBeTruthy();

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
      return;
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= maxAttempts) {
        break;
      }
      await page.waitForTimeout(500 * attempt);
    }
  }

  throw lastError;
};

export const waitForBrowseList = async (page: Page) => {
  await expect(page.locator('.browse-results')).toBeVisible();
  await expect(page.locator('.browse-loading')).toHaveCount(0);
  await expect(page.locator('.browse-results .error')).toHaveCount(0);
};

export const waitForPreviewReady = async (page: Page, timeout = 120000) => {
  await expect(page.locator('.file-title')).toBeVisible({ timeout });
  await expect(page.locator('.file-preview-loading')).toHaveCount(0, { timeout });
  await expect(page.locator('.object-card').first()).toBeVisible({ timeout });
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
  const exactTarget = list.getByRole('button', { name, exact: true });
  if ((await exactTarget.count()) > 0) {
    await exactTarget.first().click();
  } else {
    const partialTarget = list
      .locator('button.browse-link:not(.file-link)')
      .filter({ hasText: new RegExp(name, 'i') })
      .first();
    await expect(partialTarget).toBeVisible();
    await partialTarget.click();
  }
  await waitForBrowseList(page);
  await page.waitForURL((url) => {
    const node = url.searchParams.get('node') || '';
    return node.toLowerCase().includes(name.toLowerCase());
  });
};

export const openCastleRockFile = async (page: Page) => {
  await page.getByRole('tab', { name: 'FCOM' }).click();
  await waitForBrowseList(page);

  const favoriteFileButton = page
    .locator('.favorites-section .favorite-link')
    .filter({ hasText: 'CASTLEROCK-MIB-FCOM.json' })
    .first();
  if ((await favoriteFileButton.count()) > 0) {
    await favoriteFileButton.scrollIntoViewIfNeeded();
    await favoriteFileButton.click();
    await expect(page.locator('.file-title')).toContainText('CASTLEROCK-MIB-FCOM.json');
    return;
  }

  await clickResetNavigation(page);
  await waitForBrowseList(page);

  const folderPathOptions = [
    ['core', 'default', 'processing', 'event', 'fcom', '_objects', 'trap', 'CastleRock'],
    ['_objects', 'trap', 'CastleRock'],
  ];

  let navigated = false;
  for (const pathOption of folderPathOptions) {
    let failed = false;
    for (const segment of pathOption) {
      const candidate = page
        .locator('.browse-list button.browse-link:not(.file-link)')
        .filter({ hasText: new RegExp(segment, 'i') });
      if ((await candidate.count()) === 0) {
        failed = true;
        break;
      }
      await openFolderByName(page, segment);
    }
    if (!failed) {
      navigated = true;
      break;
    }
    await clickResetNavigation(page);
    await waitForBrowseList(page);
  }

  if (!navigated) {
    throw new Error('Unable to navigate to CastleRock folder path.');
  }

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

export const getObjectCardByName = (page: Page, objectName: string) =>
  page.locator('.object-card').filter({ hasText: objectName }).first();

export const getSaveReviewButton = (page: Page, expectedCount?: number) => {
  if (typeof expectedCount === 'number') {
    return page.getByRole('button', {
      name: new RegExp(`(?:Save\\s*&\\s*Review|Review\\s*&\\s*Save) \\(${expectedCount}\\)`),
    });
  }
  return page.getByRole('button', { name: /(?:Save & Review|Review & Save)(?: \(\d+\))?/ });
};

const extractLatestRevision = (payload: any): string | null => {
  const data = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.results)
      ? payload.results
      : [];
  const latest = data[0];
  if (!latest || typeof latest !== 'object') {
    return null;
  }
  const direct =
    latest.RevisionID ?? latest.Revision ?? latest.LastRevision ?? latest.Rev ?? latest.revision;
  if (direct !== undefined && direct !== null && String(direct).trim().length > 0) {
    return String(direct).trim();
  }
  const revisionName = String(
    latest.RevisionName ?? latest.revisionName ?? latest.RevisionLabel ?? latest.revisionLabel ?? '',
  ).trim();
  const match = revisionName.match(/^r(\d+)/i);
  return match ? match[1] : null;
};

export const ensureRuleRevision = async (
  page: Page,
  fileId: string,
  targetRevision: string,
  commitMessage: string,
) => {
  const encodedFileId = encodeURIComponent(fileId);
  const historyUrl = `/api/v1/files/${encodedFileId}/history?limit=20&offset=0`;

  const readHistory = async () => {
    const historyResp = await page.request.get(historyUrl);
    expect(historyResp.ok()).toBeTruthy();
    return historyResp.json();
  };

  const initialHistory = await readHistory();
  const initialRevision = extractLatestRevision(initialHistory);
  if (initialRevision === targetRevision) {
    return;
  }

  const maxAttempts = 3;
  let reverted = false;
  let lastStatus = 0;
  let lastPayload: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const revertResp = await page.request.post(`/api/v1/files/${encodedFileId}/revert`, {
      data: {
        revision: targetRevision,
        commit_message: commitMessage,
      },
    });
    lastStatus = revertResp.status();
    const payload = await revertResp.json().catch(() => null);
    lastPayload = payload;

    if (revertResp.ok() && payload?.result?.success) {
      reverted = true;
      break;
    }

    if (attempt < maxAttempts) {
      await page.waitForTimeout(300 * attempt);
    }
  }

  expect(reverted, `Revert failed status=${lastStatus} payload=${JSON.stringify(lastPayload)}`).toBeTruthy();

  const finalHistory = await readHistory();
  const finalRevision = extractLatestRevision(finalHistory);
  if (finalRevision !== null) {
    expect(finalRevision).toBe(targetRevision);
  }
};

export const commitStagedChanges = async (page: Page, expectedCount?: number) => {
  await getSaveReviewButton(page, expectedCount).click();
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
