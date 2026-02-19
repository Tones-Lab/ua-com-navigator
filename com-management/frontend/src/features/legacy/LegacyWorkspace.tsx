import { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from '../../components/EmptyState';
import InlineMessage from '../../components/InlineMessage';
import PanelHeader from '../../components/PanelHeader';
import useRequest from '../../hooks/useRequest';
import api from '../../services/api';
import type {
  LegacyApplyFcomOverridesResponse,
  LegacyReviewQueueResponse,
  LegacyRunPipelineResponse,
} from '../../types/api';
import { getApiErrorMessage } from '../../utils/errorUtils';
import LegacyMatchDiffsPanel from './components/LegacyMatchDiffsPanel';
import LegacyFolderFileSummaryPanel from './components/LegacyFolderFileSummaryPanel';
import LegacyObjectPreviewPanel from './components/LegacyObjectPreviewPanel';
import LegacyReportPreviewPanel from './components/LegacyReportPreviewPanel';
import LegacySelectedFilePanel from './components/LegacySelectedFilePanel';
import LegacyReportSummaryCards from './components/LegacyReportSummaryCards';
import LegacyTraversalDiagnosticsPanel from './components/LegacyTraversalDiagnosticsPanel';
import LegacyUploadsPanel from './components/LegacyUploadsPanel';
import LegacyConfidenceWorkflowPanel from './components/LegacyConfidenceWorkflowPanel';
import {
  applyEventFieldsToPayload,
  buildEditedPayloadOverrides,
  buildSuggestedEntriesFromResult,
  extractEventFields,
  type SuggestedEntry,
} from './legacySuggestedUtils';
import {
  buildLegacyConfidenceCalibrationExport,
  buildLegacyConfidencePreview,
  buildLegacyConfidenceDriftExport,
  computeLegacyConfidenceDrift,
  createLegacyConfidenceSnapshot,
  renderLegacyConfidenceCalibrationText,
  renderLegacyConfidenceDriftText,
  type LegacyConfidenceDrift,
  type LegacyConfidenceLevel,
  type LegacyConfidenceSnapshot,
} from './legacyConfidenceUtils';

type LegacyUploadEntry = {
  path: string;
  type: 'file' | 'folder';
  size: number;
  modifiedAt: string;
};

type LegacyWorkspaceProps = {
  hasEditPermission: boolean;
};

const LEGACY_SECTION_VISIBILITY_KEY = 'legacy.v2.sectionVisibility';
const LEGACY_SUGGESTED_VIEW_KEY = 'legacy.v2.suggestedView';
const LEGACY_CONFIDENCE_BASELINE_KEY = 'legacy.v2.confidenceBaseline';

type LegacySectionVisibility = {
  traversal: boolean;
  matchDiffs: boolean;
  rawReport: boolean;
};

type LegacySuggestedView = {
  densityMode: 'compact' | 'comfortable';
  sortMode: 'default' | 'dirty-first' | 'generated-first' | 'name-asc';
};

type ReviewDecisionValue = LegacyReviewQueueResponse['items'][number]['userDecision']['decision'];

type ReviewDecisionDraft = {
  decision: ReviewDecisionValue;
  reviewerNote: string;
  editedPayloadText: string;
  editedPayloadError: string | null;
};

const createDefaultReviewDecisionDraft = (
  item: LegacyReviewQueueResponse['items'][number],
): ReviewDecisionDraft => ({
  decision: item?.userDecision?.decision || 'unset',
  reviewerNote: item?.userDecision?.reviewerNote || '',
  editedPayloadText: item?.proposal?.processorPayload
    ? JSON.stringify(item.proposal.processorPayload, null, 2)
    : '',
  editedPayloadError: null,
});

export default function LegacyWorkspace({ hasEditPermission }: LegacyWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const matchPanelRef = useRef<HTMLDivElement | null>(null);
  const reviewPanelRef = useRef<HTMLDivElement | null>(null);
  const mappedSnippetLineRef = useRef<HTMLDivElement | null>(null);
  const [uploadRoot, setUploadRoot] = useState('');
  const [uploadEntries, setUploadEntries] = useState<LegacyUploadEntry[]>([]);
  const {
    loading: uploadsLoading,
    error: uploadsError,
    run: runUploadsRequest,
  } = useRequest();
  const {
    loading: uploading,
    error: uploadError,
    run: runUploadRequest,
  } = useRequest();
  const {
    loading: applyingOverrides,
    error: applyOverridesError,
    run: runApplyOverridesRequest,
  } = useRequest();
  const {
    loading: runningPipeline,
    error: runPipelineError,
    run: runPipelineRequest,
  } = useRequest();
  const {
    loading: loadingPipelineReport,
    error: loadPipelineReportError,
    run: runLoadPipelineReportRequest,
  } = useRequest();
  const {
    loading: buildingReviewQueue,
    error: buildReviewQueueError,
    run: runBuildReviewQueueRequest,
  } = useRequest();
  const [selectedEntry, setSelectedEntry] = useState<LegacyUploadEntry | null>(null);
  const [selectedContent, setSelectedContent] = useState('');
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'ready' | 'running'>('idle');
  const [reportText, setReportText] = useState('');
  const [reportJson, setReportJson] = useState<any | null>(null);
  const [reportSummary, setReportSummary] = useState<null | {
    totalFiles: number;
    totalLegacyObjects: number;
    totalOverrides: number;
    baselineMetrics?: {
      processorStubs?: {
        directRate?: number;
        conditionalRate?: number;
        manualRate?: number;
      };
      unresolvedMappings?: {
        total?: number;
        unique?: number;
      };
      matching?: {
        matchCoverageRate?: number;
        conflictRate?: number;
      };
    };
  }>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [showAllTraversalEntries, setShowAllTraversalEntries] = useState(false);
  const [showAllTraversalFiles, setShowAllTraversalFiles] = useState(false);
  const [lastRunLabel, setLastRunLabel] = useState<string | null>(null);
  const [objectTypeFilter, setObjectTypeFilter] = useState<'all' | 'fault' | 'performance' | 'unknown'>(
    'all',
  );
  const [filterHasCondition, setFilterHasCondition] = useState(false);
  const [filterHasHelpKey, setFilterHasHelpKey] = useState(false);
  const [filterMissingLookups, setFilterMissingLookups] = useState(false);
  const [filterHasPerfHints, setFilterHasPerfHints] = useState(false);
  const [filterWhy, setFilterWhy] = useState<string>('');
  const [showAllObjects, setShowAllObjects] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [snippetPulse, setSnippetPulse] = useState(false);
  const [matchSourceFilter, setMatchSourceFilter] = useState<'all' | 'fcom' | 'pcom' | 'mib'>('all');
  const [matchMethodFilter, setMatchMethodFilter] = useState<'all' | 'oid' | 'name' | 'heuristic'>(
    'all',
  );
  const [matchOnlyDiffs, setMatchOnlyDiffs] = useState(false);
  const [matchMinScore, setMatchMinScore] = useState('');
  const [matchSearch, setMatchSearch] = useState('');
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});
  const [matchOpenError, setMatchOpenError] = useState<string | null>(null);
  const [applyOverridesResult, setApplyOverridesResult] = useState<LegacyApplyFcomOverridesResponse | null>(
    null,
  );
  const [reviewQueueResult, setReviewQueueResult] = useState<LegacyReviewQueueResponse | null>(null);
  const [selectedReviewSourceFile, setSelectedReviewSourceFile] = useState('');
  const [reviewQueueIndex, setReviewQueueIndex] = useState(0);
  const [reviewDecisionByItemId, setReviewDecisionByItemId] = useState<Record<string, ReviewDecisionDraft>>({});
  const [reviewQueueFocusMode, setReviewQueueFocusMode] = useState(true);
  const [cloudyMatchThreshold, setCloudyMatchThreshold] = useState('10');
  const [suggestedEntries, setSuggestedEntries] = useState<SuggestedEntry[]>([]);
  const [selectedSuggestedKey, setSelectedSuggestedKey] = useState<string | null>(null);
  const [suggestedRawMode, setSuggestedRawMode] = useState(false);
  const [suggestedDirtyOnly, setSuggestedDirtyOnly] = useState(false);
  const [suggestedMatchedOnly, setSuggestedMatchedOnly] = useState(false);
  const [suggestedGeneratedOnly, setSuggestedGeneratedOnly] = useState(false);
  const [suggestedConflictOnly, setSuggestedConflictOnly] = useState(false);
  const [suggestedSearch, setSuggestedSearch] = useState('');
  const [suggestedView, setSuggestedView] = useState<LegacySuggestedView>(() => {
    if (typeof window === 'undefined') {
      return { densityMode: 'compact', sortMode: 'default' };
    }
    try {
      const stored = window.sessionStorage.getItem(LEGACY_SUGGESTED_VIEW_KEY);
      if (!stored) {
        return { densityMode: 'compact', sortMode: 'default' };
      }
      const parsed = JSON.parse(stored);
      return {
        densityMode: parsed?.densityMode === 'comfortable' ? 'comfortable' : 'compact',
        sortMode:
          parsed?.sortMode === 'dirty-first' ||
          parsed?.sortMode === 'generated-first' ||
          parsed?.sortMode === 'name-asc'
            ? parsed.sortMode
            : 'default',
      };
    } catch {
      return { densityMode: 'compact', sortMode: 'default' };
    }
  });
  const [sectionVisibility, setSectionVisibility] = useState<LegacySectionVisibility>(() => {
    if (typeof window === 'undefined') {
      return { traversal: false, matchDiffs: false, rawReport: false };
    }
    try {
      const stored = window.sessionStorage.getItem(LEGACY_SECTION_VISIBILITY_KEY);
      if (!stored) {
        return { traversal: false, matchDiffs: false, rawReport: false };
      }
      const parsed = JSON.parse(stored);
      return {
        traversal: Boolean(parsed?.traversal),
        matchDiffs: Boolean(parsed?.matchDiffs),
        rawReport: Boolean(parsed?.rawReport),
      };
    } catch {
      return { traversal: false, matchDiffs: false, rawReport: false };
    }
  });
  const [reviewHintText, setReviewHintText] = useState(
    'Preview runs a dry-run and jumps to Match diffs (FCOM + Only diffs) for review.',
  );
  const [llmReviewEnabled, setLlmReviewEnabled] = useState(false);
  const [confidenceMinLevel, setConfidenceMinLevel] = useState<LegacyConfidenceLevel>('medium');
  const [confidenceStrictMinLevel, setConfidenceStrictMinLevel] = useState(false);
  const [confidenceMaxItems, setConfidenceMaxItems] = useState('10');
  const [previousConfidenceSnapshot, setPreviousConfidenceSnapshot] =
    useState<LegacyConfidenceSnapshot | null>(null);
  const [confidenceDrift, setConfidenceDrift] = useState<LegacyConfidenceDrift | null>(null);
  const [confidenceDriftMeta, setConfidenceDriftMeta] = useState<{
    beforeGeneratedAt?: string;
    afterGeneratedAt?: string;
  } | null>(null);
  const [confidenceBaselineSnapshot, setConfidenceBaselineSnapshot] = useState<LegacyConfidenceSnapshot | null>(
    () => {
      if (typeof window === 'undefined') {
        return null;
      }
      try {
        const raw = window.localStorage.getItem(LEGACY_CONFIDENCE_BASELINE_KEY);
        if (!raw) {
          return null;
        }
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.selectedKeys) || typeof parsed.selectedMap !== 'object') {
          return null;
        }
        return parsed as LegacyConfidenceSnapshot;
      } catch {
        return null;
      }
    },
  );
  const [pipelineInputPath, setPipelineInputPath] = useState('');
  const [pipelineRunName, setPipelineRunName] = useState('legacy-run');
  const [pipelineOutputRoot, setPipelineOutputRoot] = useState('/root/navigator/tmp/legacy-analysis/pipeline');
  const [pipelineCompareMode, setPipelineCompareMode] = useState<'none' | 'latest' | 'before'>('latest');
  const [pipelineCompareBeforePath, setPipelineCompareBeforePath] = useState('');
  const [pipelineRunResult, setPipelineRunResult] = useState<LegacyRunPipelineResponse | null>(null);
  const [analysisProgressPct, setAnalysisProgressPct] = useState(0);
  const [analysisProgressLabel, setAnalysisProgressLabel] = useState('');
  const [uploadStepCollapsed, setUploadStepCollapsed] = useState(false);
  const [analysisStepCollapsed, setAnalysisStepCollapsed] = useState(false);
  const [reviewStepCollapsed, setReviewStepCollapsed] = useState(false);
  const [showAdvancedWizardOptions, setShowAdvancedWizardOptions] = useState(false);
  const [productionMode, setProductionMode] = useState(true);
  const autoCollapsedUploadRef = useRef(false);
  const autoCollapsedAnalysisRef = useRef(false);

  const traversal = reportJson?.traversal;
  const traversalFiles = Array.isArray(traversal?.orderedFiles) ? traversal.orderedFiles : [];
  const traversalMissing = Array.isArray(traversal?.missingFunctions) ? traversal.missingFunctions : [];
  const traversalEntries = Array.isArray(traversal?.entries) ? traversal.entries : [];
  const traversalLoadCalls = Array.isArray(traversal?.loadCalls) ? traversal.loadCalls : [];
  const traversalMissingLoadCalls = Array.isArray(traversal?.missingLoadCalls)
    ? traversal.missingLoadCalls
    : [];
  const traversalMissingIncludes = Array.isArray(traversal?.missingIncludePaths)
    ? traversal.missingIncludePaths
    : [];
  const traversalMissingLookups = Array.isArray(traversal?.missingLookupFiles)
    ? traversal.missingLookupFiles
    : [];
  const legacyObjects = Array.isArray(reportJson?.legacyObjects) ? reportJson.legacyObjects : [];
  const folderSummaries = Array.isArray(reportJson?.summaries?.byFolder)
    ? reportJson.summaries.byFolder
    : [];
  const fileSummaries = Array.isArray(reportJson?.summaries?.byFile)
    ? reportJson.summaries.byFile
    : [];
  const matchDiffs = Array.isArray(reportJson?.matchDiffs) ? reportJson.matchDiffs : [];
  const matchStats = reportJson?.matchStats || null;
  const classifications = Array.isArray(reportJson?.classifications) ? reportJson.classifications : [];
  const performanceHintCount = classifications.reduce(
    (acc: number, entry: any) => acc + (Array.isArray(entry?.evidence?.performanceHints) ? entry.evidence.performanceHints.length : 0),
    0,
  );
  const helpKeyCount = legacyObjects.reduce(
    (acc: number, obj: any) => acc + (Array.isArray(obj?.helpKeys) ? obj.helpKeys.length : 0),
    0,
  );
  const nodeCount = legacyObjects.reduce(
    (acc: number, obj: any) => acc + (Array.isArray(obj?.nodeValues) ? obj.nodeValues.length : 0),
    0,
  );
  const subNodeCount = legacyObjects.reduce(
    (acc: number, obj: any) => acc + (Array.isArray(obj?.subNodeValues) ? obj.subNodeValues.length : 0),
    0,
  );
  const hasTraversal =
    traversalFiles.length > 0 ||
    traversalMissing.length > 0 ||
    traversalEntries.length > 0 ||
    traversalLoadCalls.length > 0 ||
    traversalMissingLoadCalls.length > 0 ||
    traversalMissingIncludes.length > 0 ||
    traversalMissingLookups.length > 0;
  const reportRunId = reportJson?.runId ? String(reportJson.runId) : 'legacy-conversion-report';
  const safeReportId = reportRunId.replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').toLowerCase();
  const traversalCounts = traversalEntries.reduce(
    (acc: Record<string, number>, entry: any) => {
      const key = String(entry?.kind || 'unknown');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {},
  );
  const traversalCountText = Object.entries(traversalCounts)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
  const processorStubs = Array.isArray(reportJson?.stubs?.processorStubs)
    ? reportJson.stubs.processorStubs
    : [];
  const confidenceMaxItemsValue = Number(confidenceMaxItems);
  const confidencePreview = useMemo(
    () =>
      buildLegacyConfidencePreview(processorStubs, {
        minLevel: confidenceMinLevel,
        strictMinLevel: confidenceStrictMinLevel,
        maxItems:
          Number.isFinite(confidenceMaxItemsValue) && confidenceMaxItemsValue > 0
            ? Math.floor(confidenceMaxItemsValue)
            : 10,
      }),
    [processorStubs, confidenceMinLevel, confidenceStrictMinLevel, confidenceMaxItemsValue],
  );

  const loadUploads = async () => {
    const resp = await runUploadsRequest(() => api.listLegacyUploads(), {
      getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to load uploads'),
    });
    if (!resp) {
      return;
    }
    setUploadRoot(String(resp.data?.root || ''));
    const entries = Array.isArray(resp.data?.entries) ? resp.data.entries : [];
    setUploadEntries(entries);
    const filePaths = entries
      .filter((entry: LegacyUploadEntry) => entry.type === 'file')
      .map((entry: LegacyUploadEntry) => entry.path);
    setSelectedPaths((prev) => {
      const preserved = prev.filter((value) => filePaths.includes(value));
      return preserved.length > 0 ? preserved : filePaths;
    });
  };

  useEffect(() => {
    void loadUploads();
  }, []);

  useEffect(() => {
    setShowAllTraversalEntries(false);
    setShowAllTraversalFiles(false);
    setShowAllObjects(false);
    setObjectTypeFilter('all');
    setFilterHasCondition(false);
    setFilterHasHelpKey(false);
    setFilterMissingLookups(false);
    setFilterHasPerfHints(false);
    setFilterWhy('');
    setSelectedObjectId(null);
    setSnippetPulse(false);
    setMatchSourceFilter('all');
    setMatchMethodFilter('all');
    setMatchOnlyDiffs(false);
    setMatchMinScore('');
    setMatchSearch('');
    setShowAllMatches(false);
    setExpandedMatches({});
    setMatchOpenError(null);
    setApplyOverridesResult(null);
    setCloudyMatchThreshold('10');
    setSuggestedEntries([]);
    setSelectedSuggestedKey(null);
    setSuggestedRawMode(false);
    setSuggestedDirtyOnly(false);
    setSuggestedMatchedOnly(false);
    setSuggestedGeneratedOnly(false);
    setSuggestedConflictOnly(false);
    setSuggestedSearch('');
    setReviewHintText('Preview runs a dry-run and jumps to Match diffs (FCOM + Only diffs) for review.');
  }, [reportRunId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.setItem(LEGACY_SECTION_VISIBILITY_KEY, JSON.stringify(sectionVisibility));
  }, [sectionVisibility]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.sessionStorage.setItem(LEGACY_SUGGESTED_VIEW_KEY, JSON.stringify(suggestedView));
  }, [suggestedView]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (!confidenceBaselineSnapshot) {
      window.localStorage.removeItem(LEGACY_CONFIDENCE_BASELINE_KEY);
      return;
    }
    window.localStorage.setItem(LEGACY_CONFIDENCE_BASELINE_KEY, JSON.stringify(confidenceBaselineSnapshot));
  }, [confidenceBaselineSnapshot]);

  useEffect(() => {
    if (!pipelineInputPath.trim() && uploadRoot) {
      setPipelineInputPath(uploadRoot);
    }
  }, [uploadRoot, pipelineInputPath]);

  useEffect(() => {
    if (!selectedObjectId) {
      return;
    }
    setSnippetPulse(true);
    const timeout = window.setTimeout(() => setSnippetPulse(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [selectedObjectId]);

  const handleUpload = async () => {
    const files = fileInputRef.current?.files;
    if (!files || files.length === 0) {
      return;
    }
    const resp = await runUploadRequest(() => api.uploadLegacyFiles(Array.from(files)), {
      getErrorMessage: (err) => getApiErrorMessage(err, 'Upload failed'),
    });
    if (!resp) {
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    await loadUploads();
  };

  const openEntry = async (entry: LegacyUploadEntry) => {
    if (entry.type !== 'file') {
      return;
    }
    setSelectedEntry(entry);
    setSelectedContent('');
    try {
      const resp = await api.readLegacyUpload(entry.path);
      setSelectedContent(String(resp.data?.content || ''));
    } catch (error: unknown) {
      setSelectedContent(getApiErrorMessage(error, 'Failed to read file.'));
    }
  };

  const fileEntries = uploadEntries.filter((entry) => entry.type === 'file');
  const hasUploadedFiles = fileEntries.length > 0;
  const hasPipelineRun = Boolean(pipelineRunResult);
  const hasReviewData = Boolean(reportJson || reportText);
  const isReadyToConvert = fileEntries.length > 0;
  const hasSelection = selectedPaths.length > 0;
  const conversionStatusText = (() => {
    if (conversionStatus === 'running') {
      return 'Running conversion';
    }
    if (reportError) {
      return 'Conversion failed';
    }
    if (lastRunLabel) {
      return lastRunLabel;
    }
    if (isReadyToConvert) {
      return 'Ready to run';
    }
    return 'Waiting for files';
  })();
  const conversionStatusTone = reportError
    ? 'error'
    : conversionStatus === 'running'
      ? 'running'
      : isReadyToConvert
        ? 'ready'
        : 'idle';

  useEffect(() => {
    if (!hasUploadedFiles) {
      autoCollapsedUploadRef.current = false;
      setUploadStepCollapsed(false);
      return;
    }
    if (!autoCollapsedUploadRef.current) {
      setUploadStepCollapsed(true);
      setAnalysisStepCollapsed(false);
      autoCollapsedUploadRef.current = true;
    }
  }, [hasUploadedFiles]);

  useEffect(() => {
    if (!hasPipelineRun) {
      autoCollapsedAnalysisRef.current = false;
      return;
    }
    if (!autoCollapsedAnalysisRef.current) {
      setAnalysisStepCollapsed(true);
      setReviewStepCollapsed(false);
      autoCollapsedAnalysisRef.current = true;
    }
  }, [hasPipelineRun]);

  const toggleSelectedPath = (pathId: string) => {
    setSelectedPaths((prev) =>
      prev.includes(pathId) ? prev.filter((entry) => entry !== pathId) : [...prev, pathId],
    );
  };

  const selectAllPaths = () => {
    setSelectedPaths(fileEntries.map((entry) => entry.path));
  };

  const deselectAllPaths = () => {
    setSelectedPaths([]);
  };

  const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getReportFilename = (suffix: string) => {
    return `${safeReportId}.${suffix}`;
  };

  const downloadJson = (filename: string, data: any) => {
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyTraversalOrder = async () => {
    if (traversalFiles.length === 0) {
      return;
    }
    await copyTextToClipboard(traversalFiles.join('\n'));
  };

  const copyTextToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      document.body.removeChild(area);
    }
  };

  const copyMissingFunctions = async () => {
    if (traversalMissing.length === 0) {
      return;
    }
    await copyTextToClipboard(traversalMissing.join('\n'));
  };

  const quoteShellArg = (value: string) => `"${String(value).replace(/(["\\$`])/g, '\\$1')}"`;

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const openMatchFile = async (entry: any) => {
    const filePath = entry?.matchedObject?.path;
    if (!filePath) {
      return;
    }
    setMatchOpenError(null);
    try {
      const resp = await api.readLegacyMatchFile(filePath);
      const content = String(resp.data?.content || '');
      const title = resp.data?.path || filePath;
      const win = window.open('', '_blank');
      if (!win) {
        setMatchOpenError('Pop-up blocked. Allow pop-ups to open the match file.');
        return;
      }
      win.document.title = title;
      win.document.body.innerHTML = `<pre style="white-space:pre-wrap;font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">${escapeHtml(content)}</pre>`;
    } catch (error: unknown) {
      setMatchOpenError(getApiErrorMessage(error, 'Failed to open match file.'));
    }
  };

  const buildApplyPreviewFromResult = (result: LegacyApplyFcomOverridesResponse | null) => ({
    overrides: Array.isArray(result?.overrides)
      ? result.overrides.map((entry) => ({
          objectName: entry?.objectName,
          sourceFiles: entry?.sourceFiles,
        }))
      : [],
    generatedDefinitions: Array.isArray(result?.generatedDefinitions)
      ? result.generatedDefinitions.map((entry) => ({
          objectName: entry?.objectName,
          sourceFile: entry?.sourceFile,
        }))
      : [],
    conflicts: Array.isArray(result?.conflicts)
      ? result.conflicts.map((entry) => ({
          objectName: entry?.objectName,
          conflicts: Array.isArray(entry?.conflicts)
            ? entry.conflicts.map((conflict) => ({
                field: conflict?.field,
              }))
            : [],
        }))
      : [],
  });

  const buildReviewQueueForReport = async (
    reportPayload: Record<string, any>,
    applyPreview?: Record<string, any>,
    focusMode: boolean = reviewQueueFocusMode,
  ) => {
    const queueResp = await runBuildReviewQueueRequest(
      () =>
        api.buildLegacyReviewQueue({
          report: reportPayload,
          applyPreview,
          options: {
            hideHighConfidence: focusMode,
            needsInterventionOnly: focusMode,
            maxItems: 500,
          },
        }),
      {
        getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to build review queue'),
      },
    );
    if (queueResp) {
      setReviewQueueResult(queueResp.data || null);
      setSelectedReviewSourceFile('');
      setReviewQueueIndex(0);
      setReviewDecisionByItemId({});
    }
  };

  const runConversion = async (mode: 'preview' | 'run') => {
    if (!isReadyToConvert) {
      return;
    }
    setConversionStatus('running');
    setReportError(null);
    setReportText('');
    setReportJson(null);
    setReviewQueueResult(null);
    setSelectedReviewSourceFile('');
    setReviewQueueIndex(0);
    setReviewDecisionByItemId({});
    setLastRunLabel(null);
    setConfidenceDrift(null);
    setConfidenceDriftMeta(null);
    try {
      const resp = await api.runLegacyConversion({
        paths: hasSelection ? selectedPaths : undefined,
        useLlmReview: llmReviewEnabled,
      });
      setReportText(String(resp.data?.textReport || ''));
      setReportJson(resp.data?.report || null);
      await buildReviewQueueForReport(resp.data?.report || {});
      const nextProcessorStubs = Array.isArray(resp.data?.report?.stubs?.processorStubs)
        ? resp.data.report.stubs.processorStubs
        : [];
      const nextPreview = buildLegacyConfidencePreview(nextProcessorStubs, {
        minLevel: confidenceMinLevel,
        strictMinLevel: confidenceStrictMinLevel,
        maxItems:
          Number.isFinite(confidenceMaxItemsValue) && confidenceMaxItemsValue > 0
            ? Math.floor(confidenceMaxItemsValue)
            : 10,
      });
      const nextSnapshot = createLegacyConfidenceSnapshot(nextPreview);
      const beforeSnapshot = confidenceBaselineSnapshot || previousConfidenceSnapshot;
      setConfidenceDrift(
        beforeSnapshot
          ? computeLegacyConfidenceDrift(beforeSnapshot, nextSnapshot)
          : null,
      );
      setConfidenceDriftMeta(
        beforeSnapshot
          ? {
              beforeGeneratedAt: beforeSnapshot.generatedAt,
              afterGeneratedAt: nextSnapshot.generatedAt,
            }
          : null,
      );
      setPreviousConfidenceSnapshot(nextSnapshot);
      const summary = resp.data?.report?.summary;
      const baselineMetrics = resp.data?.report?.baselineMetrics;
      if (summary) {
        setReportSummary({
          totalFiles: Number(summary.totalFiles || 0),
          totalLegacyObjects: Number(summary.totalLegacyObjects || 0),
          totalOverrides: Number(summary.totalOverrides || 0),
          baselineMetrics:
            baselineMetrics && typeof baselineMetrics === 'object' ? baselineMetrics : undefined,
        });
      }
      setLastRunLabel(mode === 'preview' ? 'Preview report generated' : 'Conversion completed');
      setConversionStatus(mode === 'preview' ? 'ready' : 'idle');
      window.setTimeout(() => {
        reviewPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        reviewPanelRef.current?.focus({ preventScroll: true });
      }, 120);
    } catch (error: unknown) {
      setReportError(getApiErrorMessage(error, 'Conversion failed'));
      setLastRunLabel('Conversion failed');
      setConversionStatus('idle');
    }
  };

  const jumpToConfirmedReview = () => {
    setMatchSourceFilter('fcom');
    setMatchOnlyDiffs(true);
    setShowAllMatches(true);
    setSectionVisibility((prev) => ({
      ...prev,
      matchDiffs: true,
    }));
    window.setTimeout(() => {
      matchPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      matchPanelRef.current?.focus({ preventScroll: true });
    }, 80);
  };

  const applyConfirmedOverrides = async (dryRun: boolean, autoRefresh: boolean = false) => {
    if (!reportJson) {
      return;
    }
    const parsedThreshold = Number(cloudyMatchThreshold);
    const minScore = Number.isFinite(parsedThreshold) ? Math.max(0, parsedThreshold) : 10;
    const resp = await runApplyOverridesRequest(
      () =>
        api.applyLegacyFcomOverrides({
          report: reportJson,
          dryRun,
          minScore,
          ...(!autoRefresh && suggestedEntries.length > 0
            ? buildEditedPayloadOverrides(suggestedEntries)
            : {}),
        }),
      {
        getErrorMessage: (err) =>
          getApiErrorMessage(err, dryRun ? 'Failed to preview confirmed overrides' : 'Failed to create confirmed override bundle'),
      },
    );
    if (!resp) {
      return;
    }
    setApplyOverridesResult(resp.data);
    const applyPreview = buildApplyPreviewFromResult(resp.data);
    await buildReviewQueueForReport(reportJson, applyPreview);
    const nextSuggestedEntries = buildSuggestedEntriesFromResult(resp.data);
    setSuggestedEntries(nextSuggestedEntries);
    setSelectedSuggestedKey((prev) => {
      if (prev && nextSuggestedEntries.some((entry) => entry.key === prev)) {
        return prev;
      }
      return nextSuggestedEntries[0]?.key || null;
    });
    if (!autoRefresh) {
      setReviewHintText(
        dryRun
          ? 'Review loaded below ↓ Match diffs is focused with FCOM + Only diffs filters.'
          : 'Bundle created. Review loaded below ↓ Match diffs is focused with FCOM + Only diffs filters.',
      );
      jumpToConfirmedReview();
    }
    if (!dryRun) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadJson(`confirmed-fcom-overrides-${stamp}.json`, resp.data);
    }
  };

  useEffect(() => {
    if (!reportJson) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void applyConfirmedOverrides(true, true);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [reportJson, cloudyMatchThreshold]);

  const updateSuggestedField = (key: string, field: string, value: string) => {
    setSuggestedEntries((prev) =>
      prev.map((entry) => {
        if (entry.key !== key) {
          return entry;
        }
        const nextFields = entry.fields.map((item) =>
          item.field === field
            ? {
                ...item,
                value,
              }
            : item,
        );
        const nextPayload = applyEventFieldsToPayload(entry.payload, nextFields);
        return {
          ...entry,
          fields: nextFields,
          payload: nextPayload,
          rawText: JSON.stringify(nextPayload, null, 2),
          rawError: null,
        };
      }),
    );
  };

  const updateSuggestedRaw = (key: string, rawText: string) => {
    setSuggestedEntries((prev) =>
      prev.map((entry) => {
        if (entry.key !== key) {
          return entry;
        }
        try {
          const parsed = JSON.parse(rawText);
          return {
            ...entry,
            rawText,
            payload: parsed,
            fields: extractEventFields(parsed),
            rawError: null,
          };
        } catch {
          return {
            ...entry,
            rawText,
            rawError: 'Invalid JSON',
          };
        }
      }),
    );
  };

  const downloadHint = [
    reportText ? getReportFilename('txt') : null,
    reportJson ? getReportFilename('json') : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const filteredObjects = legacyObjects.filter((obj: any) => {
    if (objectTypeFilter !== 'all' && obj.ruleType !== objectTypeFilter) {
      return false;
    }
    if (filterHasCondition && !obj?.traversal?.condition) {
      return false;
    }
    if (filterHasHelpKey && (!Array.isArray(obj?.helpKeys) || obj.helpKeys.length === 0)) {
      return false;
    }
    if (filterHasPerfHints) {
      const hints = Array.isArray(obj?.performanceHints) ? obj.performanceHints : [];
      if (hints.length === 0) {
        return false;
      }
    }
    if (filterMissingLookups && traversalMissingLookups.length === 0) {
      return false;
    }
    if (filterWhy.trim()) {
      const value = filterWhy.trim().toLowerCase();
      const hints = Array.isArray(obj?.classificationHints) ? obj.classificationHints : [];
      if (!hints.some((hint: string) => hint.toLowerCase().includes(value))) {
        return false;
      }
    }
    return true;
  });

  const matchScoreMinValue = Number(matchMinScore);
  const hasMatchScoreMin = matchMinScore.trim() !== '' && !Number.isNaN(matchScoreMinValue);
  const matchSearchValue = matchSearch.trim().toLowerCase();
  const filteredMatchDiffs = matchDiffs.filter((entry: any) => {
    if (matchSourceFilter !== 'all') {
      if (!entry?.matchedObject || entry.matchedObject.source !== matchSourceFilter) {
        return false;
      }
    }
    if (matchMethodFilter !== 'all' && entry?.matchMethod !== matchMethodFilter) {
      return false;
    }
    if (matchOnlyDiffs && (!Array.isArray(entry?.diffs) || entry.diffs.length === 0)) {
      return false;
    }
    if (hasMatchScoreMin) {
      const scoreValue = Number(entry?.matchScore || 0);
      if (Number.isNaN(scoreValue) || scoreValue < matchScoreMinValue) {
        return false;
      }
    }
    if (matchSearchValue) {
      const legacyName = String(entry?.legacyObjectName || '').toLowerCase();
      const matchedName = String(entry?.matchedObject?.name || '').toLowerCase();
      const sourceFile = String(entry?.sourceFile || '').toLowerCase();
      if (
        !legacyName.includes(matchSearchValue) &&
        !matchedName.includes(matchSearchValue) &&
        !sourceFile.includes(matchSearchValue)
      ) {
        return false;
      }
    }
    return true;
  });

  const visibleMatches = showAllMatches ? filteredMatchDiffs : filteredMatchDiffs.slice(0, 8);
  const hasSuggestedRawErrors = suggestedEntries.some((entry) => Boolean(entry.rawError));
  const conflictCountsByObject = useMemo(() => {
    const map: Record<string, number> = {};
    (applyOverridesResult?.conflicts || []).forEach((entry) => {
      const key = String(entry?.objectName || '').trim();
      if (!key) {
        return;
      }
      map[key] = Array.isArray(entry?.conflicts) ? entry.conflicts.length : 0;
    });
    return map;
  }, [applyOverridesResult]);

  const visibleObjects = showAllObjects ? filteredObjects : filteredObjects.slice(0, 12);
  const selectedObject = selectedObjectId
    ? legacyObjects.find((obj: any) => obj.id === selectedObjectId) || null
    : null;
  const reviewQueueItemsAll = Array.isArray(reviewQueueResult?.items) ? reviewQueueResult.items : [];
  const reviewSourceFiles = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    reviewQueueItemsAll.forEach((item) => {
      const sourceFile = String(item?.source?.sourceFile || '').trim();
      if (!sourceFile || seen.has(sourceFile)) {
        return;
      }
      seen.add(sourceFile);
      ordered.push(sourceFile);
    });
    return ordered;
  }, [reviewQueueItemsAll]);
  const effectiveReviewSourceFile = selectedReviewSourceFile || reviewSourceFiles[0] || '';
  const reviewQueueItems = useMemo(() => {
    const scoped = reviewQueueItemsAll.filter((item) => item.source.sourceFile === effectiveReviewSourceFile);
    return [...scoped].sort((left, right) => {
      const leftLine =
        left.source.mappedLineStart ?? left.source.mappedLineNumber ?? left.source.sourceLineStart ?? Number.MAX_SAFE_INTEGER;
      const rightLine =
        right.source.mappedLineStart ?? right.source.mappedLineNumber ?? right.source.sourceLineStart ?? Number.MAX_SAFE_INTEGER;
      if (leftLine !== rightLine) {
        return leftLine - rightLine;
      }
      return left.target.targetField.localeCompare(right.target.targetField);
    });
  }, [reviewQueueItemsAll, effectiveReviewSourceFile]);
  const selectedReviewFileIndex = reviewSourceFiles.findIndex((filePath) => filePath === effectiveReviewSourceFile);
  const boundedReviewQueueIndex = reviewQueueItems.length === 0
    ? 0
    : Math.min(Math.max(reviewQueueIndex, 0), reviewQueueItems.length - 1);
  const activeReviewItem = reviewQueueItems[boundedReviewQueueIndex] || null;
  const reviewQueueItemsForFile = useMemo(
    () =>
      reviewQueueItems.map((item, index) => {
        const lineStart = item.source.mappedLineStart ?? item.source.mappedLineNumber ?? item.source.sourceLineStart ?? null;
        const lineEnd = item.source.mappedLineEnd ?? lineStart;
        const decision = reviewDecisionByItemId[item.reviewItemId]?.decision || 'unset';
        return {
          item,
          index,
          lineStart,
          lineEnd,
          decision,
        };
      }),
    [reviewQueueItems, reviewDecisionByItemId],
  );
  const reviewQueueIndexesBySourceLine = useMemo(() => {
    const map = new Map<number, number[]>();
    reviewQueueItems.forEach((item, index) => {
      const lineStart = item.source.mappedLineStart ?? item.source.mappedLineNumber ?? item.source.sourceLineStart;
      const lineEnd = item.source.mappedLineEnd ?? lineStart;
      if (!Number.isFinite(Number(lineStart)) || !Number.isFinite(Number(lineEnd))) {
        return;
      }
      const normalizedStart = Number(lineStart);
      const normalizedEnd = Number(lineEnd);
      const boundedEnd = normalizedEnd >= normalizedStart ? Math.min(normalizedEnd, normalizedStart + 120) : normalizedStart;
      for (let line = normalizedStart; line <= boundedEnd; line += 1) {
        const indexes = map.get(line) || [];
        indexes.push(index);
        map.set(line, indexes);
      }
    });
    return map;
  }, [reviewQueueItems]);
  const activeBranchHighlightRange = useMemo(() => {
    const startLine = activeReviewItem?.reviewGroup?.branchLineStart;
    const endLine = activeReviewItem?.reviewGroup?.branchLineEnd;
    if (!Number.isFinite(Number(startLine)) || !Number.isFinite(Number(endLine))) {
      return null;
    }
    const start = Number(startLine);
    const end = Number(endLine);
    if (end < start) {
      return null;
    }
    if (end - start > 120) {
      return null;
    }
    return { start, end };
  }, [activeReviewItem]);
  const activeSourceSnippetLines = useMemo(() => {
    if (!activeReviewItem?.source?.sourceSnippet) {
      return [] as Array<{
        lineNumber: number;
        text: string;
        queueIndexes: number[];
        hasQueueLink: boolean;
      }>;
    }
    const startLine = activeReviewItem.source.sourceLineStart ?? 1;
    return String(activeReviewItem.source.sourceSnippet)
      .split(/\r?\n/)
      .map((line, index) => {
        const lineNumber = startLine + index;
        const queueIndexes = reviewQueueIndexesBySourceLine.get(lineNumber) || [];
        return {
          lineNumber,
          text: line,
          queueIndexes,
          hasQueueLink: queueIndexes.length > 0,
        };
      });
  }, [activeReviewItem, reviewQueueIndexesBySourceLine]);
  const activeLinkedSourceTargets = useMemo(
    () =>
      activeSourceSnippetLines
        .filter((entry) => entry.hasQueueLink)
        .map((entry) => ({ lineNumber: entry.lineNumber, queueIndex: entry.queueIndexes[0] })),
    [activeSourceSnippetLines],
  );
  const activeMappedAnchorLine =
    activeReviewItem?.source?.mappedLineStart ??
    activeReviewItem?.source?.mappedLineNumber ??
    activeReviewItem?.source?.sourceLineStart ??
    null;
  const activeLinkedSourceCursor = useMemo(() => {
    if (activeLinkedSourceTargets.length === 0) {
      return -1;
    }
    const anchor = Number(activeMappedAnchorLine);
    if (!Number.isFinite(anchor)) {
      return 0;
    }
    const exact = activeLinkedSourceTargets.findIndex((entry) => entry.lineNumber === anchor);
    if (exact >= 0) {
      return exact;
    }
    const next = activeLinkedSourceTargets.findIndex((entry) => entry.lineNumber > anchor);
    if (next >= 0) {
      return next;
    }
    return activeLinkedSourceTargets.length - 1;
  }, [activeLinkedSourceTargets, activeMappedAnchorLine]);
  const previousLinkedSourceTarget =
    activeLinkedSourceCursor > 0 ? activeLinkedSourceTargets[activeLinkedSourceCursor - 1] : null;
  const nextLinkedSourceTarget =
    activeLinkedSourceCursor >= 0 && activeLinkedSourceCursor < activeLinkedSourceTargets.length - 1
      ? activeLinkedSourceTargets[activeLinkedSourceCursor + 1]
      : null;
  const activeMappedSourceLabel = useMemo(() => {
    if (!activeReviewItem) {
      return 'Mapped source line: n/a';
    }
    const mappedStart = activeReviewItem.source.mappedLineStart ?? activeReviewItem.source.mappedLineNumber ?? null;
    const mappedEnd = activeReviewItem.source.mappedLineEnd ?? mappedStart;
    if (!Number.isFinite(Number(mappedStart))) {
      return 'Mapped source line: n/a';
    }
    const start = Number(mappedStart);
    const end = Number.isFinite(Number(mappedEnd)) ? Number(mappedEnd) : start;
    const lineLabel = end > start ? `L${start}-${end}` : `L${start}`;
    const mappedText = String(activeReviewItem.source.mappedLineText || '').trim();
    return mappedText ? `Mapped source range: ${lineLabel} · ${mappedText}` : `Mapped source range: ${lineLabel}`;
  }, [activeReviewItem]);
  useEffect(() => {
    if (!activeReviewItem) {
      return;
    }
    window.setTimeout(() => {
      mappedSnippetLineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [activeReviewItem?.reviewItemId, activeReviewItem?.source?.mappedLineStart, activeReviewItem?.source?.mappedLineEnd]);
  const activeReviewItemPayload = activeReviewItem?.proposal?.processorPayload
    ? JSON.stringify(activeReviewItem.proposal.processorPayload, null, 2)
    : '';
  const activeReviewDecisionDraft = activeReviewItem
    ? reviewDecisionByItemId[activeReviewItem.reviewItemId] || createDefaultReviewDecisionDraft(activeReviewItem)
    : null;
  const reviewDecisionCounts = useMemo(
    () =>
      reviewQueueItemsAll.reduce(
        (acc, item) => {
          const decision = reviewDecisionByItemId[item.reviewItemId]?.decision || 'unset';
          acc[decision] += 1;
          return acc;
        },
        {
          accepted: 0,
          edited: 0,
          rejected: 0,
          deferred: 0,
          unset: 0,
        } as Record<ReviewDecisionValue, number>,
      ),
    [reviewQueueItemsAll, reviewDecisionByItemId],
  );
  const pendingReviewCount = reviewQueueItemsAll.reduce((acc, item) => {
    const decision = reviewDecisionByItemId[item.reviewItemId]?.decision || 'unset';
    return acc + (decision === 'unset' ? 1 : 0);
  }, 0);
  const nextPendingQueueIndex = useMemo(() => {
    if (reviewQueueItems.length === 0) {
      return -1;
    }
    const start = Math.min(Math.max(reviewQueueIndex, 0), reviewQueueItems.length - 1);
    for (let offset = 1; offset <= reviewQueueItems.length; offset += 1) {
      const candidate = (start + offset) % reviewQueueItems.length;
      const item = reviewQueueItems[candidate];
      const decision = reviewDecisionByItemId[item.reviewItemId]?.decision || 'unset';
      if (decision === 'unset') {
        return candidate;
      }
    }
    return -1;
  }, [reviewQueueItems, reviewQueueIndex, reviewDecisionByItemId]);
  const activeGroupId = activeReviewItem?.reviewGroup?.groupId || null;
  const activeGroupItemIndexes = useMemo(() => {
    if (!activeGroupId) {
      return [] as number[];
    }
    return reviewQueueItems
      .map((item, index) => ({ item, index }))
      .filter((entry) => entry.item.reviewGroup?.groupId === activeGroupId)
      .map((entry) => entry.index);
  }, [reviewQueueItems, activeGroupId]);
  const nextPendingGroupQueueIndex = useMemo(() => {
    if (reviewQueueItems.length === 0 || !activeGroupId) {
      return -1;
    }
    const seen = new Set<string>();
    for (let offset = 1; offset <= reviewQueueItems.length; offset += 1) {
      const candidate = (boundedReviewQueueIndex + offset) % reviewQueueItems.length;
      const candidateItem = reviewQueueItems[candidate];
      const candidateGroup = candidateItem.reviewGroup?.groupId || `solo-${candidate}`;
      if (seen.has(candidateGroup)) {
        continue;
      }
      seen.add(candidateGroup);
      const groupItems = reviewQueueItems.filter((entry) => (entry.reviewGroup?.groupId || '') === candidateGroup);
      const hasPending = groupItems.some(
        (entry) => (reviewDecisionByItemId[entry.reviewItemId]?.decision || 'unset') === 'unset',
      );
      if (hasPending) {
        return candidate;
      }
    }
    return -1;
  }, [reviewQueueItems, boundedReviewQueueIndex, activeGroupId, reviewDecisionByItemId]);
  const selectedFileAnalysis = selectedObject
    ? reportJson?.files?.find((entry: any) => entry.filePath === selectedObject.sourceFile) || null
    : null;
  const selectedBlock = selectedFileAnalysis?.functionBlocks?.find(
    (block: any) => block.name === selectedObject?.ruleFunction,
  );
  const selectedSnippet = selectedBlock?.text || '';
  const snippetLines = selectedSnippet ? selectedSnippet.split(/\r?\n/) : [];
  const snippetStartLine = Number(selectedBlock?.startLine || 1);

  useEffect(() => {
    if (!effectiveReviewSourceFile && reviewSourceFiles.length > 0) {
      setSelectedReviewSourceFile(reviewSourceFiles[0]);
      setReviewQueueIndex(0);
      return;
    }
    if (effectiveReviewSourceFile && !reviewSourceFiles.includes(effectiveReviewSourceFile)) {
      setSelectedReviewSourceFile(reviewSourceFiles[0] || '');
      setReviewQueueIndex(0);
    }
  }, [effectiveReviewSourceFile, reviewSourceFiles]);

  useEffect(() => {
    if (reviewQueueItemsAll.length === 0) {
      return;
    }
    setReviewDecisionByItemId((prev) => {
      const next = { ...prev };
      let changed = false;
      reviewQueueItemsAll.forEach((item) => {
        if (!next[item.reviewItemId]) {
          next[item.reviewItemId] = createDefaultReviewDecisionDraft(item);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [reviewQueueItemsAll]);

  const updateActiveReviewDecisionDraft = (changes: Partial<ReviewDecisionDraft>) => {
    if (!activeReviewItem) {
      return;
    }
    setReviewDecisionByItemId((prev) => {
      const current = prev[activeReviewItem.reviewItemId] || createDefaultReviewDecisionDraft(activeReviewItem);
      return {
        ...prev,
        [activeReviewItem.reviewItemId]: {
          ...current,
          ...changes,
        },
      };
    });
  };

  const updateActiveEditedPayloadText = (value: string) => {
    if (!activeReviewItem) {
      return;
    }
    const text = value;
    if (!text.trim()) {
      updateActiveReviewDecisionDraft({ editedPayloadText: text, editedPayloadError: null });
      return;
    }
    try {
      JSON.parse(text);
      updateActiveReviewDecisionDraft({ editedPayloadText: text, editedPayloadError: null });
    } catch {
      updateActiveReviewDecisionDraft({ editedPayloadText: text, editedPayloadError: 'Invalid JSON payload' });
    }
  };

  const setDecisionAndAdvance = (decision: ReviewDecisionValue) => {
    if (!activeReviewItem) {
      return;
    }
    updateActiveReviewDecisionDraft({ decision });
    if (nextPendingQueueIndex >= 0) {
      setReviewQueueIndex(nextPendingQueueIndex);
      return;
    }
    if (boundedReviewQueueIndex < reviewQueueItems.length - 1) {
      setReviewQueueIndex((prev) => Math.min(reviewQueueItems.length - 1, prev + 1));
    }
  };

  const setGroupDecisionAndAdvance = (decision: ReviewDecisionValue) => {
    if (!activeGroupId || activeGroupItemIndexes.length === 0) {
      return;
    }
    setReviewDecisionByItemId((prev) => {
      const next = { ...prev };
      activeGroupItemIndexes.forEach((index) => {
        const item = reviewQueueItems[index];
        const existing = next[item.reviewItemId] || createDefaultReviewDecisionDraft(item);
        next[item.reviewItemId] = {
          ...existing,
          decision,
        };
      });
      return next;
    });
    if (nextPendingGroupQueueIndex >= 0) {
      setReviewQueueIndex(nextPendingGroupQueueIndex);
      return;
    }
    if (boundedReviewQueueIndex < reviewQueueItems.length - 1) {
      setReviewQueueIndex((prev) => Math.min(reviewQueueItems.length - 1, prev + 1));
    }
  };

  const exportObjectsCsv = () => {
    if (filteredObjects.length === 0) {
      return;
    }
    const escapeCsv = (value: any) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };
    const rows = [
      [
        'ruleFunction',
        'ruleType',
        'sourceFile',
        'oids',
        'helpKeys',
        'nodeValues',
        'subNodeValues',
        'traversalKind',
        'traversalCondition',
      ].join(','),
    ];
    filteredObjects.forEach((obj: any) => {
      rows.push(
        [
          escapeCsv(obj.ruleFunction),
          escapeCsv(obj.ruleType),
          escapeCsv(obj.sourceFile),
          escapeCsv((obj.oids || []).join(' | ')),
          escapeCsv((obj.helpKeys || []).join(' | ')),
          escapeCsv((obj.nodeValues || []).join(' | ')),
          escapeCsv((obj.subNodeValues || []).join(' | ')),
          escapeCsv(obj?.traversal?.kind || ''),
          escapeCsv(obj?.traversal?.condition || ''),
        ].join(','),
      );
    });
    const content = rows.join('\n');
    downloadText(getReportFilename('objects.csv'), content);
  };

  const exportReviewQueueDecisions = () => {
    if (!reviewQueueResult) {
      return;
    }
    const payload = {
      queueId: reviewQueueResult.queueId,
      generatedAt: reviewQueueResult.generatedAt,
      options: reviewQueueResult.options,
      summary: reviewQueueResult.summary,
      decisionCounts: reviewDecisionCounts,
      items: reviewQueueItemsAll.map((item) => {
        const draft = reviewDecisionByItemId[item.reviewItemId] || createDefaultReviewDecisionDraft(item);
        let editedPayload: Record<string, any> | null = null;
        if (draft.decision === 'edited' && draft.editedPayloadText.trim() && !draft.editedPayloadError) {
          try {
            editedPayload = JSON.parse(draft.editedPayloadText);
          } catch {
            editedPayload = null;
          }
        }
        return {
          reviewItemId: item.reviewItemId,
          queueIndex: item.queueIndex,
          objectName: item.target.objectName,
          targetField: item.target.targetField,
          decision: draft.decision,
          reviewerNote: draft.reviewerNote,
          editedPayload,
        };
      }),
    };
    downloadJson(getReportFilename('review-queue-decisions.json'), payload);
  };

  const exportConfidenceCalibrationJson = () => {
    if (!reportJson) {
      return;
    }
    const payload = buildLegacyConfidenceCalibrationExport(confidencePreview, reportRunId);
    downloadJson(getReportFilename('confidence-calibration.json'), payload);
  };

  const exportConfidenceCalibrationText = () => {
    if (!reportJson) {
      return;
    }
    const payload = buildLegacyConfidenceCalibrationExport(confidencePreview, reportRunId);
    downloadText(getReportFilename('confidence-calibration.txt'), renderLegacyConfidenceCalibrationText(payload));
  };

  const exportConfidenceDriftJson = () => {
    if (!reportJson || !confidenceDrift) {
      return;
    }
    const payload = buildLegacyConfidenceDriftExport(reportRunId, confidenceDrift, confidenceDriftMeta || undefined);
    downloadJson(getReportFilename('confidence-drift.json'), payload);
  };

  const exportConfidenceDriftText = () => {
    if (!reportJson || !confidenceDrift) {
      return;
    }
    const payload = buildLegacyConfidenceDriftExport(reportRunId, confidenceDrift, confidenceDriftMeta || undefined);
    downloadText(getReportFilename('confidence-drift.txt'), renderLegacyConfidenceDriftText(payload));
  };

  const saveConfidenceBaseline = () => {
    if (!reportJson) {
      return;
    }
    const snapshot = createLegacyConfidenceSnapshot(confidencePreview);
    setConfidenceBaselineSnapshot(snapshot);
    setReviewHintText('Baseline saved. Drift comparisons now prefer this baseline until cleared.');
  };

  const clearConfidenceBaseline = () => {
    setConfidenceBaselineSnapshot(null);
    setReviewHintText('Baseline cleared. Drift comparisons now use previous run in this session.');
  };

  useEffect(() => {
    if (productionMode) {
      setShowAdvancedWizardOptions(false);
    }
  }, [productionMode]);

  useEffect(() => {
    let interval: number | null = null;
    if (runningPipeline) {
      setAnalysisProgressLabel('Running full analysis pipeline…');
      setAnalysisProgressPct((prev) => Math.max(prev, 8));
      interval = window.setInterval(() => {
        setAnalysisProgressPct((prev) => {
          if (prev >= 85) {
            return prev;
          }
          const step = Math.max(1, Math.round((85 - prev) / 12));
          return Math.min(85, prev + step);
        });
      }, 700);
    } else if (loadingPipelineReport) {
      setAnalysisProgressLabel('Loading analysis artifacts into review…');
      setAnalysisProgressPct((prev) => Math.max(prev, 88));
      interval = window.setInterval(() => {
        setAnalysisProgressPct((prev) => {
          if (prev >= 97) {
            return prev;
          }
          return Math.min(97, prev + 1);
        });
      }, 500);
    }
    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [runningPipeline, loadingPipelineReport]);

  useEffect(() => {
    if (!runningPipeline && !loadingPipelineReport && pipelineRunResult && !runPipelineError && !loadPipelineReportError) {
      setAnalysisProgressLabel(`Analysis complete · ${pipelineRunResult.runName}`);
      setAnalysisProgressPct(100);
      const timeout = window.setTimeout(() => {
        setAnalysisProgressPct(0);
        setAnalysisProgressLabel('');
      }, 3200);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [runningPipeline, loadingPipelineReport, pipelineRunResult, runPipelineError, loadPipelineReportError]);

  useEffect(() => {
    if (runPipelineError || loadPipelineReportError) {
      setAnalysisProgressLabel('Analysis failed');
      setAnalysisProgressPct((prev) => Math.max(prev, 12));
    }
  }, [runPipelineError, loadPipelineReportError]);

  const confidenceMaxItemsForCommands =
    Number.isFinite(confidenceMaxItemsValue) && confidenceMaxItemsValue > 0
      ? Math.floor(confidenceMaxItemsValue)
      : 10;
  const pipelineBaseArgs = [
    '--input',
    quoteShellArg(pipelineInputPath.trim() || '<input-folder>'),
    '--run-name',
    quoteShellArg(pipelineRunName.trim() || 'legacy-run'),
    '--min-level',
    confidenceMinLevel,
    '--max-items',
    String(confidenceMaxItemsForCommands),
  ];
  if (confidenceStrictMinLevel) {
    pipelineBaseArgs.push('--strict-min-level');
  }
  if (pipelineOutputRoot.trim()) {
    pipelineBaseArgs.push('--output-root', quoteShellArg(pipelineOutputRoot.trim()));
  }
  if (llmReviewEnabled) {
    pipelineBaseArgs.push('--use-llm-review');
  }
  const pipelineCommandArgs = [...pipelineBaseArgs];
  if (pipelineCompareMode === 'latest') {
    pipelineCommandArgs.push('--compare-latest');
  } else if (pipelineCompareMode === 'before' && pipelineCompareBeforePath.trim()) {
    pipelineCommandArgs.push('--compare-before', quoteShellArg(pipelineCompareBeforePath.trim()));
  }
  const pipelineCommand = `npm run legacy:pipeline -- ${pipelineCommandArgs.join(' ')}`;
  const pipelineLatestCommand = `npm run legacy:pipeline:latest -- ${pipelineBaseArgs.join(' ')}`;
  const calibrationCommand = [
    'npm run legacy:confidence-calibrate --',
    '--input',
    quoteShellArg('<legacy-processor-stubs-or-report.json>'),
    '--output-dir',
    quoteShellArg('<output-dir>'),
    '--format both',
    '--max-items',
    String(confidenceMaxItemsForCommands),
    '--min-level',
    confidenceMinLevel,
    ...(confidenceStrictMinLevel ? ['--strict-min-level'] : []),
  ].join(' ');
  const compareCommand = [
    'npm run legacy:confidence-compare --',
    '--before',
    quoteShellArg(pipelineCompareMode === 'before' && pipelineCompareBeforePath.trim() ? pipelineCompareBeforePath.trim() : '<before-calibration.json>'),
    '--after',
    quoteShellArg('<after-calibration.json>'),
    '--output-dir',
    quoteShellArg('<output-dir>'),
    '--format both',
    '--max-items',
    String(confidenceMaxItemsForCommands),
  ].join(' ');

  const copyPipelineCommand = async () => {
    await copyTextToClipboard(pipelineCommand);
  };

  const copyPipelineLatestCommand = async () => {
    await copyTextToClipboard(pipelineLatestCommand);
  };

  const copyCalibrationCommand = async () => {
    await copyTextToClipboard(calibrationCommand);
  };

  const copyCompareCommand = async () => {
    await copyTextToClipboard(compareCommand);
  };

  const loadPipelineReportFromRun = async (runOutputDir: string, runName: string) => {
    const resp = await runLoadPipelineReportRequest(
      () =>
        api.loadLegacyPipelineReport({
          runOutputDir,
        }),
      {
        getErrorMessage: (error) => getApiErrorMessage(error, 'Failed to load pipeline report artifacts'),
      },
    );
    if (!resp) {
      return false;
    }

    setReportJson(resp.data.report || null);
    setReportText(String(resp.data.textReport || ''));
    const summary = resp.data.report?.summary;
    const baselineMetrics = resp.data.report?.baselineMetrics;
    if (summary) {
      setReportSummary({
        totalFiles: Number(summary.totalFiles || 0),
        totalLegacyObjects: Number(summary.totalLegacyObjects || 0),
        totalOverrides: Number(summary.totalOverrides || 0),
        baselineMetrics:
          baselineMetrics && typeof baselineMetrics === 'object' ? baselineMetrics : undefined,
      });
    }
    setReportError(null);
    setLastRunLabel(`Loaded pipeline report: ${runName}`);
    setConversionStatus('ready');
    return true;
  };

  const runLegacyPipelineFromGui = async () => {
    const inputPath = pipelineInputPath.trim() || uploadRoot.trim();
    if (!inputPath) {
      setReviewHintText('Set an input folder before running the pipeline.');
      return;
    }
    if (pipelineCompareMode === 'before' && !pipelineCompareBeforePath.trim()) {
      setReviewHintText('Set a compare baseline path or switch compare mode before running pipeline.');
      return;
    }

    setPipelineRunResult(null);
    setAnalysisProgressPct(5);
    setAnalysisProgressLabel('Starting full analysis…');
    const resp = await runPipelineRequest(
      () =>
        api.runLegacyPipeline({
          inputPaths: [inputPath],
          runName: pipelineRunName.trim() || undefined,
          outputRoot: pipelineOutputRoot.trim() || undefined,
          minLevel: confidenceMinLevel,
          strictMinLevel: confidenceStrictMinLevel,
          maxItems: confidenceMaxItemsForCommands,
          compareMode: pipelineCompareMode,
          compareBeforePath:
            pipelineCompareMode === 'before' ? pipelineCompareBeforePath.trim() || undefined : undefined,
          useLlmReview: llmReviewEnabled,
        }),
      {
        getErrorMessage: (error) => getApiErrorMessage(error, 'Failed to run legacy pipeline from GUI'),
      },
    );
    if (!resp) {
      return;
    }
    setPipelineRunResult(resp.data);
    const loaded = await loadPipelineReportFromRun(resp.data.runOutputDir, resp.data.runName);
    setReviewHintText(
      loaded
        ? `Pipeline run complete and loaded: ${resp.data.runName}`
        : `Pipeline run complete: ${resp.data.runName}`,
    );
  };

  const downloadPipelineManifest = () => {
    if (!pipelineRunResult?.manifest) {
      return;
    }
    downloadJson(`${pipelineRunResult.runName}.pipeline-manifest.json`, pipelineRunResult.manifest);
  };

  const copyPipelineOutputDir = async () => {
    if (!pipelineRunResult?.runOutputDir) {
      return;
    }
    await copyTextToClipboard(pipelineRunResult.runOutputDir);
  };

  const exportPipelineRecipe = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      reportRunId,
      selectionPolicy: {
        minLevel: confidenceMinLevel,
        strictMinLevel: confidenceStrictMinLevel,
        maxItems: confidenceMaxItemsForCommands,
      },
      pipeline: {
        inputPath: pipelineInputPath.trim() || null,
        runName: pipelineRunName.trim() || 'legacy-run',
        outputRoot: pipelineOutputRoot.trim() || null,
        compareMode: pipelineCompareMode,
        compareBeforePath:
          pipelineCompareMode === 'before' ? pipelineCompareBeforePath.trim() || null : null,
      },
      commands: {
        pipeline: pipelineCommand,
        pipelineLatest: pipelineLatestCommand,
        calibrate: calibrationCommand,
        compare: compareCommand,
      },
    };
    downloadJson(getReportFilename('pipeline-recipe.json'), payload);
  };

  const loadPipelineReportIntoPreview = async () => {
    const runName = pipelineRunResult?.runName || pipelineRunName.trim() || 'legacy-run';
    const runOutputDir = pipelineRunResult?.runOutputDir
      ? pipelineRunResult.runOutputDir
      : (() => {
          const root = pipelineOutputRoot.trim().replace(/\/+$/, '');
          const name = runName.trim().replace(/^\/+/, '');
          if (!root || !name) {
            return '';
          }
          return `${root}/${name}`;
        })();

    if (!runOutputDir) {
      setReviewHintText('Set output root and run name, then click Load latest run into review.');
      return;
    }
    const loaded = await loadPipelineReportFromRun(runOutputDir, runName);
    if (!loaded) {
      setReviewHintText('Could not load run output. Verify run name/output root and try again.');
      return;
    }
    setReviewHintText(`Loaded review artifacts from ${runName}.`);
  };

  return (
    <div className="panel legacy-panel">
      <div className="panel-scroll">
        <PanelHeader title="Legacy Conversion">
          <div className="panel-section">
            <div className="panel-section-title">Purpose</div>
            <div className="muted">
              Upload legacy rules, analyze them, and convert to PCOM or FCOM as much as possible.
            </div>
          </div>
          <div className="panel-section">
            <div className="panel-title-row">
              <div className="panel-section-title">Step 1 · Upload Files</div>
              <div className="legacy-action-row">
                {hasUploadedFiles && <span className="legacy-report-hint">Complete · {fileEntries.length} files</span>}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setUploadStepCollapsed((prev) => !prev)}
                >
                  {uploadStepCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>
            </div>
            {uploadStepCollapsed ? (
              <div className="legacy-report-muted">
                {hasUploadedFiles
                  ? `Uploads ready (${fileEntries.length} files selected).`
                  : 'Upload files to continue to full analysis.'}
              </div>
            ) : (
              <LegacyUploadsPanel
                uploadRoot={uploadRoot}
                fileInputRef={fileInputRef}
                uploading={uploading}
                uploadsLoading={uploadsLoading}
                uploadError={uploadError}
                uploadsError={uploadsError}
                fileEntries={fileEntries}
                selectedPaths={selectedPaths}
                conversionStatus={conversionStatus}
                conversionStatusTone={conversionStatusTone}
                conversionStatusText={conversionStatusText}
                isReadyToConvert={isReadyToConvert}
                showConversionRun={showAdvancedWizardOptions}
                onUpload={handleUpload}
                onRefresh={loadUploads}
                onSelectAll={selectAllPaths}
                onDeselectAll={deselectAllPaths}
                onToggleSelectedPath={toggleSelectedPath}
                onOpenEntry={openEntry}
                onRunConversion={runConversion}
              />
            )}
          </div>

          <div className="panel-section">
            <div className="panel-title-row">
              <div className="panel-section-title">Step 2 · Run Full Analysis</div>
              <div className="legacy-action-row">
                {hasPipelineRun && <span className="legacy-report-hint">Complete · {pipelineRunResult?.runName}</span>}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setAnalysisStepCollapsed((prev) => !prev)}
                >
                  {analysisStepCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>
            </div>
            {analysisStepCollapsed ? (
              <div className="legacy-report-muted">
                {hasPipelineRun
                  ? `Latest run: ${pipelineRunResult?.runName}`
                  : 'Run full analysis after uploads are ready.'}
              </div>
            ) : (
              <>
                <div className="legacy-report-muted">
                  Primary path: run the full pipeline (conversion + calibration + drift compare) and auto-load review output.
                </div>
                <label className="legacy-report-hint" htmlFor="legacy-llm-review-toggle">
                  <input
                    id="legacy-llm-review-toggle"
                    type="checkbox"
                    checked={llmReviewEnabled}
                    onChange={(event) => setLlmReviewEnabled(event.target.checked)}
                  />{' '}
                  Enable UA chatbot LLM review per conversion item (tool: legacy-rule-conversion)
                </label>
                {llmReviewEnabled && (
                  <div className="legacy-report-hint">
                    LLM review enabled: conversion confidence will prefer UA chatbot validation scores when returned.
                  </div>
                )}
                <div className="legacy-action-row">
                  <button
                    type="button"
                    className="legacy-action-button legacy-action-button-primary"
                    onClick={runLegacyPipelineFromGui}
                    disabled={runningPipeline || !hasUploadedFiles}
                  >
                    {runningPipeline ? 'Running full analysis…' : 'Run full analysis'}
                  </button>
                  {!productionMode && (
                    <button
                      type="button"
                      className="legacy-action-button legacy-action-button-secondary"
                      onClick={() => setShowAdvancedWizardOptions((prev) => !prev)}
                    >
                      {showAdvancedWizardOptions ? 'Hide advanced options' : 'Show advanced options'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="legacy-action-button legacy-action-button-secondary"
                    onClick={loadPipelineReportIntoPreview}
                    disabled={loadingPipelineReport}
                    title={
                      pipelineRunResult?.runOutputDir
                        ? `Load ${pipelineRunResult.runName}`
                        : `Load ${pipelineRunName.trim() || 'legacy-run'}`
                    }
                  >
                    {loadingPipelineReport ? 'Loading report…' : 'Load latest run into review'}
                  </button>
                </div>
                {(runningPipeline || loadingPipelineReport || analysisProgressPct > 0) && (
                  <div className="legacy-report-card" role="status" aria-live="polite">
                    <div className="legacy-report-hint">
                      {analysisProgressLabel || 'Running analysis…'}
                    </div>
                    <div className="trap-progress" aria-label="Full analysis progress">
                      <div
                        className="trap-progress-bar"
                        style={{ width: `${Math.max(2, Math.min(100, Math.round(analysisProgressPct)))}%` }}
                      />
                    </div>
                    <div className="legacy-report-hint">{Math.round(analysisProgressPct)}%</div>
                  </div>
                )}
                <div className="legacy-report-hint">
                  {pipelineRunResult?.runOutputDir
                    ? `Ready to load: ${pipelineRunResult.runName}`
                    : `Ready to load run: ${pipelineRunName.trim() || 'legacy-run'}`}
                </div>

                {showAdvancedWizardOptions && (
                  <>
                    <div className="legacy-confidence-controls legacy-command-assistant-grid">
                      <label className="legacy-report-hint" htmlFor="legacy-pipeline-input-path-global">
                        Input folder
                        <input
                          id="legacy-pipeline-input-path-global"
                          className="legacy-filter-input"
                          value={pipelineInputPath}
                          onChange={(event) => setPipelineInputPath(event.target.value)}
                          placeholder="/root/navigator/rules/legacy/uploads/NCE"
                        />
                      </label>
                      <label className="legacy-report-hint" htmlFor="legacy-pipeline-run-name-global">
                        Run name
                        <input
                          id="legacy-pipeline-run-name-global"
                          className="legacy-filter-input"
                          value={pipelineRunName}
                          onChange={(event) => setPipelineRunName(event.target.value)}
                          placeholder="nce-iter-1"
                        />
                      </label>
                      <label className="legacy-report-hint" htmlFor="legacy-pipeline-output-root-global">
                        Output root
                        <input
                          id="legacy-pipeline-output-root-global"
                          className="legacy-filter-input"
                          value={pipelineOutputRoot}
                          onChange={(event) => setPipelineOutputRoot(event.target.value)}
                          placeholder="/root/navigator/tmp/legacy-analysis/pipeline"
                        />
                      </label>
                      <label className="legacy-report-hint" htmlFor="legacy-pipeline-compare-mode-global">
                        Compare mode
                        <select
                          id="legacy-pipeline-compare-mode-global"
                          className="legacy-filter-input"
                          value={pipelineCompareMode}
                          onChange={(event) => setPipelineCompareMode(event.target.value as 'none' | 'latest' | 'before')}
                        >
                          <option value="none">none</option>
                          <option value="latest">latest prior run</option>
                          <option value="before">explicit baseline path</option>
                        </select>
                      </label>
                      {pipelineCompareMode === 'before' && (
                        <label className="legacy-report-hint" htmlFor="legacy-pipeline-compare-before-global">
                          Compare before path
                          <input
                            id="legacy-pipeline-compare-before-global"
                            className="legacy-filter-input"
                            value={pipelineCompareBeforePath}
                            onChange={(event) => setPipelineCompareBeforePath(event.target.value)}
                            placeholder="/root/navigator/tmp/legacy-analysis/pipeline/baseline/calibration/legacy-confidence-calibration.json"
                          />
                        </label>
                      )}
                    </div>
                    <div className="legacy-action-row">
                      <button type="button" className="ghost-button" onClick={copyPipelineCommand}>
                        Copy pipeline command
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={downloadPipelineManifest}
                        disabled={!pipelineRunResult?.manifest}
                      >
                        Download manifest
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={copyPipelineOutputDir}
                        disabled={!pipelineRunResult}
                      >
                        Copy output path
                      </button>
                    </div>
                  </>
                )}

                {runPipelineError && <InlineMessage tone="error">{runPipelineError}</InlineMessage>}
                {loadPipelineReportError && <InlineMessage tone="error">{loadPipelineReportError}</InlineMessage>}
                {pipelineRunResult && (
                  <>
                    <InlineMessage tone="success">
                      Pipeline run complete: {pipelineRunResult.runName}
                    </InlineMessage>
                    {showAdvancedWizardOptions && (
                      <details className="legacy-pipeline-details">
                        <summary>Technical run details</summary>
                        <div className="legacy-report-hint">
                          Conversion report: {String(pipelineRunResult.manifest?.paths?.conversionReportJson || 'n/a')}
                        </div>
                        <div className="legacy-report-hint">
                          Calibration: {String(pipelineRunResult.manifest?.paths?.calibrationJson || 'n/a')}
                        </div>
                        {pipelineRunResult.manifest?.paths?.compareJson && (
                          <div className="legacy-report-hint">
                            Compare drift: {String(pipelineRunResult.manifest.paths.compareJson)}
                          </div>
                        )}
                        {pipelineRunResult.stdout && (
                          <>
                            <div className="legacy-report-hint">Pipeline stdout</div>
                            <pre className="legacy-command-preview">{pipelineRunResult.stdout}</pre>
                          </>
                        )}
                        {pipelineRunResult.stderr && (
                          <>
                            <div className="legacy-report-hint">Pipeline stderr</div>
                            <pre className="legacy-command-preview">{pipelineRunResult.stderr}</pre>
                          </>
                        )}
                      </details>
                    )}
                  </>
                )}
              </>
            )}
          </div>
          <div className="panel-section">
            <div className="panel-title-row">
              <div className="panel-section-title">Step 3 · Review Results</div>
              <div className="legacy-action-row">
                {hasReviewData && <span className="legacy-report-hint">Ready for review</span>}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setProductionMode((prev) => !prev)}
                >
                  {productionMode ? 'Switch to analyst mode' : 'Switch to production mode'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setReviewStepCollapsed((prev) => !prev)}
                >
                  {reviewStepCollapsed ? 'Expand' : 'Collapse'}
                </button>
              </div>
            </div>
            {reviewStepCollapsed && hasReviewData && (
              <div className="legacy-report-muted">Review data loaded. Expand this step to inspect and apply.</div>
            )}
            {reviewStepCollapsed && !hasReviewData && (
              <div className="legacy-report-muted">Run full analysis to populate review results.</div>
            )}
          </div>

          {!reviewStepCollapsed && selectedEntry && (
            <LegacySelectedFilePanel
              selectedEntryPath={selectedEntry.path}
              selectedContent={selectedContent}
            />
          )}
          {!reviewStepCollapsed && (
          <LegacyReportPreviewPanel
            productionMode={productionMode}
            reportError={reportError}
            lastRunLabel={lastRunLabel}
            reportText={reportText}
            reportJson={reportJson}
            reviewHintText={reviewHintText}
            cloudyMatchThreshold={cloudyMatchThreshold}
            onCloudyMatchThresholdChange={setCloudyMatchThreshold}
            onDownloadText={() => downloadText(getReportFilename('txt'), reportText)}
            onDownloadJson={() => downloadJson(getReportFilename('json'), reportJson)}
            onDownloadConfidenceCalibrationJson={exportConfidenceCalibrationJson}
            onDownloadConfidenceCalibrationText={exportConfidenceCalibrationText}
            onDownloadConfidenceDriftJson={exportConfidenceDriftJson}
            onDownloadConfidenceDriftText={exportConfidenceDriftText}
            hasConfidenceDrift={Boolean(confidenceDrift)}
            traversalFilesCount={traversalFiles.length}
            traversalMissingCount={traversalMissing.length}
            onCopyTraversalOrder={copyTraversalOrder}
            onCopyMissingFunctions={copyMissingFunctions}
            applyingOverrides={applyingOverrides}
            hasSuggestedRawErrors={hasSuggestedRawErrors}
            onPreviewConfirmed={() => applyConfirmedOverrides(true)}
            onCreateConfirmed={() => applyConfirmedOverrides(false)}
            sectionVisibility={sectionVisibility}
            hasTraversal={hasTraversal}
            onToggleMatchDiffs={() =>
              setSectionVisibility((prev) => ({
                ...prev,
                matchDiffs: !prev.matchDiffs,
              }))
            }
            onToggleTraversal={() =>
              setSectionVisibility((prev) => ({
                ...prev,
                traversal: !prev.traversal,
              }))
            }
            onToggleRawReport={() =>
              setSectionVisibility((prev) => ({
                ...prev,
                rawReport: !prev.rawReport,
              }))
            }
            downloadHint={downloadHint}
            applyOverridesError={applyOverridesError}
            applyOverridesResult={applyOverridesResult}
            hasEditPermission={hasEditPermission}
            legacyObjects={legacyObjects}
            suggestedEntries={suggestedEntries}
            selectedSuggestedKey={selectedSuggestedKey}
            onSelectSuggestedKey={setSelectedSuggestedKey}
            suggestedRawMode={suggestedRawMode}
            onSuggestedRawModeChange={setSuggestedRawMode}
            onSuggestedFieldChange={updateSuggestedField}
            onSuggestedRawChange={updateSuggestedRaw}
            conflictCountsByObject={conflictCountsByObject}
            suggestedDirtyOnly={suggestedDirtyOnly}
            onSuggestedDirtyOnlyChange={setSuggestedDirtyOnly}
            suggestedMatchedOnly={suggestedMatchedOnly}
            onSuggestedMatchedOnlyChange={setSuggestedMatchedOnly}
            suggestedGeneratedOnly={suggestedGeneratedOnly}
            onSuggestedGeneratedOnlyChange={setSuggestedGeneratedOnly}
            suggestedConflictOnly={suggestedConflictOnly}
            onSuggestedConflictOnlyChange={setSuggestedConflictOnly}
            suggestedSearch={suggestedSearch}
            onSuggestedSearchChange={setSuggestedSearch}
            suggestedDensityMode={suggestedView.densityMode}
            onSuggestedDensityModeChange={(value) =>
              setSuggestedView((prev) => ({
                ...prev,
                densityMode: value,
              }))
            }
            suggestedSortMode={suggestedView.sortMode}
            onSuggestedSortModeChange={(value) =>
              setSuggestedView((prev) => ({
                ...prev,
                sortMode: value,
              }))
            }
          >
              {reportSummary ? (
                <>
                  <div className="legacy-report-card" ref={reviewPanelRef} tabIndex={-1}>
                    <div className="legacy-object-header">
                      <div>
                        <div className="legacy-report-title">Human Review Queue</div>
                        <div className="legacy-report-hint">
                          File-by-file review · line-ordered conversions within the selected file
                        </div>
                      </div>
                      <div className="legacy-object-actions">
                        {reviewSourceFiles.length > 0 && (
                          <label className="legacy-report-hint" htmlFor="legacy-review-source-file">
                            Reviewing file
                            <select
                              id="legacy-review-source-file"
                              className="legacy-filter-input"
                              value={effectiveReviewSourceFile}
                              onChange={(event) => {
                                setSelectedReviewSourceFile(event.target.value);
                                setReviewQueueIndex(0);
                              }}
                            >
                              {reviewSourceFiles.map((sourceFile) => (
                                <option key={sourceFile} value={sourceFile}>
                                  {sourceFile}
                                </option>
                              ))}
                            </select>
                          </label>
                        )}
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!reviewQueueResult}
                          onClick={exportReviewQueueDecisions}
                        >
                          Export reviewer decisions
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!reportJson}
                          onClick={async () => {
                            if (!reportJson) {
                              return;
                            }
                            const nextFocusMode = !reviewQueueFocusMode;
                            setReviewQueueFocusMode(nextFocusMode);
                            await buildReviewQueueForReport(
                              reportJson,
                              buildApplyPreviewFromResult(applyOverridesResult),
                              nextFocusMode,
                            );
                          }}
                        >
                          {reviewQueueFocusMode ? 'Show all queue items' : 'Focus on risky items'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={buildingReviewQueue || !reportJson}
                          onClick={() => void applyConfirmedOverrides(true, true)}
                        >
                          {buildingReviewQueue ? 'Refreshing…' : 'Refresh queue'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={nextPendingQueueIndex < 0}
                          onClick={() => {
                            if (nextPendingQueueIndex >= 0) {
                              setReviewQueueIndex(nextPendingQueueIndex);
                            }
                          }}
                        >
                          {nextPendingQueueIndex >= 0 ? 'Jump to next pending' : 'All items reviewed'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={selectedReviewFileIndex <= 0}
                          onClick={() => {
                            if (selectedReviewFileIndex <= 0) {
                              return;
                            }
                            setSelectedReviewSourceFile(reviewSourceFiles[selectedReviewFileIndex - 1]);
                            setReviewQueueIndex(0);
                          }}
                        >
                          Previous file
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={
                            selectedReviewFileIndex < 0 ||
                            selectedReviewFileIndex >= reviewSourceFiles.length - 1
                          }
                          onClick={() => {
                            if (
                              selectedReviewFileIndex < 0 ||
                              selectedReviewFileIndex >= reviewSourceFiles.length - 1
                            ) {
                              return;
                            }
                            setSelectedReviewSourceFile(reviewSourceFiles[selectedReviewFileIndex + 1]);
                            setReviewQueueIndex(0);
                          }}
                        >
                          Next file
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!activeReviewItem || boundedReviewQueueIndex <= 0}
                          onClick={() =>
                            setReviewQueueIndex((prev) => Math.max(0, prev - 1))
                          }
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={!activeReviewItem || boundedReviewQueueIndex >= reviewQueueItems.length - 1}
                          onClick={() =>
                            setReviewQueueIndex((prev) => Math.min(reviewQueueItems.length - 1, prev + 1))
                          }
                        >
                          Next
                        </button>
                      </div>
                    </div>
                    {buildReviewQueueError && <InlineMessage tone="error">{buildReviewQueueError}</InlineMessage>}
                    {reviewQueueResult && (
                      <div className="legacy-report-hint">
                        File {selectedReviewFileIndex + 1}/{Math.max(1, reviewSourceFiles.length)} · item{' '}
                        {reviewQueueItems.length === 0 ? 0 : boundedReviewQueueIndex + 1}/{reviewQueueItems.length} · hidden high
                        confidence: {reviewQueueResult.summary.hiddenHighConfidence} · hidden non-intervention:{' '}
                        {reviewQueueResult.summary.hiddenByInterventionFilter}
                      </div>
                    )}
                    {reportJson?.llmReview?.enabled && (
                      <div className="legacy-report-hint">
                        LLM validation scored {Number(reportJson.llmReview.scored || 0)}/
                        {Number(reportJson.llmReview.attempted || 0)} items · average{' '}
                        {(Number(reportJson.llmReview.averageScore || 0) * 100).toFixed(1)}% · tool{' '}
                        {String(reportJson.llmReview.tool || 'legacy-rule-conversion')}
                      </div>
                    )}
                    {reviewQueueResult && (
                      <div className="legacy-filter-row" role="status" aria-label="Review decision counters">
                        <span className="legacy-object-pill">accepted {reviewDecisionCounts.accepted}</span>
                        <span className="legacy-object-pill">edited {reviewDecisionCounts.edited}</span>
                        <span className="legacy-object-pill">deferred {reviewDecisionCounts.deferred}</span>
                        <span className="legacy-object-pill">rejected {reviewDecisionCounts.rejected}</span>
                        <span className="legacy-object-pill">unset {reviewDecisionCounts.unset}</span>
                        <span className="legacy-object-pill">pending {pendingReviewCount}</span>
                      </div>
                    )}
                    {reviewQueueItemsForFile.length > 0 && (
                      <div className="legacy-report-card">
                        <div className="legacy-report-hint">
                          Items in this file (line ordered). Click any item to jump.
                        </div>
                        <div className="legacy-file-queue-list" role="listbox" aria-label="Per-file review queue">
                          {reviewQueueItemsForFile.map(({ item, index, lineStart, lineEnd, decision }) => {
                            const isActive = index === boundedReviewQueueIndex;
                            const lineLabel =
                              lineStart === null
                                ? 'L n/a'
                                : lineEnd && lineEnd > lineStart
                                  ? `L${lineStart}-${lineEnd}`
                                  : `L${lineStart}`;
                            return (
                              <button
                                key={item.reviewItemId}
                                type="button"
                                role="option"
                                aria-selected={isActive}
                                className={`legacy-file-queue-item${isActive ? ' active' : ''}`}
                                onClick={() => setReviewQueueIndex(index)}
                              >
                                <span className="legacy-file-queue-line">{lineLabel}</span>
                                <span className="legacy-file-queue-field">{item.target.targetField}</span>
                                <span className="legacy-object-pill">{item.riskLevel}</span>
                                <span className="legacy-object-pill">{decision}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {activeReviewItem ? (
                      <>
                        {activeReviewItem.reviewGroup?.condition && (
                          <InlineMessage tone="info">
                            Branch review context · if ({activeReviewItem.reviewGroup.condition}) · lines{' '}
                            {activeReviewItem.reviewGroup.branchLineStart ?? 'n/a'}-
                            {activeReviewItem.reviewGroup.branchLineEnd ?? 'n/a'} · grouped fields{' '}
                            {activeReviewItem.reviewGroup.groupFields.length > 0
                              ? activeReviewItem.reviewGroup.groupFields.join(', ')
                              : 'n/a'}
                          </InlineMessage>
                        )}
                        <div className="legacy-report-grid">
                          <div className="legacy-report-card">
                            <div className="legacy-report-line">
                              <strong>{activeReviewItem.target.objectName}</strong>
                              <span className="legacy-object-pill">{activeReviewItem.riskLevel}</span>
                              <span className="legacy-object-pill">{activeReviewItem.quality.status}</span>
                            </div>
                            <div className="legacy-report-hint">Target field: {activeReviewItem.target.targetField}</div>
                            <div className="legacy-report-hint">
                              Source: {activeReviewItem.source.sourceFile}:{' '}
                              {activeReviewItem.source.sourceLineStart ?? 'n/a'}
                            </div>
                            <div className="legacy-report-hint">{activeMappedSourceLabel}</div>
                            <div className="legacy-report-hint">
                              Root causes:{' '}
                              {activeReviewItem.quality.rootCauses.length > 0
                                ? activeReviewItem.quality.rootCauses.join(', ')
                                : 'none'}
                            </div>
                          </div>
                          <div className="legacy-report-card">
                            <div className="legacy-report-hint">
                              Priority score: {activeReviewItem.reviewPriorityScore.toFixed(2)}
                            </div>
                            <div className="legacy-report-hint">
                              Confidence: {(activeReviewItem.quality.confidenceScore * 100).toFixed(0)}% (
                              {activeReviewItem.quality.confidenceLevel})
                            </div>
                            <div className="legacy-report-hint">
                              Processor: {activeReviewItem.proposal.processorType}
                              {activeReviewItem.proposal.fallbackUsed ? ' (fallback)' : ''}
                            </div>
                            <div className="legacy-report-hint">
                              Required mappings:{' '}
                              {activeReviewItem.quality.requiredMappings.length > 0
                                ? activeReviewItem.quality.requiredMappings.join(', ')
                                : 'none'}
                            </div>
                          </div>
                        </div>
                        <div className="legacy-review-split">
                          {activeReviewItem.source.sourceSnippet && (
                            <div>
                              <div className="legacy-report-hint">
                                Original code (left) · click linked lines to jump queue items
                              </div>
                              <div className="legacy-report-hint">{activeMappedSourceLabel}</div>
                              <div className="legacy-filter-row">
                                <button
                                  type="button"
                                  className="ghost-button"
                                  disabled={!previousLinkedSourceTarget}
                                  onClick={() => {
                                    if (previousLinkedSourceTarget) {
                                      setReviewQueueIndex(previousLinkedSourceTarget.queueIndex);
                                    }
                                  }}
                                >
                                  Previous linked line
                                </button>
                                <button
                                  type="button"
                                  className="ghost-button"
                                  disabled={!nextLinkedSourceTarget}
                                  onClick={() => {
                                    if (nextLinkedSourceTarget) {
                                      setReviewQueueIndex(nextLinkedSourceTarget.queueIndex);
                                    }
                                  }}
                                >
                                  Next linked line
                                </button>
                                <span className="legacy-report-hint">
                                  Linked lines in snippet: {activeLinkedSourceTargets.length}
                                </span>
                              </div>
                              <div className="legacy-object-snippet">
                                {activeSourceSnippetLines.map((entry) => {
                                    const lineNumber = entry.lineNumber;
                                    const mappedQueueIndexes = entry.queueIndexes;
                                    const hasQueueLink = entry.hasQueueLink;
                                    const mappedStart =
                                      activeReviewItem.source.mappedLineStart ??
                                      activeReviewItem.source.mappedLineNumber ??
                                      null;
                                    const mappedEnd = activeReviewItem.source.mappedLineEnd ?? mappedStart;
                                    const isMappedLine =
                                      mappedStart !== null &&
                                      mappedEnd !== null &&
                                      lineNumber >= mappedStart &&
                                      lineNumber <= mappedEnd;
                                    const isBranchContextLine =
                                      Boolean(activeBranchHighlightRange) &&
                                      lineNumber >= Number(activeBranchHighlightRange?.start) &&
                                      lineNumber <= Number(activeBranchHighlightRange?.end);
                                    return (
                                      <div
                                        key={`${activeReviewItem.reviewItemId}-src-${lineNumber}`}
                                        ref={isMappedLine ? mappedSnippetLineRef : null}
                                        className={`legacy-snippet-line${isMappedLine ? ' highlight focused' : ''}${isBranchContextLine ? ' context-highlight' : ''}${hasQueueLink ? ' clickable' : ''}`}
                                        role={hasQueueLink ? 'button' : undefined}
                                        tabIndex={hasQueueLink ? 0 : undefined}
                                        onClick={() => {
                                          if (!hasQueueLink) {
                                            return;
                                          }
                                          setReviewQueueIndex(mappedQueueIndexes[0]);
                                        }}
                                        onKeyDown={(event) => {
                                          if (!hasQueueLink) {
                                            return;
                                          }
                                          if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            setReviewQueueIndex(mappedQueueIndexes[0]);
                                          }
                                        }}
                                      >
                                        <span className="legacy-snippet-gutter">{lineNumber}</span>
                                        <span className="legacy-snippet-code">{entry.text || ' '}</span>
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          )}
                          <div>
                            <div className="legacy-report-hint">Suggested conversion (right)</div>
                            {activeReviewItemPayload ? (
                              <pre className="legacy-command-preview">{activeReviewItemPayload}</pre>
                            ) : (
                              <div className="legacy-report-muted">No processor payload was generated for this item.</div>
                            )}
                          </div>
                        </div>
                        <div className="legacy-report-hint">Decision</div>
                        <div className="legacy-filter-row">
                          <button
                            type="button"
                            className={`legacy-filter-chip ${activeReviewDecisionDraft?.decision === 'accepted' ? 'active' : ''}`}
                            onClick={() => updateActiveReviewDecisionDraft({ decision: 'accepted' })}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className={`legacy-filter-chip ${activeReviewDecisionDraft?.decision === 'edited' ? 'active' : ''}`}
                            onClick={() => updateActiveReviewDecisionDraft({ decision: 'edited' })}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className={`legacy-filter-chip ${activeReviewDecisionDraft?.decision === 'deferred' ? 'active' : ''}`}
                            onClick={() => updateActiveReviewDecisionDraft({ decision: 'deferred' })}
                          >
                            Defer
                          </button>
                          <button
                            type="button"
                            className={`legacy-filter-chip ${activeReviewDecisionDraft?.decision === 'rejected' ? 'active' : ''}`}
                            onClick={() => updateActiveReviewDecisionDraft({ decision: 'rejected' })}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            className={`legacy-filter-chip ${activeReviewDecisionDraft?.decision === 'unset' ? 'active' : ''}`}
                            onClick={() => updateActiveReviewDecisionDraft({ decision: 'unset' })}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setDecisionAndAdvance('accepted')}
                          >
                            Accept + next
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setDecisionAndAdvance('deferred')}
                          >
                            Defer + next
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setDecisionAndAdvance('rejected')}
                          >
                            Reject + next
                          </button>
                          {activeReviewItem.reviewGroup?.totalItems > 1 && (
                            <>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => setGroupDecisionAndAdvance('accepted')}
                              >
                                Accept branch + next
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => setGroupDecisionAndAdvance('deferred')}
                              >
                                Defer branch + next
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => setGroupDecisionAndAdvance('rejected')}
                              >
                                Reject branch + next
                              </button>
                            </>
                          )}
                        </div>
                        <div className="legacy-report-hint">Reviewer note</div>
                        <textarea
                          className="legacy-command-preview"
                          rows={3}
                          value={activeReviewDecisionDraft?.reviewerNote || ''}
                          onChange={(event) =>
                            updateActiveReviewDecisionDraft({ reviewerNote: event.target.value })
                          }
                          placeholder="Capture why you accepted, edited, deferred, or rejected this item"
                        />
                        {activeReviewDecisionDraft?.decision === 'edited' && (
                          <>
                            <div className="legacy-report-hint">Edited processor payload (JSON)</div>
                            <textarea
                              className="legacy-command-preview"
                              rows={8}
                              value={activeReviewDecisionDraft?.editedPayloadText || ''}
                              onChange={(event) => updateActiveEditedPayloadText(event.target.value)}
                              placeholder="Enter edited processor JSON"
                            />
                            {activeReviewDecisionDraft?.editedPayloadError && (
                              <InlineMessage tone="error">{activeReviewDecisionDraft.editedPayloadError}</InlineMessage>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <div className="legacy-report-muted">
                        No intervention items visible with current defaults. Queue builds after preview/apply data is
                        ready.
                      </div>
                    )}
                  </div>
                  <LegacyReportSummaryCards
                    reportSummary={reportSummary}
                    helpKeyCount={helpKeyCount}
                    nodeCount={nodeCount}
                    subNodeCount={subNodeCount}
                    performanceHintCount={performanceHintCount}
                    hasTraversal={hasTraversal}
                    traversalFilesCount={traversalFiles.length}
                    traversalEntriesCount={traversalEntries.length}
                    traversalMissingCount={traversalMissing.length}
                    traversalLoadCallsCount={traversalLoadCalls.length}
                    traversalMissingLoadCallsCount={traversalMissingLoadCalls.length}
                    traversalMissingIncludesCount={traversalMissingIncludes.length}
                    traversalMissingLookupsCount={traversalMissingLookups.length}
                    traversalCountText={traversalCountText}
                  />
                  {productionMode ? (
                    <div className="legacy-report-muted">
                      Production mode is focused on guided queue review. Switch to analyst mode for traversal,
                      diagnostics, confidence calibration, and full match-diff exploration.
                    </div>
                  ) : (
                    <>
                      <LegacyConfidenceWorkflowPanel
                        preview={confidencePreview}
                        minLevel={confidenceMinLevel}
                        strictMinLevel={confidenceStrictMinLevel}
                        maxItems={confidenceMaxItems}
                        onMinLevelChange={setConfidenceMinLevel}
                        onStrictMinLevelChange={setConfidenceStrictMinLevel}
                        onMaxItemsChange={setConfidenceMaxItems}
                        drift={confidenceDrift}
                        hasBaseline={Boolean(confidenceBaselineSnapshot)}
                        baselineGeneratedAt={confidenceBaselineSnapshot?.generatedAt || null}
                        onSaveBaseline={saveConfidenceBaseline}
                        onClearBaseline={clearConfidenceBaseline}
                        driftSourceLabel={
                          confidenceBaselineSnapshot
                            ? 'saved baseline'
                            : previousConfidenceSnapshot
                              ? 'previous run'
                              : 'none'
                        }
                        pipelineInputPath={pipelineInputPath}
                        pipelineRunName={pipelineRunName}
                        pipelineOutputRoot={pipelineOutputRoot}
                        pipelineCompareMode={pipelineCompareMode}
                        pipelineCompareBeforePath={pipelineCompareBeforePath}
                        onPipelineInputPathChange={setPipelineInputPath}
                        onPipelineRunNameChange={setPipelineRunName}
                        onPipelineOutputRootChange={setPipelineOutputRoot}
                        onPipelineCompareModeChange={setPipelineCompareMode}
                        onPipelineCompareBeforePathChange={setPipelineCompareBeforePath}
                        pipelineCommand={pipelineCommand}
                        pipelineLatestCommand={pipelineLatestCommand}
                        calibrationCommand={calibrationCommand}
                        compareCommand={compareCommand}
                        onCopyPipelineCommand={copyPipelineCommand}
                        onCopyPipelineLatestCommand={copyPipelineLatestCommand}
                        onCopyCalibrationCommand={copyCalibrationCommand}
                        onCopyCompareCommand={copyCompareCommand}
                        onDownloadPipelineRecipe={exportPipelineRecipe}
                        pipelineRunning={runningPipeline}
                        pipelineRunError={runPipelineError}
                        pipelineRunResult={pipelineRunResult}
                        onRunPipeline={runLegacyPipelineFromGui}
                        onDownloadPipelineManifest={downloadPipelineManifest}
                        onCopyPipelineOutputDir={copyPipelineOutputDir}
                        showPipelineAssistant={false}
                      />
                      {hasTraversal && (
                        <LegacyTraversalDiagnosticsPanel
                          expanded={sectionVisibility.traversal}
                          onToggleExpanded={() =>
                            setSectionVisibility((prev) => ({
                              ...prev,
                              traversal: !prev.traversal,
                            }))
                          }
                          traversalLoadCalls={traversalLoadCalls}
                          traversalMissingLoadCalls={traversalMissingLoadCalls}
                          traversalMissingIncludes={traversalMissingIncludes}
                          traversalMissingLookups={traversalMissingLookups}
                          traversalMissing={traversalMissing}
                          traversalFiles={traversalFiles}
                          traversalEntries={traversalEntries}
                          traversalCountText={traversalCountText}
                          showAllTraversalFiles={showAllTraversalFiles}
                          onToggleShowAllTraversalFiles={() =>
                            setShowAllTraversalFiles((prev) => !prev)
                          }
                          showAllTraversalEntries={showAllTraversalEntries}
                          onToggleShowAllTraversalEntries={() =>
                            setShowAllTraversalEntries((prev) => !prev)
                          }
                        />
                      )}
                      {legacyObjects.length > 0 && (
                        <div className="legacy-report-divider" aria-hidden="true" />
                      )}
                      <LegacyFolderFileSummaryPanel
                        folderSummaries={folderSummaries}
                        fileSummaries={fileSummaries}
                      />
                      {legacyObjects.length > 0 && (
                        <LegacyObjectPreviewPanel
                          visibleObjects={visibleObjects}
                          filteredObjects={filteredObjects}
                          showAllObjects={showAllObjects}
                          onToggleShowAllObjects={() => setShowAllObjects((prev) => !prev)}
                          onExportCsv={exportObjectsCsv}
                          objectTypeFilter={objectTypeFilter}
                          onObjectTypeFilter={setObjectTypeFilter}
                          filterHasCondition={filterHasCondition}
                          onToggleFilterHasCondition={() => setFilterHasCondition((prev) => !prev)}
                          filterHasHelpKey={filterHasHelpKey}
                          onToggleFilterHasHelpKey={() => setFilterHasHelpKey((prev) => !prev)}
                          filterHasPerfHints={filterHasPerfHints}
                          onToggleFilterHasPerfHints={() => setFilterHasPerfHints((prev) => !prev)}
                          filterMissingLookups={filterMissingLookups}
                          onToggleFilterMissingLookups={() => setFilterMissingLookups((prev) => !prev)}
                          filterWhy={filterWhy}
                          onFilterWhy={setFilterWhy}
                          selectedObjectId={selectedObjectId}
                          onSelectObject={setSelectedObjectId}
                          onClearSelection={() => setSelectedObjectId(null)}
                          selectedObject={selectedObject}
                          snippetPulse={snippetPulse}
                          snippetLines={snippetLines}
                          snippetStartLine={snippetStartLine}
                        />
                      )}
                      <div className="legacy-report-divider" aria-hidden="true" />
                      <LegacyMatchDiffsPanel
                        panelRef={matchPanelRef}
                        expanded={sectionVisibility.matchDiffs}
                        onToggleExpanded={() =>
                          setSectionVisibility((prev) => ({
                            ...prev,
                            matchDiffs: !prev.matchDiffs,
                          }))
                        }
                        showAllMatches={showAllMatches}
                        onToggleShowAllMatches={() => setShowAllMatches((prev) => !prev)}
                        filteredMatchDiffs={filteredMatchDiffs}
                        visibleMatches={visibleMatches}
                        matchStats={matchStats}
                        matchOpenError={matchOpenError}
                        matchSourceFilter={matchSourceFilter}
                        onMatchSourceFilter={setMatchSourceFilter}
                        matchMethodFilter={matchMethodFilter}
                        onMatchMethodFilter={setMatchMethodFilter}
                        matchOnlyDiffs={matchOnlyDiffs}
                        onToggleMatchOnlyDiffs={() => setMatchOnlyDiffs((prev) => !prev)}
                        matchMinScore={matchMinScore}
                        onMatchMinScore={setMatchMinScore}
                        matchSearch={matchSearch}
                        onMatchSearch={setMatchSearch}
                        expandedMatches={expandedMatches}
                        onToggleMatchRow={(legacyObjectId: string) =>
                          setExpandedMatches((prev) => ({
                            ...prev,
                            [legacyObjectId]: !prev[legacyObjectId],
                          }))
                        }
                        onOpenMatchFile={openMatchFile}
                      />
                    </>
                  )}
                </>
              ) : (
                <div className="legacy-report-line legacy-report-muted">
                  Run conversion to populate this preview.
                </div>
              )}
          </LegacyReportPreviewPanel>
              )}
          <div className="panel-section">
            <div className="panel-section-title">Integration</div>
            <ul>
              <li>UA assistant/chatbot-assisted conversion workflow.</li>
              <li>Standalone script option for batch conversion.</li>
            </ul>
          </div>
          <div className="panel-section">
            <div className="panel-section-title">Status</div>
            <EmptyState>
              Active workflow: upload, analyze, match, and export reports are available. Guided apply/wizard
              steps are next.
            </EmptyState>
          </div>
        </PanelHeader>
      </div>
    </div>
  );
}
