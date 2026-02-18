import { expect, test } from '@playwright/test';
import {
  commitStagedChanges,
  ensureRuleRevision,
  getEventField,
  getObjectCardByName,
  getSaveReviewButton,
  login,
  openCastleRockFile,
  waitForPreviewReady,
} from './fcom.helpers';

const OVERRIDE_FILE_ID =
  'id-core/default/processing/event/fcom/overrides/castlerock.castlerock-mib.dummytrap.override.json';
const CASTLEROCK_FILE_ID =
  'id-core/default/processing/event/fcom/_objects/trap/CastleRock/CASTLEROCK-MIB-FCOM.json';
const BASELINE_REVISION = '226';
const P0_011_REQUIRED_REVISION = '233';
const P0_011_OVERRIDE_OBJECT = 'CASTLEROCK-MIB::pollStatusTestFail';
const EXPECTED_POLLSTATUSTESTFAIL_OVERRIDE_AT_REV233 = {
  name: 'CASTLEROCK-MIB::pollStatusTestFail Override',
  description: 'Overrides for CASTLEROCK-MIB::pollStatusTestFail',
  domain: 'fault',
  method: 'trap',
  scope: 'post',
  '@objectName': 'CASTLEROCK-MIB::pollStatusTestFail',
  _type: 'override',
  processors: [
    {
      op: 'add',
      path: '/-',
      value: {
        set: {
          source: 5,
          targetField: '$.event.Severity',
        },
      },
    },
  ],
};
const EXPECTED_DUMMYTRAP_OVERRIDE_AFTER_REVERT = {
  name: 'CASTLEROCK-MIB::dummyTrap Override (v2_copy)',
  description: 'Overrides for CASTLEROCK-MIB::dummyTrap',
  domain: 'fault',
  method: 'trap',
  scope: 'post',
  '@objectName': 'CASTLEROCK-MIB::dummyTrap',
  _type: 'override',
  version: 'v2',
  processors: [
    {
      set: {
        source: 7200,
        targetField: '$.event.ExpireTime',
      },
    },
    {
      set: {
        source: 5,
        targetField: '$.event.Severity',
      },
    },
  ],
};

const assertFileContent = async (page: any, fileId: string, expectedContent: any) => {
  const readResp = await page.request.get(`/api/v1/files/${encodeURIComponent(fileId)}/read?revision=HEAD`);
  expect(readResp.ok()).toBeTruthy();
  const readPayload = await readResp.json();

  const rawContent = readPayload?.content;
  const extractContent = () => {
    if (rawContent && typeof rawContent === 'object') {
      const dataArray = Array.isArray(rawContent?.data) ? rawContent.data : null;
      if (dataArray && dataArray.length > 0) {
        const first = dataArray[0];
        const wrappedRuleText = first?.RuleText ?? first?.ruleText;
        if (typeof wrappedRuleText === 'string') {
          return JSON.parse(wrappedRuleText);
        }
        if (first && typeof first === 'object') {
          return first;
        }
      }
    }
    if (typeof rawContent === 'string') {
      return JSON.parse(rawContent);
    }
    if (rawContent && typeof rawContent === 'object') {
      const possibleRuleText = rawContent?.RuleText ?? rawContent?.ruleText;
      if (typeof possibleRuleText === 'string') {
        return JSON.parse(possibleRuleText);
      }
      return rawContent;
    }
    return rawContent;
  };

  const parsedContent = extractContent();
  expect(parsedContent).toEqual(expectedContent);
};

const getVerifiedObjectCard = async (page: any, objectName: string) => {
  const card = getObjectCardByName(page, objectName);
  await expect(card).toBeVisible();
  await expect(card.locator('.object-name').first()).toContainText(objectName);
  return card;
};

