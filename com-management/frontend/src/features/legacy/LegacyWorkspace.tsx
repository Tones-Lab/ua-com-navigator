import { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from '../../components/EmptyState';
import InlineMessage from '../../components/InlineMessage';
import PanelHeader from '../../components/PanelHeader';
import useRequest from '../../hooks/useRequest';
import api from '../../services/api';
import type { LegacyApplyFcomOverridesResponse } from '../../types/api';
import { getApiErrorMessage } from '../../utils/errorUtils';
import LegacyMatchDiffsPanel from './components/LegacyMatchDiffsPanel';
import LegacyFolderFileSummaryPanel from './components/LegacyFolderFileSummaryPanel';
import LegacyObjectPreviewPanel from './components/LegacyObjectPreviewPanel';
import LegacyReportCommandBar from './components/LegacyReportCommandBar';
import LegacyReportSummaryCards from './components/LegacyReportSummaryCards';
import LegacySuggestedReviewPanel from './components/LegacySuggestedReviewPanel';
import LegacyTraversalDiagnosticsPanel from './components/LegacyTraversalDiagnosticsPanel';
import LegacyUploadsPanel from './components/LegacyUploadsPanel';
import {
  applyEventFieldsToPayload,
  buildEditedPayloadOverrides,
  buildSuggestedEntriesFromResult,
  extractEventFields,
  type SuggestedEntry,
} from './legacySuggestedUtils';

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

type LegacySectionVisibility = {
  traversal: boolean;
  matchDiffs: boolean;
  rawReport: boolean;
};

type LegacySuggestedView = {
  densityMode: 'compact' | 'comfortable';
  sortMode: 'default' | 'dirty-first' | 'generated-first' | 'name-asc';
};

export default function LegacyWorkspace({ hasEditPermission }: LegacyWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const matchPanelRef = useRef<HTMLDivElement | null>(null);
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
  const [selectedEntry, setSelectedEntry] = useState<LegacyUploadEntry | null>(null);
  const [selectedContent, setSelectedContent] = useState('');
  const [conversionStatus, setConversionStatus] = useState<'idle' | 'ready' | 'running'>('idle');
  const [reportText, setReportText] = useState('');
  const [reportJson, setReportJson] = useState<any | null>(null);
  const [reportSummary, setReportSummary] = useState<null | {
    totalFiles: number;
    totalLegacyObjects: number;
    totalOverrides: number;
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

  const toggleSelectedPath = (pathId: string) => {
    setSelectedPaths((prev) =>
      prev.includes(pathId) ? prev.filter((entry) => entry !== pathId) : [...prev, pathId],
    );
  };

  const toggleSelectAll = () => {
    if (selectedPaths.length === fileEntries.length) {
      setSelectedPaths([]);
      return;
    }
    setSelectedPaths(fileEntries.map((entry) => entry.path));
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
    const text = traversalFiles.join('\n');
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
    const text = traversalMissing.join('\n');
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

  const runConversion = async (mode: 'preview' | 'run') => {
    if (!isReadyToConvert) {
      return;
    }
    setConversionStatus('running');
    setReportError(null);
    setReportText('');
    setReportJson(null);
    setLastRunLabel(null);
    try {
      const resp = await api.runLegacyConversion({
        paths: hasSelection ? selectedPaths : undefined,
      });
      setReportText(String(resp.data?.textReport || ''));
      setReportJson(resp.data?.report || null);
      const summary = resp.data?.report?.summary;
      if (summary) {
        setReportSummary({
          totalFiles: Number(summary.totalFiles || 0),
          totalLegacyObjects: Number(summary.totalLegacyObjects || 0),
          totalOverrides: Number(summary.totalOverrides || 0),
        });
      }
      setLastRunLabel(mode === 'preview' ? 'Preview report generated' : 'Conversion completed');
      setConversionStatus(mode === 'preview' ? 'ready' : 'idle');
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
  const selectedFileAnalysis = selectedObject
    ? reportJson?.files?.find((entry: any) => entry.filePath === selectedObject.sourceFile) || null
    : null;
  const selectedBlock = selectedFileAnalysis?.functionBlocks?.find(
    (block: any) => block.name === selectedObject?.ruleFunction,
  );
  const selectedSnippet = selectedBlock?.text || '';
  const snippetLines = selectedSnippet ? selectedSnippet.split(/\r?\n/) : [];
  const snippetStartLine = Number(selectedBlock?.startLine || 1);

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
            onUpload={handleUpload}
            onRefresh={loadUploads}
            onToggleSelectAll={toggleSelectAll}
            onToggleSelectedPath={toggleSelectedPath}
            onOpenEntry={openEntry}
            onRunConversion={runConversion}
          />
          {selectedEntry && (
            <div className="panel-section">
              <div className="panel-section-title">Selected File</div>
              <div className="muted">{selectedEntry.path}</div>
              <pre className="code-block">{selectedContent || 'Loading…'}</pre>
            </div>
          )}
          <div className="panel-section">
            <div className="panel-section-title">Report Preview (Text-Only)</div>
            <div className="legacy-report-preview">
              {reportError && <InlineMessage tone="error">{reportError}</InlineMessage>}
              {lastRunLabel && !reportError && (
                <div className="legacy-report-banner">{lastRunLabel}</div>
              )}
              {(reportText || reportJson) && (
                <LegacyReportCommandBar
                  reportJson={reportJson}
                  reportText={reportText}
                  reviewHintText={reviewHintText}
                  cloudyMatchThreshold={cloudyMatchThreshold}
                  onCloudyMatchThresholdChange={setCloudyMatchThreshold}
                  onDownloadText={() => downloadText(getReportFilename('txt'), reportText)}
                  onDownloadJson={() => downloadJson(getReportFilename('json'), reportJson)}
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
                />
              )}
              {applyOverridesError && <InlineMessage tone="error">{applyOverridesError}</InlineMessage>}
              {applyOverridesResult && (
                <InlineMessage tone="success">
                  Existing FCOM matches: {applyOverridesResult.summary.matchedExistingFcomObjects} · Confirmed overrides:{' '}
                  {applyOverridesResult.summary.confirmedObjects} · Generated COM definitions:{' '}
                  {applyOverridesResult.summary.generatedDefinitions} · Conflict objects:{' '}
                  {applyOverridesResult.summary.conflictObjects}
                  {applyOverridesResult.outputPath ? ` · Saved: ${applyOverridesResult.outputPath}` : ''}
                </InlineMessage>
              )}
              {suggestedEntries.length > 0 && (
                <LegacySuggestedReviewPanel
                  hasEditPermission={hasEditPermission}
                  legacyObjects={legacyObjects}
                  entries={suggestedEntries}
                  selectedKey={selectedSuggestedKey}
                  onSelectEntry={setSelectedSuggestedKey}
                  rawMode={suggestedRawMode}
                  onRawModeChange={setSuggestedRawMode}
                  onFieldChange={updateSuggestedField}
                  onRawChange={updateSuggestedRaw}
                  conflictCountsByObject={conflictCountsByObject}
                  dirtyOnly={suggestedDirtyOnly}
                  onDirtyOnlyChange={setSuggestedDirtyOnly}
                  matchedOnly={suggestedMatchedOnly}
                  onMatchedOnlyChange={setSuggestedMatchedOnly}
                  generatedOnly={suggestedGeneratedOnly}
                  onGeneratedOnlyChange={setSuggestedGeneratedOnly}
                  conflictOnly={suggestedConflictOnly}
                  onConflictOnlyChange={setSuggestedConflictOnly}
                  searchValue={suggestedSearch}
                  onSearchChange={setSuggestedSearch}
                  densityMode={suggestedView.densityMode}
                  onDensityModeChange={(value) =>
                    setSuggestedView((prev) => ({
                      ...prev,
                      densityMode: value,
                    }))
                  }
                  sortMode={suggestedView.sortMode}
                  onSortModeChange={(value) =>
                    setSuggestedView((prev) => ({
                      ...prev,
                      sortMode: value,
                    }))
                  }
                />
              )}
              {reportSummary ? (
                <>
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
              ) : (
                <div className="legacy-report-line legacy-report-muted">
                  Run conversion to populate this preview.
                </div>
              )}
              {reportText && sectionVisibility.rawReport && (
                <pre className="code-block legacy-report-raw">{reportText}</pre>
              )}
              {reportText && !sectionVisibility.rawReport && (
                <div className="legacy-report-muted">
                  Raw report hidden. Use “Show raw report” to expand.
                </div>
              )}
            </div>
          </div>
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
