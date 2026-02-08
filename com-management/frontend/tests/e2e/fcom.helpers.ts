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
    await serverSelect.selectOption({ label: new RegExp(serverLabel, 'i') });
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
  await expect(page.locator('.browse-list')).toBeVisible();
  await expect(page.locator('.browse-loading')).toHaveCount(0);
  await expect(page.locator('.browse-results .error')).toHaveCount(0);
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

  await page.getByRole('button', { name: 'Reset Navigation' }).click();
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

  await page.getByRole('button', { name: 'Reset Navigation' }).click();
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