const ensureObjectOverrideRevision = async (
  page: any,
  fileId: string,
  objectName: string,
  requiredRevision: string,
  commitMessage: string,
  expectedContent?: any,
) => {
  const fetchOverrideMeta = async () => {
    const resp = await page.request.get(`/api/v1/overrides?file_id=${encodeURIComponent(fileId)}`);
    expect(resp.ok()).toBeTruthy();
    return resp.json();
  };

  const extractObjectMeta = (payload: any) => payload?.overrideMetaByObject?.[objectName] || null;

  const beforePayload = await fetchOverrideMeta();
  const beforeMeta = extractObjectMeta(beforePayload);
  expect(beforeMeta?.pathId).toBeTruthy();

  const currentRevision = String(beforeMeta?.revision ?? '').trim();
  if (currentRevision !== requiredRevision) {
    const revertResp = await page.request.post(
      `/api/v1/files/${encodeURIComponent(String(beforeMeta.pathId))}/revert`,
      {
        data: {
          revision: requiredRevision,
          commit_message: commitMessage,
        },
      },
    );
    expect(revertResp.ok()).toBeTruthy();
    const revertPayload = await revertResp.json();
    expect(revertPayload?.result?.success).toBeTruthy();
  }

  const afterPayload = await fetchOverrideMeta();
  const afterMeta = extractObjectMeta(afterPayload);
  expect(afterMeta?.pathId).toBeTruthy();
  if (expectedContent) {
    await assertFileContent(page, String(afterMeta.pathId), expectedContent);
  }
  return afterMeta;
};

