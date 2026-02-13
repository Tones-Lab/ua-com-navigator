import { useEffect, useRef, useState } from 'react';
import PanelHeader from '../../components/PanelHeader';
import api from '../../services/api';

type LegacyUploadEntry = {
  path: string;
  type: 'file' | 'folder';
  size: number;
  modifiedAt: string;
};

export default function LegacyWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadRoot, setUploadRoot] = useState('');
  const [uploadEntries, setUploadEntries] = useState<LegacyUploadEntry[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
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
  const [showRawReport, setShowRawReport] = useState(false);
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
    setUploadsLoading(true);
    setUploadsError(null);
    try {
      const resp = await api.listLegacyUploads();
      setUploadRoot(String(resp.data?.root || ''));
      const entries = Array.isArray(resp.data?.entries) ? resp.data.entries : [];
      setUploadEntries(entries);
      const filePaths = entries.filter((entry: LegacyUploadEntry) => entry.type === 'file').map((entry: LegacyUploadEntry) => entry.path);
      setSelectedPaths((prev) => {
        const preserved = prev.filter((value) => filePaths.includes(value));
        return preserved.length > 0 ? preserved : filePaths;
      });
    } catch (error: any) {
      setUploadsError(error?.response?.data?.error || 'Failed to load uploads');
    } finally {
      setUploadsLoading(false);
    }
  };

  useEffect(() => {
    void loadUploads();
  }, []);

  useEffect(() => {
    setShowAllTraversalEntries(false);
    setShowRawReport(false);
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
  }, [reportRunId]);

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
    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadLegacyFiles(Array.from(files));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      await loadUploads();
    } catch (error: any) {
      setUploadError(error?.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
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
    } catch (error: any) {
      setSelectedContent(error?.response?.data?.error || 'Failed to read file.');
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
    } catch (error: any) {
      setMatchOpenError(error?.response?.data?.error || 'Failed to open match file.');
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
    } catch (error: any) {
      setReportError(error?.response?.data?.error || 'Conversion failed');
      setLastRunLabel('Conversion failed');
      setConversionStatus('idle');
    }
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
          <div className="panel-section">
            <div className="panel-section-title">Legacy Uploads</div>
            <div className="muted">
              Upload rules from your machine. Files are stored in {uploadRoot || 'the legacy upload folder'}.
            </div>
            <div className="panel-section-actions">
              <input ref={fileInputRef} type="file" multiple />
              <button type="button" className="ghost-button" onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Upload files'}
              </button>
              <button type="button" className="ghost-button" onClick={loadUploads} disabled={uploadsLoading}>
                Refresh
              </button>
            </div>
            {uploadError && <div className="error">{uploadError}</div>}
            {uploadsError && <div className="error">{uploadsError}</div>}
            {uploadsLoading ? (
              <div className="muted">Loading uploads…</div>
            ) : fileEntries.length === 0 ? (
              <div className="empty-state">No legacy files uploaded yet.</div>
            ) : (
              <div className="legacy-upload-layout">
                <ul className="browse-list legacy-upload-list">
                  <li className="legacy-upload-toolbar">
                    <button type="button" className="ghost-button" onClick={toggleSelectAll}>
                      {selectedPaths.length === fileEntries.length ? 'Clear selection' : 'Select all'}
                    </button>
                    <span className="muted">
                      Selected {selectedPaths.length || fileEntries.length} of {fileEntries.length}
                    </span>
                  </li>
                  {fileEntries.map((entry) => (
                    <li key={entry.path}>
                      <div className="legacy-upload-row">
                        <input
                          type="checkbox"
                          checked={selectedPaths.includes(entry.path)}
                          onChange={() => toggleSelectedPath(entry.path)}
                        />
                        <button
                          type="button"
                          className="browse-link file-link"
                          onClick={() => openEntry(entry)}
                        >
                          {entry.path}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="legacy-upload-meta">
                  <div className="panel-section-title">Conversion Run</div>
                  <div className="muted">
                    {isReadyToConvert
                      ? 'Files are ready. Start a conversion run to generate a report.'
                      : 'Upload files to enable conversion.'}
                  </div>
                  <div className="legacy-action-row">
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!isReadyToConvert || conversionStatus === 'running'}
                      onClick={() => runConversion('run')}
                    >
                      {conversionStatus === 'running' ? 'Converting…' : 'Run conversion'}
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={!isReadyToConvert}
                      onClick={() => runConversion('preview')}
                    >
                      Preview report
                    </button>
                  </div>
                  <div className="legacy-status">
                    <span className={`legacy-status-pill legacy-status-${conversionStatusTone}`} />
                    {conversionStatusText}
                  </div>
                </div>
              </div>
            )}
          </div>
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
              {reportError && <div className="error">{reportError}</div>}
              {lastRunLabel && !reportError && (
                <div className="legacy-report-banner">{lastRunLabel}</div>
              )}
              {(reportText || reportJson) && (
                <div className="legacy-report-actions">
                  {reportText && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => downloadText(getReportFilename('txt'), reportText)}
                    >
                      Download text
                    </button>
                  )}
                  {reportJson && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => downloadJson(getReportFilename('json'), reportJson)}
                    >
                      Download JSON
                    </button>
                  )}
                  {traversalFiles.length > 0 && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={copyTraversalOrder}
                    >
                      Copy traversal order
                    </button>
                  )}
                  {traversalMissing.length > 0 && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={copyMissingFunctions}
                    >
                      Copy missing functions
                    </button>
                  )}
                  {reportText && (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setShowRawReport((prev) => !prev)}
                    >
                      {showRawReport ? 'Hide raw report' : 'Show raw report'}
                    </button>
                  )}
                  {downloadHint && (
                    <div className="legacy-report-hint">Downloads: {downloadHint}</div>
                  )}
                </div>
              )}
              {reportSummary ? (
                <>
                  <div className="legacy-report-grid">
                    <div className="legacy-report-card">
                      <div className="legacy-report-title">Summary</div>
                      <div className="legacy-report-line">
                        {reportSummary.totalFiles} file(s) · {reportSummary.totalLegacyObjects} object(s)
                      </div>
                      <div className="legacy-report-line">
                        Overrides proposed: {reportSummary.totalOverrides}
                      </div>
                      {(helpKeyCount > 0 || nodeCount > 0 || subNodeCount > 0) && (
                        <div className="legacy-report-line legacy-report-muted">
                          HelpKeys: {helpKeyCount} · Nodes: {nodeCount} · SubNodes: {subNodeCount}
                        </div>
                      )}
                      {performanceHintCount > 0 && (
                        <div className="legacy-report-line legacy-report-muted">
                          Performance hints: {performanceHintCount}
                        </div>
                      )}
                    </div>
                    {hasTraversal && (
                      <div className="legacy-report-card">
                        <div className="legacy-report-title">Traversal</div>
                        <div className="legacy-report-line">
                          Ordered files: {traversalFiles.length} · Entries: {traversalEntries.length}
                        </div>
                        <div className="legacy-report-line">
                          Missing functions: {traversalMissing.length}
                        </div>
                        <div className="legacy-report-line">
                          Load calls: {traversalLoadCalls.length} · Missing loads: {traversalMissingLoadCalls.length}
                        </div>
                        <div className="legacy-report-line">
                          Missing includes: {traversalMissingIncludes.length} · Missing lookups: {traversalMissingLookups.length}
                        </div>
                        {traversalCountText && (
                          <div className="legacy-report-line legacy-traversal-counts">
                            {traversalCountText}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {hasTraversal && (
                    <div className="legacy-report-divider" aria-hidden="true" />
                  )}
                    {hasTraversal && traversalLoadCalls.length > 0 && (
                      <div className="legacy-traversal-section">
                        <div className="legacy-traversal-label">Load calls</div>
                        <ul className="legacy-traversal-list">
                          {traversalLoadCalls.slice(0, 10).map((item: string) => (
                            <li key={item}>{item}</li>
                          ))}
                          {traversalLoadCalls.length > 10 && (
                            <li className="legacy-traversal-muted">
                              +{traversalLoadCalls.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {hasTraversal && traversalMissingLoadCalls.length > 0 && (
                      <div className="legacy-traversal-section">
                        <div className="legacy-traversal-label">Missing load calls</div>
                        <ul className="legacy-traversal-list">
                          {traversalMissingLoadCalls.slice(0, 10).map((item: string) => (
                            <li key={item}>{item}</li>
                          ))}
                          {traversalMissingLoadCalls.length > 10 && (
                            <li className="legacy-traversal-muted">
                              +{traversalMissingLoadCalls.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {hasTraversal && traversalMissingIncludes.length > 0 && (
                      <div className="legacy-traversal-section">
                        <div className="legacy-traversal-label">Missing include paths</div>
                        <ul className="legacy-traversal-list">
                          {traversalMissingIncludes.slice(0, 10).map((item: string) => (
                            <li key={item}>{item}</li>
                          ))}
                          {traversalMissingIncludes.length > 10 && (
                            <li className="legacy-traversal-muted">
                              +{traversalMissingIncludes.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                    {hasTraversal && traversalMissingLookups.length > 0 && (
                      <div className="legacy-traversal-section">
                        <div className="legacy-traversal-label">Missing lookup files</div>
                        <ul className="legacy-traversal-list">
                          {traversalMissingLookups.slice(0, 10).map((item: string) => (
                            <li key={item}>{item}</li>
                          ))}
                          {traversalMissingLookups.length > 10 && (
                            <li className="legacy-traversal-muted">
                              +{traversalMissingLookups.length - 10} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  {hasTraversal && traversalMissing.length > 0 && (
                    <div className="legacy-traversal-section">
                      <div className="legacy-traversal-label">Missing functions</div>
                      <ul className="legacy-traversal-list">
                        {traversalMissing.slice(0, 10).map((item: string) => (
                          <li key={item}>{item}</li>
                        ))}
                        {traversalMissing.length > 10 && (
                          <li className="legacy-traversal-muted">
                            +{traversalMissing.length - 10} more
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                  {hasTraversal && traversalFiles.length > 0 && (
                    <>
                      <div className="legacy-traversal-toggle">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setShowAllTraversalFiles((prev) => !prev)}
                        >
                          {showAllTraversalFiles ? 'Show fewer files' : 'Show all files'}
                        </button>
                        <span className="muted">{traversalFiles.length} total</span>
                      </div>
                      <div className="legacy-traversal-section">
                        <div className="legacy-traversal-label">Ordered files</div>
                        <ul className="legacy-traversal-list">
                          {(showAllTraversalFiles ? traversalFiles : traversalFiles.slice(0, 6)).map(
                            (filePath: string) => (
                              <li key={filePath}>{filePath}</li>
                            ),
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                  {hasTraversal && traversalEntries.length > 0 && (
                    <>
                      <div className="legacy-traversal-toggle">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setShowAllTraversalEntries((prev) => !prev)}
                        >
                          {showAllTraversalEntries ? 'Show fewer entries' : 'Show all entries'}
                        </button>
                        <span className="muted">{traversalEntries.length} total</span>
                      </div>
                      <div className="legacy-traversal-section">
                        <div className="legacy-traversal-label">
                          Traversal entries
                          {traversalCountText && (
                            <span className="legacy-traversal-badge">{traversalCountText}</span>
                          )}
                        </div>
                        <ul className="legacy-traversal-list">
                          {(showAllTraversalEntries ? traversalEntries : traversalEntries.slice(0, 6)).map(
                            (entry: any, index: number) => (
                          <li key={`${entry.filePath || 'entry'}-${index}`}>
                            <div className="legacy-traversal-entry">
                              <span className="legacy-traversal-kind">{entry.kind}</span>
                              <span className="legacy-traversal-main">
                                {entry.functionName || entry.filePath}
                              </span>
                            </div>
                            {entry.condition && (
                              <div className="legacy-traversal-meta">{entry.condition}</div>
                            )}
                            {entry.functionName && entry.filePath && (
                              <div className="legacy-traversal-meta">{entry.filePath}</div>
                            )}
                          </li>
                          ),
                          )}
                        </ul>
                      </div>
                    </>
                  )}
                  {legacyObjects.length > 0 && (
                    <div className="legacy-report-divider" aria-hidden="true" />
                  )}
                  {(folderSummaries.length > 0 || fileSummaries.length > 0) && (
                    <div className="legacy-summary-panel">
                      <div className="legacy-report-title">Folder & File Summary</div>
                      {folderSummaries.length > 0 && (
                        <div className="legacy-summary-table">
                          <div className="legacy-summary-row legacy-summary-header">
                            <div>Folder</div>
                            <div>Total</div>
                            <div>Fault</div>
                            <div>Perf</div>
                            <div>Unknown</div>
                          </div>
                          {folderSummaries.slice(0, 8).map((entry: any) => (
                            <div key={entry.folder} className="legacy-summary-row">
                              <div className="legacy-summary-path">{entry.folder}</div>
                              <div>{entry.totalObjects}</div>
                              <div>{entry.faultObjects}</div>
                              <div>{entry.performanceObjects}</div>
                              <div>{entry.unknownObjects}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {fileSummaries.length > 0 && (
                        <div className="legacy-summary-table">
                          <div className="legacy-summary-row legacy-summary-header">
                            <div>File</div>
                            <div>Total</div>
                            <div>Fault</div>
                            <div>Perf</div>
                            <div>Unknown</div>
                          </div>
                          {fileSummaries.slice(0, 8).map((entry: any) => (
                            <div key={entry.filePath} className="legacy-summary-row">
                              <div className="legacy-summary-path">{entry.filePath}</div>
                              <div>{entry.totalObjects}</div>
                              <div>{entry.faultObjects}</div>
                              <div>{entry.performanceObjects}</div>
                              <div>{entry.unknownObjects}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {legacyObjects.length > 0 && (
                    <div className="legacy-object-panel">
                      <div className="legacy-object-header">
                        <div>
                          <div className="legacy-report-title">Object preview</div>
                          <div className="legacy-report-muted">
                            Showing {visibleObjects.length} of {filteredObjects.length} filtered objects
                          </div>
                        </div>
                        <div className="legacy-object-actions">
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={exportObjectsCsv}
                            disabled={filteredObjects.length === 0}
                          >
                            Export CSV
                          </button>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => setShowAllObjects((prev) => !prev)}
                          >
                            {showAllObjects ? 'Show fewer' : 'Show all'}
                          </button>
                        </div>
                      </div>
                      <div className="legacy-filter-row">
                        <button
                          type="button"
                          className={`legacy-filter-chip ${objectTypeFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setObjectTypeFilter('all')}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${objectTypeFilter === 'fault' ? 'active' : ''}`}
                          onClick={() => setObjectTypeFilter('fault')}
                        >
                          Fault
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${objectTypeFilter === 'performance' ? 'active' : ''}`}
                          onClick={() => setObjectTypeFilter('performance')}
                        >
                          Performance
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${objectTypeFilter === 'unknown' ? 'active' : ''}`}
                          onClick={() => setObjectTypeFilter('unknown')}
                        >
                          Unknown
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${filterHasCondition ? 'active' : ''}`}
                          onClick={() => setFilterHasCondition((prev) => !prev)}
                        >
                          Has condition
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${filterHasHelpKey ? 'active' : ''}`}
                          onClick={() => setFilterHasHelpKey((prev) => !prev)}
                        >
                          Has HelpKey
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${filterHasPerfHints ? 'active' : ''}`}
                          onClick={() => setFilterHasPerfHints((prev) => !prev)}
                        >
                          Has perf hints
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${filterMissingLookups ? 'active' : ''}`}
                          onClick={() => setFilterMissingLookups((prev) => !prev)}
                        >
                          Missing lookups (global)
                        </button>
                        <input
                          className="legacy-filter-input"
                          placeholder="Why filter (e.g., EventFields, MetricID)"
                          value={filterWhy}
                          onChange={(event) => setFilterWhy(event.target.value)}
                        />
                      </div>
                      <div className="legacy-object-content">
                        <div className="legacy-object-list">
                          {filteredObjects.length === 0 ? (
                            <div className="legacy-report-muted">No objects match the current filters.</div>
                          ) : (
                            <div className="legacy-object-table">
                              <div className="legacy-object-row legacy-object-header-row">
                                <div>Rule</div>
                                <div>Type</div>
                                <div>OIDs</div>
                                <div>HelpKey</div>
                                <div>Node/SubNode</div>
                                <div>Traversal</div>
                                <div>Perf hints</div>
                                <div>Why</div>
                              </div>
                              {visibleObjects.map((obj: any) => (
                                <div
                                  key={obj.id}
                                  className={`legacy-object-row legacy-object-button${selectedObjectId === obj.id ? ' selected' : ''}`}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedObjectId(obj.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault();
                                      setSelectedObjectId(obj.id);
                                    }
                                  }}
                                >
                                  <div>
                                    <div className="legacy-object-name">{obj.ruleFunction}</div>
                                    <div className="legacy-object-meta">{obj.sourceFile}</div>
                                  </div>
                                  <div className="legacy-object-pill">{obj.ruleType}</div>
                                  <div className="legacy-object-meta">
                                    {(obj.oids || []).slice(0, 3).join(', ') || '—'}
                                  </div>
                                  <div className="legacy-object-meta">
                                    {(obj.helpKeys || []).join(', ') || '—'}
                                  </div>
                                  <div className="legacy-object-meta">
                                    {(obj.nodeValues || []).join(', ') || '—'}
                                    {obj.subNodeValues?.length ? ` / ${obj.subNodeValues.join(', ')}` : ''}
                                  </div>
                                  <div className="legacy-object-meta">
                                    {obj?.traversal?.kind || '—'}
                                    {obj?.traversal?.condition ? ` (${obj.traversal.condition})` : ''}
                                  </div>
                                  <div className="legacy-object-meta">
                                    {(obj.performanceHints || []).join(', ') || '—'}
                                  </div>
                                  <div className="legacy-object-meta">
                                    {(obj.classificationHints || []).join(', ') || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="legacy-object-preview-panel">
                          <div className="legacy-object-preview">
                            <div className="legacy-object-header">
                              <div>
                                <div className="legacy-report-title">Snippet focus</div>
                                <div className="legacy-report-muted">
                                  {selectedObject
                                    ? `${selectedObject.ruleFunction} · ${selectedObject.ruleType}`
                                    : 'Select a row to highlight its code block'}
                                </div>
                              </div>
                              <div className="legacy-object-actions">
                                <button
                                  type="button"
                                  className="ghost-button"
                                  onClick={() => setSelectedObjectId(null)}
                                  disabled={!selectedObject}
                                >
                                  Clear selection
                                </button>
                              </div>
                            </div>
                            <div className="legacy-object-meta">
                              {selectedObject ? selectedObject.sourceFile : '—'}
                            </div>
                            <div
                              className={`code-block legacy-object-snippet${snippetPulse ? ' legacy-object-snippet-pulse' : ''}`}
                            >
                              {snippetLines.length === 0 ? (
                                <div className="legacy-report-muted">Snippet unavailable for this object.</div>
                              ) : (
                                snippetLines.map((line: string, index: number) => (
                                  <div
                                    key={`snippet-${snippetStartLine + index}`}
                                    className={`legacy-snippet-line${selectedObject ? ' highlight' : ''}`}
                                  >
                                    <span className="legacy-snippet-gutter">
                                      {snippetStartLine + index}
                                    </span>
                                    <span className="legacy-snippet-code">{line || ' '}</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="legacy-report-divider" aria-hidden="true" />
                  <div className="legacy-match-panel">
                    <div className="legacy-match-header">
                      <div>
                        <div className="legacy-report-title">Match diffs</div>
                        <div className="legacy-report-muted">
                          Showing {visibleMatches.length} of {filteredMatchDiffs.length} filtered matches
                        </div>
                        {matchStats && (
                          <div className="legacy-match-meta">
                            Index: {matchStats.indexEntries} objects · {matchStats.indexFiles} files ·
                            cache {matchStats.cacheHit ? 'hit' : 'miss'}
                          </div>
                        )}
                      </div>
                      <div className="legacy-object-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => setShowAllMatches((prev) => !prev)}
                          disabled={filteredMatchDiffs.length === 0}
                        >
                          {showAllMatches ? 'Show fewer' : 'Show all'}
                        </button>
                      </div>
                    </div>
                    <div className="legacy-match-controls">
                      <div className="legacy-filter-row">
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchSourceFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setMatchSourceFilter('all')}
                        >
                          All sources
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchSourceFilter === 'fcom' ? 'active' : ''}`}
                          onClick={() => setMatchSourceFilter('fcom')}
                        >
                          FCOM
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchSourceFilter === 'pcom' ? 'active' : ''}`}
                          onClick={() => setMatchSourceFilter('pcom')}
                        >
                          PCOM
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchSourceFilter === 'mib' ? 'active' : ''}`}
                          onClick={() => setMatchSourceFilter('mib')}
                        >
                          MIB
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchOnlyDiffs ? 'active' : ''}`}
                          onClick={() => setMatchOnlyDiffs((prev) => !prev)}
                        >
                          Only diffs
                        </button>
                      </div>
                      <div className="legacy-filter-row">
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchMethodFilter === 'all' ? 'active' : ''}`}
                          onClick={() => setMatchMethodFilter('all')}
                        >
                          All methods
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchMethodFilter === 'oid' ? 'active' : ''}`}
                          onClick={() => setMatchMethodFilter('oid')}
                        >
                          OID only
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchMethodFilter === 'name' ? 'active' : ''}`}
                          onClick={() => setMatchMethodFilter('name')}
                        >
                          Name match
                        </button>
                        <button
                          type="button"
                          className={`legacy-filter-chip ${matchMethodFilter === 'heuristic' ? 'active' : ''}`}
                          onClick={() => setMatchMethodFilter('heuristic')}
                        >
                          Heuristic
                        </button>
                      </div>
                      <div className="legacy-filter-row">
                        <input
                          className="legacy-filter-input"
                          type="number"
                          min="0"
                          placeholder="Min score"
                          value={matchMinScore}
                          onChange={(event) => setMatchMinScore(event.target.value)}
                        />
                        <input
                          className="legacy-filter-input"
                          placeholder="Search legacy/matched/path"
                          value={matchSearch}
                          onChange={(event) => setMatchSearch(event.target.value)}
                        />
                      </div>
                      {matchOpenError && (
                        <div className="legacy-report-banner legacy-report-banner-warn">
                          {matchOpenError}
                        </div>
                      )}
                    </div>
                    {filteredMatchDiffs.length === 0 ? (
                      <div className="legacy-report-muted">
                        No FCOM/PCOM/MIB matches computed yet.
                      </div>
                    ) : (
                      <div className="legacy-match-table">
                        <div className="legacy-match-row legacy-match-header-row">
                          <div>Legacy object</div>
                          <div>Matched</div>
                          <div>Method</div>
                          <div>Score</div>
                          <div>Diffs</div>
                          <div>Actions</div>
                        </div>
                        {visibleMatches.map((entry: any) => {
                          const isExpanded = !!expandedMatches[entry.legacyObjectId];
                          return (
                            <div key={entry.legacyObjectId} className="legacy-match-group">
                              <div className="legacy-match-row">
                                <div>
                                  <div className="legacy-summary-path">{entry.legacyObjectName}</div>
                                  <div className="legacy-match-subtle">{entry.sourceFile}</div>
                                </div>
                                <div>
                                  {entry.matchedObject
                                    ? `${entry.matchedObject.source}:${entry.matchedObject.name}`
                                    : '—'}
                                </div>
                                <div>
                                  <span className="legacy-match-pill">
                                    {entry.matchMethod || 'unknown'}
                                  </span>
                                </div>
                                <div>{entry.matchScore ?? '—'}</div>
                                <div>{entry.diffs?.length || 0}</div>
                                <div className="legacy-match-actions">
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() =>
                                      setExpandedMatches((prev) => ({
                                        ...prev,
                                        [entry.legacyObjectId]: !isExpanded,
                                      }))
                                    }
                                  >
                                    {isExpanded ? 'Hide' : 'Show'}
                                  </button>
                                  {entry?.matchedObject?.path && (
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => openMatchFile(entry)}
                                    >
                                      Open file
                                    </button>
                                  )}
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="legacy-match-details">
                                  <div className="legacy-match-detail-row">
                                    <span className="legacy-match-label">Matched path</span>
                                    <span className="legacy-match-path">
                                      {entry?.matchedObject?.path || '—'}
                                    </span>
                                  </div>
                                  {Array.isArray(entry?.diffs) && entry.diffs.length > 0 ? (
                                    <div className="legacy-match-diffs">
                                      {entry.diffs.map((diff: any, index: number) => (
                                        <div key={`${entry.legacyObjectId}-diff-${index}`} className="legacy-match-diff">
                                          <span className="legacy-match-field">{diff.field}</span>
                                          <span className="legacy-match-value">
                                            Legacy: {diff.legacyValue ?? '—'}
                                          </span>
                                          <span className="legacy-match-value">
                                            Existing: {diff.existingValue ?? '—'}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="legacy-report-muted">No field diffs for this match.</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="legacy-report-line legacy-report-muted">
                  Run conversion to populate this preview.
                </div>
              )}
              {reportText && showRawReport && (
                <pre className="code-block legacy-report-raw">{reportText}</pre>
              )}
              {reportText && !showRawReport && (
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
            <div className="empty-state">Stub only (upload + conversion coming soon).</div>
          </div>
        </PanelHeader>
      </div>
    </div>
  );
}