const commitWithMessage = async (page: any, expectedCount: number, commitId: string) => {
  await getSaveReviewButton(page, expectedCount).click();
  await expect(page.getByRole('heading', { name: 'Review staged changes' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to Commit' }).click();

  await expect(page.getByRole('heading', { name: 'Commit message' })).toBeVisible();
  const commitInput = page
    .locator('textarea, input')
    .filter({ hasText: '' })
    .first();
  if ((await commitInput.count()) > 0) {
    await commitInput.fill(commitId);
  }
  await page.getByRole('button', { name: 'Commit Changes' }).click();

  await expect(page.getByRole('heading', { name: 'Commit message' })).toBeHidden();
  await expect(page.locator('.file-details .error')).toHaveCount(0);
};

test.describe('P0 flow conversion from test-flow-outline', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, { username: 'admin', password: 'admin' });
  });

  test.describe('parallel-safe flows', () => {
    test.describe.configure({ mode: 'parallel' });

    test('FLOW-P0-001: full-access login shows editable dummyTrap', async ({ page }) => {
      await page.getByRole('tab', { name: 'FCOM' }).click();
      await page.getByRole('tab', { name: 'PCOM' }).click();
      await expect(page.getByText('READ-ONLY ACCESS')).toHaveCount(0);

      await openCastleRockFile(page);
      await waitForPreviewReady(page);

      const dummyTrapCard = await getVerifiedObjectCard(page, 'CASTLEROCK-MIB::dummyTrap');
      await expect(dummyTrapCard.getByRole('button', { name: 'Edit' })).toBeVisible();
    });

    test('FLOW-P0-002: read-only login blocks dummyTrap edit', async ({ page }) => {
      await page.request.post('/api/v1/auth/logout');
      await login(page, { username: 'admin1', password: 'admin1' });
      await page.getByRole('tab', { name: 'FCOM' }).click();
      await page.getByRole('tab', { name: 'PCOM' }).click();
      await expect(page.getByText('READ-ONLY ACCESS')).toBeVisible();

      await openCastleRockFile(page);
      await waitForPreviewReady(page);

      const dummyTrapCard = await getVerifiedObjectCard(page, 'CASTLEROCK-MIB::dummyTrap');
      await expect(dummyTrapCard.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    });

    test('FLOW-P0-009: Friendly/Raw toggle behaves correctly', async ({ page }) => {
      await openCastleRockFile(page);
      await waitForPreviewReady(page);

      const viewToggleLabel = page.locator('label.switch[aria-label="Toggle friendly/raw view"]').first();
      const viewToggleInput = viewToggleLabel.locator('input[type="checkbox"]');
      await expect(viewToggleLabel).toBeVisible();
      await expect(viewToggleInput).not.toBeChecked();

      const dummyTrapCard = await getVerifiedObjectCard(page, 'CASTLEROCK-MIB::dummyTrap');
      await expect(dummyTrapCard).toContainText('Summary');
      await expect(page.locator('.file-code-view')).toHaveCount(0);

      await viewToggleLabel.click();
      await expect(viewToggleInput).toBeChecked();
      await expect(page.locator('.file-code-view, pre, code').first()).toBeVisible();
    });

    test('FLOW-P0-010: test all CastleRock traps modal and completion summary', async ({ page }) => {
      test.setTimeout(480000);

      await openCastleRockFile(page);
      await waitForPreviewReady(page);

      await page.getByRole('button', { name: 'Test All CastleRock SNMP Traps' }).click();
      const serverListSelect = page.getByLabel('Server list');
      await expect(serverListSelect).toBeVisible();
      await expect(serverListSelect).toHaveValue(/lab-ua-tony02\.tony\.lab/i);
      await expect(serverListSelect.locator('option:checked')).toContainText(/lab-ua-tony02\.tony\.lab/i);

      await page.getByRole('button', { name: 'Send Traps' }).click();
      await expect(page.getByText(/Completed:\s*\d+\/\d+ sent,\s*\d+ failed/)).toBeVisible({ timeout: 420000 });

      await page.getByRole('button', { name: 'Close' }).click();
    });
  });

  test.describe.serial('state-mutating flows', () => {

    test('FLOW-P0-008: edit Severity 5->2 then commit one override', async ({ page }) => {
      await ensureRuleRevision(
        page,
        OVERRIDE_FILE_ID,
        BASELINE_REVISION,
        `TEST-BASELINE FLOW-P0-008 ${new Date().toISOString()}`,
      );
      await assertFileContent(page, OVERRIDE_FILE_ID, EXPECTED_DUMMYTRAP_OVERRIDE_AFTER_REVERT);

      await openCastleRockFile(page);
      await waitForPreviewReady(page);

      const targetCard = await getVerifiedObjectCard(page, 'CASTLEROCK-MIB::pollStatusTestFail');
      await targetCard.getByRole('button', { name: 'Edit' }).click();

      const severityField = getEventField(targetCard, 'Severity');
      const severityInput = severityField.locator('input');
      await expect(severityInput).toBeVisible();
      await severityInput.fill('2');

      await targetCard.getByRole('button', { name: 'Save' }).click();
      await expect(getSaveReviewButton(page, 1)).toBeEnabled();

      await commitWithMessage(page, 1, `TEST-008 ${new Date().toISOString()}`);
      await expect(targetCard.locator('.object-header .object-title .override-pill').first()).toContainText(
        /Override|Overrides/,
      );
    });

    test('FLOW-P0-011: remove existing Severity override and commit removal', async ({ page }) => {

    const pollStatusMeta = await ensureObjectOverrideRevision(
      page,
      CASTLEROCK_FILE_ID,
      P0_011_OVERRIDE_OBJECT,
      P0_011_REQUIRED_REVISION,
      `TEST-P0-011 baseline enforce ${new Date().toISOString()}`,
      EXPECTED_POLLSTATUSTESTFAIL_OVERRIDE_AT_REV233,
    );
    expect(String(pollStatusMeta?.modifiedBy || '').toLowerCase()).toBe('admin');

    await openCastleRockFile(page);
    await waitForPreviewReady(page);

    const targetCard = await getVerifiedObjectCard(page, 'CASTLEROCK-MIB::pollStatusTestFail');
    await targetCard.getByRole('button', { name: 'Edit' }).click();

    const removeButtons = targetCard.locator('button[aria-label^="Remove"][aria-label$="override"]');
    await expect(removeButtons.first()).toBeVisible();
    await removeButtons.first().click();

    await expect(page.getByRole('heading', { name: /Remove/i })).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();

    await targetCard.getByRole('button', { name: 'Save' }).click();
    await expect(getSaveReviewButton(page, 1)).toBeEnabled();

    await commitWithMessage(page, 1, `TEST-011 ${new Date().toISOString()}`);
    await expect(targetCard.locator('.override-pill')).toHaveCount(0);
    });

    test('FLOW-P0-012: revert Sub Node edit to original leaves no staged change', async ({ page }) => {
      test.setTimeout(240000);

    await ensureRuleRevision(
      page,
      OVERRIDE_FILE_ID,
      BASELINE_REVISION,
      `TEST-BASELINE FLOW-P0-012 ${new Date().toISOString()}`,
    );
    await assertFileContent(page, OVERRIDE_FILE_ID, EXPECTED_DUMMYTRAP_OVERRIDE_AFTER_REVERT);

    await openCastleRockFile(page);
    await waitForPreviewReady(page, 180000);

    const dummyTrapCard = await getVerifiedObjectCard(page, 'CASTLEROCK-MIB::dummyTrap');
    await dummyTrapCard.getByRole('button', { name: 'Edit' }).click();

    const subNodeField = getEventField(dummyTrapCard, 'Sub Node');
    await expect(subNodeField).toBeVisible();
    const fieldEditButton = subNodeField.getByRole('button', { name: 'Edit' });
    if ((await fieldEditButton.count()) > 0) {
      await fieldEditButton.first().click();
    }

    const deviceInput = subNodeField
      .locator('input, textarea, [contenteditable="true"]')
      .first();
    await expect(deviceInput).toBeVisible();
    const isTextInput = await deviceInput.evaluate((element) => {
      const tag = element.tagName.toLowerCase();
      return tag === 'input' || tag === 'textarea';
    });
    if (isTextInput) {
      const current = ((await deviceInput.inputValue()) || '').trim();
      await deviceInput.fill(current.endsWith('1') ? current : `${current}1`);
    } else {
      const current = ((await deviceInput.textContent()) || '').trim();
      await deviceInput.fill(current.endsWith('1') ? current : `${current}1`);
    }

    await dummyTrapCard.getByRole('button', { name: 'Save' }).click();
    await expect(getSaveReviewButton(page, 1)).toBeEnabled();

    await dummyTrapCard.getByRole('button', { name: 'Edit' }).click();
    const subNodeFieldEdit = getEventField(dummyTrapCard, 'Sub Node');
    await expect(subNodeFieldEdit).toBeVisible();
    const subNodeRemoveButton = subNodeFieldEdit
      .locator('button[aria-label^="Remove"][aria-label$="override"]')
      .first();
    await expect(subNodeRemoveButton).toBeVisible();
    await subNodeRemoveButton.click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await dummyTrapCard.getByRole('button', { name: 'Save' }).click();
    await expect(getSaveReviewButton(page)).toBeDisabled();
    await expect(getSaveReviewButton(page, 1)).toHaveCount(0);
    });

    test('FLOW-P0-013: remove all overrides and redeploy with success toast', async ({ page }) => {
      test.setTimeout(420000);

    await ensureRuleRevision(
      page,
      OVERRIDE_FILE_ID,
      BASELINE_REVISION,
      `TEST-BASELINE FLOW-P0-013 ${new Date().toISOString()}`,
    );
    await assertFileContent(page, OVERRIDE_FILE_ID, EXPECTED_DUMMYTRAP_OVERRIDE_AFTER_REVERT);

    await openCastleRockFile(page);
    await waitForPreviewReady(page, 180000);

    const dummyTrapCard = await getVerifiedObjectCard(page, 'CASTLEROCK-MIB::dummyTrap');
    await dummyTrapCard.getByRole('button', { name: 'Edit' }).click();

    await dummyTrapCard.getByRole('button', { name: 'Remove All Overrides' }).click();
    await page.getByRole('button', { name: 'Yes' }).click();

    await expect(dummyTrapCard).toContainText('Removed');
    await dummyTrapCard.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('.staged-toast')).toContainText(/Staged\s+\d+/i);
    await expect(getSaveReviewButton(page)).toBeEnabled();

    await getSaveReviewButton(page).click();
    await page.getByRole('button', { name: 'Continue to Commit' }).click();
    await page.getByRole('button', { name: 'Commit Changes' }).click();

    await expect(page.getByRole('heading', { name: 'Commit message' })).toBeHidden({
      timeout: 120000,
    });
    await expect(page.locator('.file-details .error')).toHaveCount(0);
    const commitSuccess = page
      .locator('.file-details .success, .staged-toast')
      .filter({ hasText: /Overrides saved|Overrides committed/i });
    await expect(commitSuccess.first()).toBeVisible({ timeout: 120000 });

    const refreshButton = page.locator('button.microservice-pulse').first();
    await expect(refreshButton).toBeVisible();
    await refreshButton.click();
    const redeployButton = page.getByRole('button', {
      name: 'Redeploy FCOM Processor',
      exact: true,
    });
    await expect(redeployButton).toBeVisible({ timeout: 30000 });
    await redeployButton.click();

    await expect(page.getByText('Missing CustomValues for FCOM Processor')).toHaveCount(0);
    await expect(page.getByText('FCOM Processor redeployed')).toBeVisible({ timeout: 180000 });
    });

    test('Baseline gate API helper: revision 226 is enforceable', async ({ page }) => {
      await ensureRuleRevision(
        page,
        OVERRIDE_FILE_ID,
        BASELINE_REVISION,
        `TEST-BASELINE CHECK ${new Date().toISOString()}`,
      );
      await assertFileContent(page, OVERRIDE_FILE_ID, EXPECTED_DUMMYTRAP_OVERRIDE_AFTER_REVERT);
    });
  });
});
