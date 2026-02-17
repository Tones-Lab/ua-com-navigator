import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSessionStore } from './stores';
import api from './services/api';
import AppTabs from './app/AppTabs';
import OverviewPage from './features/overview/OverviewPage';
import FcomBrowserPanel from './features/fcom/FcomBrowserPanel';
import FcomFileHeader from './features/fcom/FcomFileHeader';
import FcomFolderOverview from './features/fcom/FcomFolderOverview';
import FcomFilePreview from './features/fcom/FcomFilePreview';
import FcomBuilderSidebar from './features/fcom/FcomBuilderSidebar';
import FcomRawPreview from './features/fcom/FcomRawPreview';
import FcomAdvancedFlowModal from './features/fcom/FcomAdvancedFlowModal';
import FcomFlowEditorModal from './features/fcom/FcomFlowEditorModal';
import useFcomBuilderContextValue from './features/fcom/builder/useFcomBuilderContextValue';
import type {
  FlowPaletteItem,
  ProcessorBuilderConfig,
  ProcessorCatalogItem,
} from './features/fcom/builder/types';
import ComFilePreview from './components/ComFilePreview';
import ActionRow from './components/ActionRow';
import useCompactPanel from './components/useCompactPanel';
import Modal from './components/Modal';
import { FileTitleRow, ViewToggle } from './components/FileHeaderCommon';
import MibWorkspace from './features/mib/MibWorkspace';
import LegacyWorkspace from './features/legacy/LegacyWorkspace';
import useMibWorkspace from './features/mib/useMibWorkspace';
import useCacheStatus from './hooks/useCacheStatus';
import useFavorites from './hooks/useFavorites';
import useOverviewState from './hooks/useOverviewState';
import useRequest from './hooks/useRequest';
import useSearchState from './hooks/useSearchState';
import {
  appendNodeAtPath,
  removeNodeById,
} from './features/fcom/flowUtils';
import {
  collectFocusMatches,
  validateFlowNode,
  validateFlowEditorDraft,
  validateFlowNodes,
  type FlowNodeErrorMap,
  type FocusMatch,
} from './features/fcom/flowValidation';
import {
  buildFlowProcessors as buildFlowProcessorsShared,
  buildProcessorPayloadFromConfig as buildProcessorPayloadFromConfigShared,
} from './features/fcom/flowBuilderUtils';
import {
  hasPatchOps,
} from './features/fcom/advancedFlowUtils';
import useFlowEditorState from './features/fcom/useFlowEditorState';
import FlowCanvas from './features/fcom/FlowCanvas';
import { buildFlowNodesFromProcessors as buildFlowNodesFromProcessorsShared } from './features/fcom/flowNodeParser';
import useAdvancedFlowOrchestration from './features/fcom/useAdvancedFlowOrchestration';
import {
  buildCurrentDisplayPath,
  buildBreadcrumbsFromNode,
  buildBreadcrumbsFromPath,
  ensureCorePrefix,
  formatDisplayPath,
  formatRelativeAge,
  getVendorFromPath,
  normalizeRulesPath,
} from './utils/pathUtils';
import { getApiErrorMessage } from './utils/errorUtils';
import {
  getDefaultBrowseNode,
  inferAppFromPath,
  resolveDeepLinkFileId,
} from './utils/navigationUtils';
import './App.css';

const COMS_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const FILE_LOAD_STAGE_ORDER = ['original', 'overrides', 'compare', 'render'] as const;
const FILE_LOAD_STAGE_TIMING = {
  showDelayMs: 120,
  stepMs: 380,
  minVisibleMs: 900,
  exitGraceMs: 450,
  holdAfterRenderMs: 1500,
};
const OVERRIDE_SAVE_TIMING = {
  staggerMs: 140,
  stepMs: 240,
};

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="app">
          <header className="app-header">
            <h1>COM Curation &amp; Management</h1>
          </header>
          <main>
            <div className="error">
              Something went wrong while rendering the app. Refresh the page to try again.
            </div>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

type AppTab = 'overview' | 'fcom' | 'pcom' | 'mib' | 'legacy';

export default function App() {
  const { session, servers, isAuthenticated, setSession, clearSession, setServers } =
    useSessionStore();
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const [activeApp, setActiveApp] = useState<AppTab>('overview');
  const [serverId, setServerId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [cacheActionMessage, setCacheActionMessage] = useState<string | null>(null);
  const [showPathModal, setShowPathModal] = useState(false);
  const [searchHighlightActive, setSearchHighlightActive] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const [highlightPathId, setHighlightPathId] = useState<string | null>(null);
  const [highlightMatchSource, setHighlightMatchSource] = useState<
    'name' | 'content' | 'both' | null
  >(null);
  const [highlightObjectKeys, setHighlightObjectKeys] = useState<string[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchObjectOptions, setMatchObjectOptions] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [matchPingKey, setMatchPingKey] = useState<string | null>(null);
  const [fileNamePingActive, setFileNamePingActive] = useState(false);
  const matchPingTimeoutRef = useRef<number | null>(null);
  const fileNamePingTimeoutRef = useRef<number | null>(null);
  const matchPingSequenceRef = useRef<number[]>([]);
  const fileNamePingSequenceRef = useRef<number[]>([]);
  const lastLoadPingRef = useRef<{ fileId?: string; key?: string; mode?: 'match' | 'file' }>({});
  const [overrideObjectKeys, setOverrideObjectKeys] = useState<string[]>([]);
  const [overrideMatchIndex, setOverrideMatchIndex] = useState(0);
  const [overrideObjectOptions, setOverrideObjectOptions] = useState<
    Array<{ key: string; label: string }>
  >([]);
  const [rawMatchPositions, setRawMatchPositions] = useState<number[]>([]);
  const [rawMatchIndex, setRawMatchIndex] = useState(0);
  const rawMatchRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const highlightNextOpenRef = useRef(false);
  const objectRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const matchStateByFileRef = useRef<Record<string, { index: number; key?: string }>>({});
  const scrollStateByFileRef = useRef<Record<string, number>>({});
  const lastSelectedFileRef = useRef<string | null>(null);
  const friendlyViewRef = useRef<HTMLDivElement | null>(null);
  const friendlyMainRef = useRef<HTMLDivElement | null>(null);
  const activeOverrideTooltipRef = useRef<HTMLElement | null>(null);
  const [browsePath] = useState('/');
  const {
    overviewStatus,
    overviewData,
    overviewLoading,
    overviewError,
    overviewRebuildPending,
    overviewTopN,
    setOverviewTopN,
    overviewVendorFilter,
    setOverviewVendorFilter,
    overviewVendorSort,
    overviewProtocols,
    loadOverview,
    toggleOverviewSort,
    refreshOverviewStatus,
    startOverviewStatusPolling,
    stopOverviewStatusPolling,
  } = useOverviewState({ isAuthenticated, activeApp });
  const {
    searchStatus,
    setSearchStatus,
    searchRebuildPending,
    rebuildSearchIndexAndTrack,
    folderOverviewStatus,
    folderRebuildPending,
    rebuildFolderOverviewCacheAndTrack,
    mibTranslateStatus,
    refreshMibTranslateStatus,
  } = useCacheStatus({
    isAuthenticated,
    showUserMenu,
    showPathModal,
    refreshOverviewStatus,
    startOverviewStatusPolling,
    stopOverviewStatusPolling,
  });
  const {
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    searchResults,
    searchLoading,
    setSearchLoading,
    searchError,
    setSearchError,
    runSearch,
    handleSearchSubmit,
    clearSearch,
    resetSearchState,
  } = useSearchState({
    isAuthenticated,
    onStatusUpdate: setSearchStatus,
  });
  const [mibTrapDefaults, setMibTrapDefaults] = useState<null | {
    objectName: string;
    module?: string;
    sourceFile?: string;
    testCommand: string;
    parsed: {
      version?: string;
      community?: string;
      host?: string;
      trapOid?: string;
      mibModule?: string;
      varbinds: Array<{ oid: string; type: string; value: string }>;
    };
  }>(null);
  const [trapModalOpen, setTrapModalOpen] = useState(false);
  const [trapSource, setTrapSource] = useState<'mib' | 'fcom'>('mib');
  const [trapObjectName, setTrapObjectName] = useState('');
  const [trapHost, setTrapHost] = useState('');
  const [trapPort, setTrapPort] = useState(162);
  const [trapCommunity, setTrapCommunity] = useState('public');
  const [trapVersion, setTrapVersion] = useState('2c');
  const [trapOid, setTrapOid] = useState('');
  const [trapMibModule, setTrapMibModule] = useState('');
  const [pcomDeviceIp, setPcomDeviceIp] = useState('');
  const [pcomSnmpVersion, setPcomSnmpVersion] = useState('2c');
  const [pcomSnmpCommunity, setPcomSnmpCommunity] = useState('mtsro');
  const [pcomAdvancedOpen, setPcomAdvancedOpen] = useState(false);
  const [pcomAdvancedActive, setPcomAdvancedActive] = useState(false);
  const [pcomAdvancedTargetMode, setPcomAdvancedTargetMode] = useState<'device' | 'manual'>(
    'device',
  );
  const [pcomAdvancedDeviceIp, setPcomAdvancedDeviceIp] = useState('');
  const [pcomAdvancedManualIp, setPcomAdvancedManualIp] = useState('');
  const [pcomAdvancedSnmpVersion, setPcomAdvancedSnmpVersion] = useState<'1' | '2c' | '3'>('2c');
  const [pcomAdvancedCommunity, setPcomAdvancedCommunity] = useState('mtsro');
  const [pcomAdvancedSecurityLevel, setPcomAdvancedSecurityLevel] = useState<
    'noAuthNoPriv' | 'authNoPriv' | 'authPriv'
  >('authPriv');
  const [pcomAdvancedUsername, setPcomAdvancedUsername] = useState('');
  const [pcomAdvancedAuthProtocol, setPcomAdvancedAuthProtocol] = useState('');
  const [pcomAdvancedAuthPassword, setPcomAdvancedAuthPassword] = useState('');
  const [pcomAdvancedPrivProtocol, setPcomAdvancedPrivProtocol] = useState('');
  const [pcomAdvancedPrivPassword, setPcomAdvancedPrivPassword] = useState('');
  const [pcomAdvancedEngineId, setPcomAdvancedEngineId] = useState('');
  const [pcomAdvancedOidEnabled, setPcomAdvancedOidEnabled] = useState(false);
  const [pcomAdvancedOidValue, setPcomAdvancedOidValue] = useState('');
  const [pcomSnmpProfile, setPcomSnmpProfile] = useState<null | {
    accessId: string;
    version: string;
    community: string;
    username: string;
    securityLevel: string;
    description: string;
    zoneName: string;
  }>(null);
  const [pcomSnmpProfileLoading, setPcomSnmpProfileLoading] = useState(false);
  const [pcomSnmpProfileError, setPcomSnmpProfileError] = useState<string | null>(null);
  const [pcomPollLoading, setPcomPollLoading] = useState(false);
  const [pcomPollError, setPcomPollError] = useState<string | null>(null);
  const [pcomPollOutput, setPcomPollOutput] = useState('');
  const [pcomSelectedObjectKey, setPcomSelectedObjectKey] = useState<string | null>(null);
  const [pcomDevices, setPcomDevices] = useState<
    Array<{
      id: string;
      name: string;
      zoneName: string;
      ip: string;
      status?: string;
      sysOid?: string;
      snmpAccessId?: string;
    }>
  >([]);
  const {
    loading: pcomDevicesLoading,
    error: pcomDevicesError,
    setLoading: setPcomDevicesLoading,
    setError: setPcomDevicesError,
    run: runPcomDevicesRequest,
  } = useRequest();
  const [trapVarbinds, setTrapVarbinds] = useState<
    Array<{ oid: string; type: string; value: string }>
  >([]);
  const [trapServerList, setTrapServerList] = useState<any[]>([]);
  const [trapServerError, setTrapServerError] = useState<string | null>(null);
  const [trapManualOpen, setTrapManualOpen] = useState(false);
  const [trapSending, setTrapSending] = useState(false);
  const [trapError, setTrapError] = useState<string | null>(null);
  const [redeployPulse, setRedeployPulse] = useState(false);
  const [recentTargets, setRecentTargets] = useState<string[]>([]);
  const [fileTestLoading, setFileTestLoading] = useState<Record<string, boolean>>({});
  const [vendorTestLoading, setVendorTestLoading] = useState(false);
  const [bulkTrapContext, setBulkTrapContext] = useState<null | {
    label: string;
    total: number;
    items: Array<{
      objectName: string;
      sourceLabel: string;
      parsed: {
        version?: string;
        community?: string;
        host?: string;
        trapOid?: string;
        mibModule?: string;
        varbinds: Array<{ oid: string; type: string; value: string }>;
      };
    }>;
  }>(null);
  const [bulkTrapProgress, setBulkTrapProgress] = useState({
    current: 0,
    total: 0,
    failed: 0,
    currentLabel: '',
  });
  const [bulkTrapFailures, setBulkTrapFailures] = useState<
    Array<{
      objectName: string;
      message: string;
      item: {
        objectName: string;
        sourceLabel: string;
        parsed: {
          version?: string;
          community?: string;
          host?: string;
          trapOid?: string;
          mibModule?: string;
          varbinds: Array<{ oid: string; type: string; value: string }>;
        };
      };
    }>
  >([]);
  const [bulkTrapSummary, setBulkTrapSummary] = useState<null | {
    passed: number;
    failed: number;
    total: number;
  }>(null);
  const [bulkTrapShowAllFailures, setBulkTrapShowAllFailures] = useState(false);
  const isCompactPanel = useCompactPanel();
  const triggerToast = (message: string, pulse = false) => {
    setStagedToast(message);
    setToastPulseAfter(pulse);
  };
  const {
    mibUrlHydratingRef,
    mibPath,
    mibEntries,
    mibLoading,
    mibLoadingElapsed,
    mibShowLoadingTimer,
    mibError,
    mibSearch,
    mibSearchScope,
    mibSearchMode,
    mibHasMore,
    mibTotal,
    mibFilteredTotal,
    mibSelectedFile,
    mibDetailsLoading,
    mibDefinitionSearch,
    mibObjectFilter,
    mibSelectedDefinition,
    mibSupportByPath,
    mibOutput,
    mibOutputName,
    mib2FcomLoading,
    mib2FcomError,
    mibUseParent,
    mibDefinitionCounts,
    filteredMibDefinitions,
    mibSelectedSupport,
    setMibPath,
    setMibSearch,
    setMibSearchScope,
    setMibSelectedFile: _setMibSelectedFile,
    setMibDefinitionSearch,
    setMibObjectFilter,
    setMibSelectedDefinition,
    setMibOutput,
    setMibOutputName: _setMibOutputName,
    setMibUseParent,
    loadMibPath,
    loadMibSearch,
    handleMibSearchSubmit,
    handleMibClearSearch,
    getMibBaseName,
    getMibSupportStatus,
    getSupportedCountLabel,
    openMibFileFromUrl,
    handleOpenMibEntry,
    openMibFavorite,
    runMib2Fcom,
    resetMibState,
  } = useMibWorkspace({ api, triggerToast });

  const pcomAdvancedSummary = useMemo(() => {
    if (!pcomAdvancedActive) {
      return '';
    }
    const targetLabel =
      pcomAdvancedTargetMode === 'manual'
        ? `Manual IP ${pcomAdvancedManualIp || 'unset'}`
        : pcomAdvancedDeviceIp
          ? `Device ${pcomAdvancedDeviceIp}`
          : 'Device unset';
    const snmpLabel = `SNMP v${pcomAdvancedSnmpVersion}`;
    const communityLabel =
      pcomAdvancedSnmpVersion === '3'
        ? ''
        : pcomAdvancedCommunity
          ? 'Community set'
          : 'Community unset';
    const oidLabel = pcomAdvancedOidEnabled
      ? pcomAdvancedOidValue
        ? 'OID override set'
        : 'OID override enabled'
      : '';
    return [targetLabel, snmpLabel, communityLabel, oidLabel].filter(Boolean).join(' | ');
  }, [
    pcomAdvancedActive,
    pcomAdvancedCommunity,
    pcomAdvancedDeviceIp,
    pcomAdvancedManualIp,
    pcomAdvancedOidEnabled,
    pcomAdvancedOidValue,
    pcomAdvancedSnmpVersion,
    pcomAdvancedTargetMode,
  ]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('mib.recentTargets');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecentTargets(parsed.map(String));
        }
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('mib.recentTargets', JSON.stringify(recentTargets.slice(0, 8)));
    } catch {
      // ignore storage errors
    }
  }, [recentTargets]);

  useEffect(() => {
    setPcomPollError(null);
    setPcomPollOutput('');
    setPcomPollLoading(false);
  }, [mibSelectedDefinition?.name, mibSelectedFile]);

  useEffect(() => {
    if (!pcomAdvancedOpen || pcomAdvancedOidEnabled) {
      return;
    }
    const oidValue = mibSelectedDefinition?.fullOid || mibSelectedDefinition?.oid;
    const nextOid = oidValue ? String(oidValue).trim() : '';
    setPcomAdvancedOidValue(nextOid);
  }, [mibSelectedDefinition?.fullOid, mibSelectedDefinition?.oid, pcomAdvancedOpen, pcomAdvancedOidEnabled]);

  useEffect(() => {
    if (!redeployPulse) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setRedeployPulse(false);
    }, 3200);
    return () => window.clearTimeout(timeout);
  }, [redeployPulse]);

  const formatOverviewNumber = (value: number) => new Intl.NumberFormat().format(value);

  const formatBytes = (value?: number | null) => {
    if (!Number.isFinite(value) || !value || value <= 0) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    const precision = size >= 100 || unitIndex === 0 ? 0 : size >= 10 ? 1 : 2;
    return `${size.toFixed(precision)} ${units[unitIndex]}`;
  };

  const formatCacheStatsLabel = (stats?: { keyCount?: number; sizeBytes?: number } | null) => {
    if (!stats) {
      return '';
    }
    const sizeLabel =
      typeof stats.sizeBytes === 'number' ? formatBytes(stats.sizeBytes) : '';
    const countValue = typeof stats.keyCount === 'number' ? stats.keyCount : null;
    const countLabel =
      countValue !== null ? `${countValue} ${countValue === 1 ? 'key' : 'keys'}` : '';
    if (sizeLabel && countLabel) {
      return `${sizeLabel} · ${countLabel}`;
    }
    return sizeLabel || countLabel;
  };

  const overviewProgress = overviewStatus?.progress;
  const searchProgress = searchStatus?.progress;
  const folderProgress = folderOverviewStatus?.progress;
  const overviewCacheLabel = formatCacheStatsLabel(overviewStatus?.cacheStats);
  const searchCacheLabel = formatCacheStatsLabel(searchStatus?.cacheStats);
  const folderCacheLabel = formatCacheStatsLabel(folderOverviewStatus?.cacheStats);
  const mibTranslateCacheLabel = formatCacheStatsLabel(mibTranslateStatus?.cacheStats);
  const overviewProgressPercent = overviewProgress?.total
    ? Math.min(100, Math.round((overviewProgress.processed / overviewProgress.total) * 100))
    : 0;
  const searchProgressPercent = searchProgress?.total
    ? Math.min(100, Math.round((searchProgress.processed / searchProgress.total) * 100))
    : 0;
  const folderProgressPercent = folderProgress?.total
    ? Math.min(100, Math.round((folderProgress.processed / folderProgress.total) * 100))
    : 0;

  const handleOverviewFolderClick = (protocol: string, vendor?: string) => {
    const path = [COMS_PATH_PREFIX, protocol, vendor].filter(Boolean).join('/');
    const entryLabel = vendor || protocol;
    confirmDiscardIfDirty(() => {
      setActiveApp('fcom');
      void handleOpenFolderInternal({ PathID: path, PathName: entryLabel });
    });
  };

  const getCurrentPath = () => buildCurrentDisplayPath(selectedFile?.PathID, browseNode);

  const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

  const isFileReadPayload = (payload: unknown) => {
    if (!isRecord(payload)) {
      return false;
    }
    const content = isRecord(payload.content) ? payload.content : null;
    if (!content) {
      return false;
    }
    if (Array.isArray(content['data']) || Array.isArray(content['objects'])) {
      return true;
    }
    return Object.keys(content).length > 0;
  };

  const getSortIndicator = (activeKey: string, key: string, direction: 'asc' | 'desc') => {
    if (activeKey !== key) {
      return null;
    }
    return direction === 'asc' ? '↑' : '↓';
  };

  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseData, setBrowseData] = useState<unknown>(null);
  const [browseNode, setBrowseNode] = useState<string | null>(null);
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const browseSnapshotRef = useRef<{
    browseData: unknown;
    browseNode: string | null;
    entries: BrowseEntry[];
    breadcrumbs: Array<{ label: string; node: string | null }>;
  } | null>(null);
  const {
    favoritesFiles,
    favoritesFolders,
    favoritesLoading,
    favoritesError,
    isFavorite,
    toggleFavorite,
  } = useFavorites({ isAuthenticated, activeApp });
  const [selectedFolder, setSelectedFolder] = useState<BrowseEntry | null>(null);
  const [folderOverview, setFolderOverview] = useState<unknown>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderTableFilter, setFolderTableFilter] = useState('');
  const [folderTableSort, setFolderTableSort] = useState<{
    key: 'file' | 'objects' | 'schemaErrors' | 'unknownFields';
    direction: 'asc' | 'desc';
  }>({ key: 'schemaErrors', direction: 'desc' });
  const folderTableRows = useMemo(() => {
    const toRecord = (value: unknown): Record<string, unknown> | null =>
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    const folderOverviewData = toRecord(folderOverview);
    const topFiles = folderOverviewData?.['topFiles'];
    const rows = Array.isArray(topFiles) ? topFiles : [];
    const filterText = folderTableFilter.trim().toLowerCase();
    const filteredRows = filterText
      ? rows.filter((row: unknown) => {
          const rowData = toRecord(row);
          return String(rowData?.file || '')
            .toLowerCase()
            .includes(filterText);
        })
      : rows;
    const sortedRows = [...filteredRows].sort((a: unknown, b: unknown) => {
      const rowA = toRecord(a);
      const rowB = toRecord(b);
      if (folderTableSort.key === 'file') {
        const aName = String(rowA?.file || '');
        const bName = String(rowB?.file || '');
        return folderTableSort.direction === 'asc'
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }
      const aValue = Number(rowA?.[folderTableSort.key] ?? 0);
      const bValue = Number(rowB?.[folderTableSort.key] ?? 0);
      return folderTableSort.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
    return sortedRows;
  }, [folderOverview, folderTableFilter, folderTableSort]);

  const toggleFolderSort = (key: 'file' | 'objects' | 'schemaErrors' | 'unknownFields') => {
    setFolderTableSort((prev) =>
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' },
    );
  };
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ label: string; node: string | null }>>([
    { label: '/', node: null },
  ]);
  const breadcrumbsRef = useRef(breadcrumbs);
  const [selectedFile, setSelectedFile] = useState<BrowseEntry | null>(null);
  const [fileData, setFileData] = useState<unknown>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileLoadStageTarget, setFileLoadStageTarget] = useState<
    'original' | 'overrides' | 'compare' | 'render' | null
  >(null);
  const [fileLoadStageDisplay, setFileLoadStageDisplay] = useState<
    'original' | 'overrides' | 'compare' | 'render' | null
  >(null);
  const fileLoadStageDisplayRef = useRef<
    'original' | 'overrides' | 'compare' | 'render' | null
  >(null);
  const fileLoadStageTimersRef = useRef<number[]>([]);
  const fileLoadStageStartRef = useRef<number | null>(null);
  const fileLoadStageHideTimeoutRef = useRef<number | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [editorText, setEditorText] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [overrideSaveStatus, setOverrideSaveStatus] = useState<
    Array<{
      objectName: string;
      fileName: string;
      status: 'queued' | 'saving' | 'retrying' | 'done' | 'failed';
    }>
  >([]);
  const [overrideSaveDisplayStatus, setOverrideSaveDisplayStatus] = useState<
    Array<{
      objectName: string;
      fileName: string;
      status: 'queued' | 'saving' | 'retrying' | 'done' | 'failed';
    }>
  >([]);
  const overrideSaveDisplayRef = useRef(overrideSaveDisplayStatus);
  const overrideSaveStatusTimersRef = useRef<number[]>([]);
  const [viewMode, setViewMode] = useState<'friendly' | 'preview'>('friendly');
  const [, setOriginalText] = useState('');
  const [, setShowCommitModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStep, setReviewStep] = useState<'review' | 'commit'>('review');
  const [suppressVarTooltip, setSuppressVarTooltip] = useState(false);
  const [suppressEvalTooltip, setSuppressEvalTooltip] = useState(false);
  const [stagedToast, setStagedToast] = useState<string | null>(null);
  const [reviewCtaPulse, setReviewCtaPulse] = useState(false);
  const [toastPulseAfter, setToastPulseAfter] = useState(false);
  const [expandedOriginals, setExpandedOriginals] = useState<Record<string, boolean>>({});
  const [stagedSectionOpen, setStagedSectionOpen] = useState<Record<string, boolean>>({});
  const toastTimeoutRef = useRef<number | null>(null);
  const reviewModalOpenRef = useRef(false);
  const unsavedChangesRef = useRef(false);
  const pulseTimeoutRef = useRef<number | null>(null);
  const reviewPulseIntervalRef = useRef<number | null>(null);
  const reviewPulseTimeoutRef = useRef<number | null>(null);
  const stagedPulseActiveRef = useRef(false);
  const [saveElapsed, setSaveElapsed] = useState(0);
  const [redeployElapsed, setRedeployElapsed] = useState(0);
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [pendingReviewDiscard, setPendingReviewDiscard] = useState(false);
  const [panelEditState, setPanelEditState] = useState<Record<string, boolean>>({});
  const [panelDrafts, setPanelDrafts] = useState<Record<string, any>>({});
  const [panelEvalModes, setPanelEvalModes] = useState<Record<string, Record<string, boolean>>>({});
  const [panelOverrideBaselines, setPanelOverrideBaselines] = useState<
    Record<string, { objectName: string; method: string; entries: unknown[] }>
  >({});
  const [redeployReady, setRedeployReady] = useState(false);
  const [redeployModalOpen, setRedeployModalOpen] = useState(false);
  const [redeployLoading, setRedeployLoading] = useState(false);
  const [redeployError, setRedeployError] = useState<string | null>(null);
  const [microserviceActionLabel, setMicroserviceActionLabel] = useState<string | null>(null);
  const [microserviceStatus, setMicroserviceStatus] = useState<unknown>(null);
  const {
    loading: microserviceStatusLoading,
    error: microserviceStatusError,
    setLoading: setMicroserviceStatusLoading,
    setError: setMicroserviceStatusError,
    run: runMicroserviceStatusRequest,
  } = useRequest();
  const [microserviceLastRefreshed, setMicroserviceLastRefreshed] = useState<string | null>(null);
  const [eventsSchemaFields, setEventsSchemaFields] = useState<string[]>([]);
  const [overrideInfo, setOverrideInfo] = useState<any | null>(null);
  const [, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [pendingOverrideSave, setPendingOverrideSave] = useState<unknown[] | null>(null);
  const [pendingOverrideConversions, setPendingOverrideConversions] = useState<
    Record<string, { entry: any; method: string; scope: 'post' }>
  >({});
  const [removeOverrideModal, setRemoveOverrideModal] = useState<{
    open: boolean;
    objectName?: string;
    field?: string;
    baseValue?: string;
    panelKey?: string;
    isNewField?: boolean;
  }>({ open: false });
  const [panelOverrideRemovals, setPanelOverrideRemovals] = useState<Record<string, string[]>>({});
  const [panelNavWarning, setPanelNavWarning] = useState<{
    open: boolean;
    fields: Record<string, string[]>;
  }>({ open: false, fields: {} });
  const [removeAllOverridesModal, setRemoveAllOverridesModal] = useState<{
    open: boolean;
    panelKey?: string;
    fields?: string[];
    baseValues?: Record<string, string>;
    newFields?: string[];
    processorFields?: string[];
    objectName?: string;
    hasAdvancedFlow?: boolean;
  }>({ open: false });
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [addFieldSearch, setAddFieldSearch] = useState('');
  const [addFieldContext, setAddFieldContext] = useState<{ panelKey: string; obj: any } | null>(
    null,
  );
  const [panelAddedFields, setPanelAddedFields] = useState<Record<string, string[]>>({});
  const urlHydrated = useRef(false);
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varModalToken, setVarModalToken] = useState<string | null>(null);
  const [varModalVars, setVarModalVars] = useState<any[]>([]);
  const [varModalMode, setVarModalMode] = useState<'view' | 'insert'>('view');
  const [varInsertContext, setVarInsertContext] = useState<{
    panelKey: string;
    field: string;
    value: string;
    replaceStart: number;
    replaceEnd: number;
    meta?: {
      rowId?: string;
      nodeId?: string;
      key?: 'left' | 'right' | 'result' | 'else';
    };
  } | null>(null);
  const [builderOpen, setBuilderOpen] = useState(true);
  const [builderTarget, setBuilderTarget] = useState<{ panelKey: string; field: string } | null>(
    null,
  );
  const [builderFocus, setBuilderFocus] = useState<'eval' | 'processor' | 'literal' | null>(null);
  const [builderPatchMode, setBuilderPatchMode] = useState(false);
  const [, setBuilderPatchOp] = useState<any | null>(null);
  const [builderTypeLocked, setBuilderTypeLocked] = useState<
    'eval' | 'processor' | 'literal' | null
  >(null);
  const [builderMode, setBuilderMode] = useState<'friendly' | 'regular'>('friendly');
  const [builderUndoStack, setBuilderUndoStack] = useState<BuilderSnapshot[]>([]);
  const [builderRedoStack, setBuilderRedoStack] = useState<BuilderSnapshot[]>([]);
  const builderHistoryBusyRef = useRef(false);
  const builderHistorySigRef = useRef<string | null>(null);
  const builderDirtySigRef = useRef<string | null>(null);
  const builderHistoryInitRef = useRef(false);
  const [showBuilderHelpModal, setShowBuilderHelpModal] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<null | {
    type: 'panel' | 'builder';
    panelKey?: string;
  }>(null);
  const [pendingAdvancedFlowClose, setPendingAdvancedFlowClose] = useState(false);
  const [processorStep, setProcessorStep] = useState<'select' | 'configure' | 'review'>('select');
  const [processorType, setProcessorType] = useState<string | null>(null);
  const [showProcessorJson, setShowProcessorJson] = useState(true);
  const [showAdvancedProcessorModal, setShowAdvancedProcessorModal] = useState(false);
  const [advancedFlowDefaultTarget, setAdvancedFlowDefaultTarget] = useState<string | null>(null);
  const [advancedFlowNotice, setAdvancedFlowNotice] = useState<string | null>(null);
  const [showAdvancedFlowJsonPreview, setShowAdvancedFlowJsonPreview] = useState(false);
  const [modalStack, setModalStack] = useState<string[]>([]);
  const flowEditorModalRef = useRef<HTMLDivElement | null>(null);
  const advancedFlowModalRef = useRef<HTMLDivElement | null>(null);
  const trapModalRef = useRef<HTMLDivElement | null>(null);
  const [advancedProcessorSearch, setAdvancedProcessorSearch] = useState('');
  const [advancedProcessorScope, setAdvancedProcessorScope] = useState<'object' | 'global'>(
    'object',
  );
  const [advancedFlowTarget, setAdvancedFlowTarget] = useState<{
    scope: 'object' | 'global';
    objectName?: string;
    method?: string;
  } | null>(null);
  const [advancedFlowBaseline, setAdvancedFlowBaseline] = useState<{
    scope: 'object' | 'global';
    objectName?: string;
    pre?: string;
    post?: string;
    object?: string;
  } | null>(null);
  const [processorTooltip, setProcessorTooltip] = useState<{
    title: string;
    description: string;
    example: string;
    x: number;
    y: number;
  } | null>(null);
  const [builderLiteralText, setBuilderLiteralText] = useState('');
  const [builderSwitchModal, setBuilderSwitchModal] = useState<{
    open: boolean;
    from?: 'eval' | 'processor' | 'literal' | null;
    to?: 'eval' | 'processor' | 'literal' | null;
  }>({ open: false });
  type ConditionNode = {
    id: string;
    type: 'condition';
    left: string;
    operator: string;
    right: string;
  };
  type ConditionGroup = {
    id: string;
    type: 'group';
    operator: 'AND' | 'OR';
    children: Array<ConditionTree>;
  };
  type ConditionTree = ConditionNode | ConditionGroup;
  type BuilderConditionRow = {
    id: string;
    condition: ConditionTree;
    result: string;
  };
  type BuilderSnapshot = {
    builderFocus: 'eval' | 'processor' | 'literal' | null;
    builderTypeLocked: 'eval' | 'processor' | 'literal' | null;
    builderMode: 'friendly' | 'regular';
    processorStep: 'select' | 'configure' | 'review';
    processorType: string | null;
    builderLiteralText: string;
    builderRegularText: string;
    builderConditions: BuilderConditionRow[];
    builderElseResult: string;
    builderProcessorConfig: ProcessorBuilderConfig;
    builderNestedAddType: string;
    builderSwitchCaseAddType: Record<string, string>;
    builderSwitchDefaultAddType: string;
    showProcessorJson: boolean;
  };
  type FlowNodeBase = {
    id: string;
    kind: 'processor' | 'if';
  };
  type FlowProcessorNode = FlowNodeBase & {
    kind: 'processor';
    processorType: string;
    config?: Record<string, unknown>;
  };
  type FlowIfNode = FlowNodeBase & {
    kind: 'if';
    then: FlowNode[];
    else: FlowNode[];
    condition: {
      property: string;
      operator: string;
      value: string;
    };
  };
  type FlowNode = FlowProcessorNode | FlowIfNode;
  type FlowBranchPath =
    | { kind: 'root' }
    | { kind: 'if'; id: string; branch: 'then' | 'else' }
    | { kind: 'foreach'; id: string; branch: 'processors' }
    | { kind: 'switch'; id: string; branch: 'case' | 'default'; caseId?: string };
  type UnknownRecord = Record<string, unknown>;
  type BrowseEntry = {
    PathID: string;
    PathName?: string;
    icon?: string;
    etag?: string;
    ModificationTime?: string;
  } & UnknownRecord;
  type SearchResultItem = {
    name?: string;
    pathId?: string;
    pathID?: string;
    path?: string;
    source?: string;
  } & UnknownRecord;
  type TrapVarbind = { oid: string; type: string; value: string };
  type ParsedTrapCommand = {
    version?: string;
    community?: string;
    host?: string;
    trapOid?: string;
    mibModule?: string;
    varbinds: TrapVarbind[];
  };
  type TrapTestItem = {
    objectName: string;
    sourceLabel: string;
    parsed: ParsedTrapCommand;
  };
  type MicroserviceEntry = {
    name?: string;
    label?: string;
    installed?: boolean;
    runningState?: string;
    running?: boolean;
    available?: boolean;
  } & UnknownRecord;
  const getResultFiles = (value: unknown): unknown[] | undefined => {
    if (!isRecord(value)) {
      return undefined;
    }
    const result = isRecord(value.result) ? value.result : null;
    return Array.isArray(result?.files) ? result.files : undefined;
  };
  const getObjectNameValue = (obj: unknown): string | null => {
    if (!isRecord(obj)) {
      return null;
    }
    return typeof obj['@objectName'] === 'string' ? obj['@objectName'] : null;
  };
  const getTrapVariables = (obj: unknown): unknown[] => {
    const trap = isRecord(obj) && isRecord(obj.trap) ? obj.trap : null;
    if (!trap) {
      return [];
    }
    const variables = trap.variables;
    return Array.isArray(variables) ? variables : [];
  };
  const getSetPayload = (value: unknown): UnknownRecord | null => {
    if (!isRecord(value)) {
      return null;
    }
    return isRecord(value.set) ? value.set : null;
  };
  const [builderProcessorConfig, setBuilderProcessorConfig] = useState<ProcessorBuilderConfig>({
    sourceType: 'literal',
    source: '',
    pattern: '',
    targetField: '',
  });
  const [builderNestedAddType, setBuilderNestedAddType] = useState('set');
  const [builderSwitchCaseAddType, setBuilderSwitchCaseAddType] = useState<Record<string, string>>(
    {},
  );
  const [builderSwitchDefaultAddType, setBuilderSwitchDefaultAddType] = useState('set');
  const BUILDER_HISTORY_LIMIT = 50;
  const deepClone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
  const createBuilderSnapshot = (): BuilderSnapshot => ({
    builderFocus,
    builderTypeLocked,
    builderMode,
    processorStep,
    processorType,
    builderLiteralText,
    builderRegularText,
    builderConditions: deepClone(builderConditions),
    builderElseResult,
    builderProcessorConfig: deepClone(builderProcessorConfig),
    builderNestedAddType,
    builderSwitchCaseAddType: deepClone(builderSwitchCaseAddType),
    builderSwitchDefaultAddType,
    showProcessorJson,
  });
  const applyBuilderSnapshot = (snapshot: BuilderSnapshot) => {
    setBuilderFocus(snapshot.builderFocus);
    setBuilderTypeLocked(snapshot.builderTypeLocked);
    setBuilderMode(snapshot.builderMode);
    setProcessorStep(snapshot.processorStep);
    setProcessorType(snapshot.processorType);
    setBuilderLiteralText(snapshot.builderLiteralText);
    setBuilderRegularText(snapshot.builderRegularText);
    setBuilderConditions(snapshot.builderConditions);
    setBuilderElseResult(snapshot.builderElseResult);
    setBuilderProcessorConfig(snapshot.builderProcessorConfig);
    setBuilderNestedAddType(snapshot.builderNestedAddType);
    setBuilderSwitchCaseAddType(snapshot.builderSwitchCaseAddType);
    setBuilderSwitchDefaultAddType(snapshot.builderSwitchDefaultAddType);
    setShowProcessorJson(snapshot.showProcessorJson);
  };
  const resetBuilderHistory = (snapshot?: BuilderSnapshot | null) => {
    if (!snapshot) {
      setBuilderUndoStack([]);
      setBuilderRedoStack([]);
      builderHistorySigRef.current = null;
      builderDirtySigRef.current = null;
      return;
    }
    setBuilderUndoStack([snapshot]);
    setBuilderRedoStack([]);
    builderHistorySigRef.current = JSON.stringify(snapshot);
  };
  const builderIdRef = useRef(0);
  const switchCaseIdRef = useRef(0);
  const nextBuilderId = () => {
    builderIdRef.current += 1;
    return `cond-${builderIdRef.current}`;
  };
  const nextFlowId = () => {
    flowIdRef.current += 1;
    return `flow-${flowIdRef.current}`;
  };
  const nextSwitchCaseId = () => {
    switchCaseIdRef.current += 1;
    return `case-${switchCaseIdRef.current}`;
  };
  const createFlowNode = (payload: {
    nodeKind: 'processor' | 'if';
    processorType?: string;
  }): FlowNode => {
    const fallbackTarget = advancedFlowDefaultTarget || '$.event.Field';
    if (payload.nodeKind === 'if') {
      return {
        id: nextFlowId(),
        kind: 'if',
        then: [],
        else: [],
        condition: {
          property: '$.event.Summary',
          operator: '=~',
          value: 'pattern',
        },
      };
    }
    if (payload.processorType) {
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: payload.processorType,
        config: getDefaultProcessorConfig(payload.processorType, fallbackTarget),
      };
    }
    return {
      id: nextFlowId(),
      kind: 'processor',
      processorType: 'set',
      config: getDefaultProcessorConfig('set', fallbackTarget),
    };
  };
  const getFlowStateByLane = (scope: 'object' | 'global', lane: 'object' | 'pre' | 'post') => {
    if (scope === 'global') {
      if (lane === 'pre') {
        return { nodes: globalPreFlow, setNodes: setGlobalPreFlow };
      }
      return { nodes: globalPostFlow, setNodes: setGlobalPostFlow };
    }
    return { nodes: advancedFlow, setNodes: setAdvancedFlow };
  };
  const buildProcessorPayloadFromConfig = (
    processorType: string,
    config: Record<string, unknown>,
    buildNested?: (nodes: FlowNode[]) => Record<string, unknown>[],
  ): Record<string, unknown> =>
    buildProcessorPayloadFromConfigShared(
      processorType,
      config,
      normalizeSourcePath,
      buildNested,
    );
  const [advancedFlowFocusTarget, setAdvancedFlowFocusTarget] = useState<string | null>(null);
  const [advancedFlowFocusIndex, setAdvancedFlowFocusIndex] = useState(0);
  const [advancedFlowFocusOnly, setAdvancedFlowFocusOnly] = useState(false);
  const advancedFlowHighlightRef = useRef<HTMLSpanElement | null>(null);
  const buildFlowProcessors = (nodes: FlowNode[]): Record<string, unknown>[] =>
    buildFlowProcessorsShared(nodes, normalizeSourcePath);
  const renderJsonWithFocus = (jsonString: string, focusJson?: string) => {
    if (!focusJson || !jsonString.includes(focusJson)) {
      return <pre className="code-block">{jsonString}</pre>;
    }
    const index = jsonString.indexOf(focusJson);
    const before = jsonString.slice(0, index);
    const after = jsonString.slice(index + focusJson.length);
    return (
      <pre className="code-block">
        {before}
        <span ref={advancedFlowHighlightRef} className="code-highlight">
          {focusJson}
        </span>
        {after}
      </pre>
    );
  };
  const createConditionNode = (): ConditionNode => ({
    id: nextBuilderId(),
    type: 'condition',
    left: '$v1',
    operator: '==',
    right: '1',
  });
  const createGroupNode = (): ConditionGroup => ({
    id: nextBuilderId(),
    type: 'group',
    operator: 'AND',
    children: [createConditionNode()],
  });
  const [builderConditions, setBuilderConditions] = useState<BuilderConditionRow[]>([
    { id: nextBuilderId(), condition: createConditionNode(), result: '1' },
  ]);
  const [builderElseResult, setBuilderElseResult] = useState('0');
  const [builderRegularText, setBuilderRegularText] = useState('');
  const varListRef = useRef<HTMLDivElement | null>(null);
  const varRowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const builderSyncRef = useRef<'friendly' | 'regular' | null>(null);
  const [advancedFlow, setAdvancedFlow] = useState<FlowNode[]>([]);
  const [globalPreFlow, setGlobalPreFlow] = useState<FlowNode[]>([]);
  const [globalPostFlow, setGlobalPostFlow] = useState<FlowNode[]>([]);
  const {
    flowEditor,
    setFlowEditor,
    flowEditorDraft,
    setFlowEditorDraft,
    openFlowEditor,
    handleCancelFlowEditor,
    handleSaveFlowEditor,
  } = useFlowEditorState(getFlowStateByLane);
  const [showFieldReferenceModal, setShowFieldReferenceModal] = useState(false);
  const [eventFieldPickerOpen, setEventFieldPickerOpen] = useState(false);
  const [eventFieldSearch, setEventFieldSearch] = useState('');
  const [eventFieldInsertContext, setEventFieldInsertContext] = useState<{
    panelKey: string;
    field: string;
    value: string;
    replaceStart: number;
    replaceEnd: number;
  } | null>(null);
  const flowIdRef = useRef(0);
  const isPreGlobalFlow = flowEditor?.scope === 'global' && flowEditor?.lane === 'pre';
  const isPreScopeEventPath = (value: string | undefined | null) =>
    isPreGlobalFlow && typeof value === 'string' && value.includes('$.event');
  const _hasPreScopeEventUsage = (draft: FlowNode | null) => {
    if (!draft || !isPreGlobalFlow) {
      return false;
    }
    if (draft.kind === 'if') {
      return (
        isPreScopeEventPath(draft.condition.property) || isPreScopeEventPath(draft.condition.value)
      );
    }
    return (
      isPreScopeEventPath(typeof draft.config?.source === 'string' ? draft.config.source : null) ||
      isPreScopeEventPath(
        typeof draft.config?.targetField === 'string' ? draft.config.targetField : null,
      ) ||
      isPreScopeEventPath(typeof draft.config?.pattern === 'string' ? draft.config.pattern : null)
    );
  };

  const getNestedValue = (source: unknown, path: string) =>
    path.split('.').reduce<unknown>((acc, key) => {
      if (!isRecord(acc)) {
        return undefined;
      }
      return acc[key];
    }, source);
  const parsePermissionFlag = (value: unknown) => {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value > 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', ''].includes(normalized)) {
        return false;
      }
    }
    return false;
  };
  const parseAccessValue = (value: unknown) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (/\b(write|update|edit|modify|rw|readwrite)\b/.test(normalized)) {
        return true;
      }
      if (/\b(read|ro|view|readonly|read-only)\b/.test(normalized)) {
        return false;
      }
    }
    return null;
  };
  const findRulePermissionValues = (source: unknown) => {
    const matches: unknown[] = [];
    const walk = (node: unknown, pathKeys: string[]) => {
      if (!node) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, [...pathKeys, String(index)]));
        return;
      }
      if (!isRecord(node)) {
        return;
      }
      Object.entries(node).forEach(([key, value]) => {
        const nextPath = [...pathKeys, key];
        const hasRule = nextPath.some((segment) => /rule/i.test(segment));
        const hasRules = nextPath.some((segment) => /rules/i.test(segment));
        if (/update/i.test(key) && hasRule && hasRules) {
          matches.push(value);
        }
        if (/(access|permission|mode)/i.test(key) && hasRule && hasRules) {
          matches.push(value);
        }
        walk(value, nextPath);
      });
    };
    walk(source, []);
    return matches;
  };
  const permissionPaths = [
    'data.Permissions.rule.Rules.update',
    'data.Permissions.rule.Rules.Update',
    'data.Permissions.Rule.Rules.update',
    'data.Permissions.Rule.Rules.Update',
    'Permissions.rule.Rules.update',
    'Permissions.rule.Rules.Update',
    'Permissions.Rule.Rules.update',
    'Permissions.Rule.Rules.Update',
    'data.permissions.rule.Rules.update',
    'permissions.rule.Rules.update',
  ];

  const processorConfigSpecs: Record<
    string,
    Array<{
      key: string;
      label: string;
      type: 'text' | 'json' | 'boolean' | 'select';
      placeholder?: string;
      options?: Array<{ label: string; value: string }>;
    }>
  > = {
    set: [
      {
        key: 'sourceType',
        label: 'Interpret as',
        type: 'select',
        options: [
          { label: 'Literal', value: 'literal' },
          { label: 'Path', value: 'path' },
        ],
      },
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Node' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.NewField' },
      { key: 'args', label: 'Args (JSON array, optional)', type: 'json', placeholder: '[]' },
    ],
    regex: [
      {
        key: 'sourceType',
        label: 'Interpret as',
        type: 'select',
        options: [
          { label: 'Literal', value: 'literal' },
          { label: 'Path', value: 'path' },
        ],
      },
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Summary' },
      { key: 'pattern', label: 'Pattern', type: 'text', placeholder: '(.*)' },
      { key: 'group', label: 'Group (optional)', type: 'text', placeholder: '1' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.Matched' },
    ],
    append: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Example Value' },
      { key: 'array', label: 'Array (JSON)', type: 'json', placeholder: '[]' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.NewArray' },
    ],
    appendToOutputStream: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap' },
      {
        key: 'output',
        label: 'Output',
        type: 'text',
        placeholder: 'pulsar+ssl:///assure1/event/sink',
      },
    ],
    break: [],
    convert: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
      { key: 'type', label: 'Type', type: 'text', placeholder: 'inttostring' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.CountString' },
    ],
    copy: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.CopiedCount' },
    ],
    discard: [],
    eval: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '<expression>' },
      {
        key: 'targetField',
        label: 'Target (optional)',
        type: 'text',
        placeholder: '$.localmem.evalResult',
      },
    ],
    foreach: [
      {
        key: 'source',
        label: 'Source',
        type: 'text',
        placeholder: '$.event.Details.trap.variables',
      },
      { key: 'keyVal', label: 'Key', type: 'text', placeholder: 'i' },
      { key: 'valField', label: 'Value', type: 'text', placeholder: 'v' },
    ],
    grok: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.syslog.datagram' },
      {
        key: 'pattern',
        label: 'Pattern',
        type: 'text',
        placeholder:
          '%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}',
      },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.syslog.variables' },
    ],
    json: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '{"key":"value"}' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.json' },
    ],
    log: [
      { key: 'type', label: 'Type', type: 'text', placeholder: 'info' },
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Log message' },
    ],
    lookup: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'db' },
      { key: 'properties', label: 'Properties (JSON)', type: 'json', placeholder: '{}' },
      { key: 'fallback', label: 'Fallback (JSON)', type: 'json', placeholder: '{}' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.results' },
    ],
    math: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
      { key: 'operation', label: 'Operation', type: 'text', placeholder: '*' },
      { key: 'value', label: 'Value', type: 'text', placeholder: '2' },
      {
        key: 'targetField',
        label: 'Target',
        type: 'text',
        placeholder: '$.localmem.CountTimesTwo',
      },
    ],
    remove: [{ key: 'source', label: 'Source', type: 'text', placeholder: '$.trap.timeTicks' }],
    rename: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Details' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.DetailsOld' },
    ],
    replace: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'This is a test' },
      { key: 'pattern', label: 'Pattern', type: 'text', placeholder: 'a test' },
      { key: 'replacement', label: 'Replacement', type: 'text', placeholder: 'not a test' },
      { key: 'regex', label: 'Regex', type: 'boolean' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.example' },
    ],
    setOutputStream: [
      {
        key: 'output',
        label: 'Output',
        type: 'text',
        placeholder: 'pulsar+ssl:///assure1/event/sink',
      },
    ],
    sort: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap.variables[0]' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.trap.sortedVariables' },
    ],
    split: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '1,2,3,4' },
      { key: 'delimiter', label: 'Delimiter', type: 'text', placeholder: ',' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.splitarr' },
    ],
    strcase: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'HELLO, WORLD' },
      { key: 'type', label: 'Type', type: 'text', placeholder: 'lower' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.lowercase' },
    ],
    substr: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Hello' },
      { key: 'start', label: 'Start (optional)', type: 'text', placeholder: '1' },
      { key: 'end', label: 'End (optional)', type: 'text', placeholder: '' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.substr' },
    ],
    switch: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.localmem.val1' },
      { key: 'operator', label: 'Operator', type: 'text', placeholder: '!=' },
    ],
    trim: [
      { key: 'source', label: 'Source', type: 'text', placeholder: 'Hello' },
      { key: 'cutset', label: 'Cutset', type: 'text', placeholder: 'H' },
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.trim' },
    ],
  };

  const _getFlowEditorJsonErrors = (draft: FlowNode | null) => {
    if (!draft || draft.kind !== 'processor') {
      return [] as Array<{ field: string; message: string }>;
    }
    const errors: Array<{ field: string; message: string }> = [];
    const specs = processorConfigSpecs[draft.processorType] || [];
    specs.forEach((spec) => {
      if (spec.type !== 'json') {
        return;
      }
      const valueKey = `${spec.key}Text`;
      const raw = String(draft.config?.[valueKey] ?? '').trim();
      if (!raw) {
        return;
      }
      try {
        JSON.parse(raw);
      } catch {
        errors.push({ field: spec.key, message: `${spec.label} must be valid JSON.` });
      }
    });
    if (draft.processorType === 'set') {
      const raw = String(draft.config?.argsText ?? '').trim();
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            errors.push({ field: 'args', message: 'Args must be a JSON array.' });
          }
        } catch {
          errors.push({ field: 'args', message: 'Args must be valid JSON.' });
        }
      }
    }
    return errors;
  };

  const applyFlowEditorExample = () => {
    if (!flowEditorDraft) {
      return;
    }
    const key = flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType;
    const help = processorHelp[key];
    if (!help?.example) {
      return;
    }
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(help.example);
    } catch {
      return;
    }
    const parsedRecord = isRecord(parsed) ? parsed : null;
    const processorKey = parsedRecord ? Object.keys(parsedRecord)[0] : '';
    const payload = parsedRecord && processorKey ? parsedRecord[processorKey] : null;
    const payloadRecord = isRecord(payload) ? payload : null;
    if (!processorKey || !payload) {
      return;
    }
    if (flowEditorDraft.kind === 'if' && processorKey === 'if') {
      setFlowEditorDraft((prev) =>
        prev && prev.kind === 'if'
          ? {
              ...prev,
              condition: {
                property: String(payloadRecord?.['source'] ?? ''),
                operator: String(payloadRecord?.['operator'] ?? '=='),
                value: String(payloadRecord?.['value'] ?? ''),
              },
            }
          : prev,
      );
      return;
    }
    if (flowEditorDraft.kind !== 'processor') {
      return;
    }
    const nextConfig: Record<string, any> = { ...(flowEditorDraft.config || {}) };
    Object.entries(payload).forEach(([field, value]) => {
      if (field === 'array' && Array.isArray(value)) {
        nextConfig.arrayText = JSON.stringify(value, null, 2);
        return;
      }
      if (field === 'properties' && value && typeof value === 'object') {
        nextConfig.propertiesText = JSON.stringify(value, null, 2);
        return;
      }
      if (field === 'fallback' && value && typeof value === 'object') {
        nextConfig.fallbackText = JSON.stringify(value, null, 2);
        return;
      }
      if (field === 'args' && Array.isArray(value)) {
        nextConfig.argsText = JSON.stringify(value, null, 2);
        return;
      }
      if (
        field === 'processors' ||
        field === 'then' ||
        field === 'else' ||
        field === 'case' ||
        field === 'default'
      ) {
        return;
      }
      nextConfig[field] = value;
    });
    setFlowEditorDraft((prev) =>
      prev && prev.kind === 'processor'
        ? {
            ...prev,
            config: nextConfig,
          }
        : prev,
    );
  };
  const explicitFlags = permissionPaths
    .map((path) => getNestedValue(session?.ua_login, path))
    .filter((value) => value !== undefined);
  const recursiveFlags = findRulePermissionValues(session?.ua_login);
  const accessFlags = [...explicitFlags, ...recursiveFlags]
    .map((value) => parseAccessValue(value))
    .filter((value) => value !== null) as boolean[];
  const derivedEditRules =
    explicitFlags.some((value) => parsePermissionFlag(value)) ||
    recursiveFlags.some((value) => parsePermissionFlag(value)) ||
    accessFlags.some((value) => value);
  const canEditRules =
    typeof session?.can_edit_rules === 'boolean' ? session.can_edit_rules : derivedEditRules;
  const hasEditPermission = Boolean(canEditRules);
  const ensureEditPermission = () => {
    if (hasEditPermission) {
      return true;
    }
    setSaveError('Read-only access. You do not have permission to edit rules.');
    return false;
  };

  useEffect(() => {
    if (viewMode === 'friendly') {
      return;
    }
    setPanelEditState({});
    setPanelDrafts({});
    setPanelEvalModes({});
    setPanelOverrideRemovals({});
    setPanelNavWarning({ open: false, fields: {} });
  }, [viewMode]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (activeApp !== 'mib') {
      return;
    }
    if (mibEntries.length > 0 || mibLoading) {
      return;
    }
    if (mibUrlHydratingRef.current || (mibPath && mibPath !== '/')) {
      return;
    }
    void loadMibPath('/');
  }, [activeApp, isAuthenticated, mibEntries.length, mibLoading, mibPath]);

  useEffect(() => {
    if (!saveLoading) {
      setSaveElapsed(0);
      return;
    }
    setSaveElapsed(0);
    const interval = window.setInterval(() => {
      setSaveElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [saveLoading]);
  useEffect(() => {
    if (!redeployLoading) {
      setRedeployElapsed(0);
      return;
    }
    setRedeployElapsed(0);
    const interval = window.setInterval(() => {
      setRedeployElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [redeployLoading]);
  useEffect(() => {
    if (!stagedToast) {
      return;
    }
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    if (pulseTimeoutRef.current) {
      window.clearTimeout(pulseTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setStagedToast(null);
      if (toastPulseAfter) {
        setReviewCtaPulse(true);
        pulseTimeoutRef.current = window.setTimeout(() => {
          setReviewCtaPulse(false);
        }, 1400);
        setToastPulseAfter(false);
      }
    }, 4500);
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [stagedToast, toastPulseAfter]);

  const clearTimerList = (timerRef: React.MutableRefObject<number[]>) => {
    timerRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timerRef.current = [];
  };

  useEffect(() => {
    fileLoadStageDisplayRef.current = fileLoadStageDisplay;
  }, [fileLoadStageDisplay]);

  useEffect(() => {
    overrideSaveDisplayRef.current = overrideSaveDisplayStatus;
  }, [overrideSaveDisplayStatus]);

  useEffect(() => {
    clearTimerList(fileLoadStageTimersRef);
    if (!fileLoadStageTarget) {
      if (!fileLoadStageDisplayRef.current) {
        return;
      }
      const elapsed = fileLoadStageStartRef.current
        ? Date.now() - fileLoadStageStartRef.current
        : 0;
      const delay = Math.max(
        FILE_LOAD_STAGE_TIMING.exitGraceMs,
        FILE_LOAD_STAGE_TIMING.minVisibleMs - elapsed,
      );
      const timerId = window.setTimeout(() => {
        setFileLoadStageDisplay(null);
        fileLoadStageStartRef.current = null;
      }, Math.max(0, delay));
      fileLoadStageTimersRef.current.push(timerId);
      return;
    }
    const targetIndex = FILE_LOAD_STAGE_ORDER.indexOf(fileLoadStageTarget);
    if (targetIndex === -1) {
      return;
    }
    const currentDisplay = fileLoadStageDisplayRef.current;
    const currentIndex = currentDisplay
      ? FILE_LOAD_STAGE_ORDER.indexOf(currentDisplay)
      : -1;
    const nextStages = FILE_LOAD_STAGE_ORDER.slice(
      currentIndex === -1 ? 0 : currentIndex + 1,
      targetIndex + 1,
    );
    if (nextStages.length === 0) {
      return;
    }
    let delay = currentIndex === -1
      ? FILE_LOAD_STAGE_TIMING.showDelayMs
      : FILE_LOAD_STAGE_TIMING.stepMs;
    nextStages.forEach((stage) => {
      const timerId = window.setTimeout(() => {
        if (!fileLoadStageStartRef.current) {
          fileLoadStageStartRef.current = Date.now();
        }
        setFileLoadStageDisplay(stage);
      }, delay);
      fileLoadStageTimersRef.current.push(timerId);
      delay += FILE_LOAD_STAGE_TIMING.stepMs;
    });
  }, [fileLoadStageTarget]);

  useEffect(() => {
    if (fileLoadStageTarget !== 'render') {
      return;
    }
    if (fileLoading) {
      return;
    }
    if (fileLoadStageDisplay !== 'render') {
      return;
    }
    if (fileLoadStageHideTimeoutRef.current) {
      return;
    }
    fileLoadStageHideTimeoutRef.current = window.setTimeout(() => {
      setFileLoadStageTarget(null);
      fileLoadStageHideTimeoutRef.current = null;
    }, FILE_LOAD_STAGE_TIMING.holdAfterRenderMs);
  }, [fileLoadStageTarget, fileLoadStageDisplay, fileLoading]);

  useEffect(() => {
    clearTimerList(overrideSaveStatusTimersRef);
    if (overrideSaveStatus.length === 0) {
      setOverrideSaveDisplayStatus([]);
      return;
    }
    const allFinal = overrideSaveStatus.every(
      (entry) => entry.status === 'done' || entry.status === 'failed',
    );
    const hasInFlight = overrideSaveStatus.some(
      (entry) => entry.status === 'saving' || entry.status === 'retrying',
    );
    const currentDisplay = overrideSaveDisplayRef.current;
    const displayHasProgress = currentDisplay.some(
      (entry) => entry.status !== 'queued',
    );
    if (!allFinal || hasInFlight || displayHasProgress) {
      setOverrideSaveDisplayStatus(overrideSaveStatus);
      return;
    }
    setOverrideSaveDisplayStatus((prev) => {
      if (prev.length === 0) {
        return overrideSaveStatus.map((entry) => ({ ...entry, status: 'queued' }));
      }
      const prevStatus = new Map(prev.map((entry) => [entry.fileName, entry.status]));
      return overrideSaveStatus.map((entry) => ({
        ...entry,
        status: prevStatus.get(entry.fileName) ?? 'queued',
      }));
    });
    overrideSaveStatus.forEach((entry, index) => {
      const savingDelay = OVERRIDE_SAVE_TIMING.staggerMs * index;
      const doneDelay = savingDelay + OVERRIDE_SAVE_TIMING.stepMs;
      const savingTimer = window.setTimeout(() => {
        setOverrideSaveDisplayStatus((prev) =>
          prev.map((item) =>
            item.fileName === entry.fileName ? { ...item, status: 'saving' } : item,
          ),
        );
      }, savingDelay);
      const doneTimer = window.setTimeout(() => {
        setOverrideSaveDisplayStatus((prev) =>
          prev.map((item) =>
            item.fileName === entry.fileName
              ? { ...item, status: entry.status }
              : item,
          ),
        );
      }, doneDelay);
      overrideSaveStatusTimersRef.current.push(savingTimer, doneTimer);
    });
  }, [overrideSaveStatus]);

  useEffect(() => {
    if (saveLoading || overrideSaveStatus.length === 0) {
      return;
    }
    const completed = overrideSaveStatus.every(
      (entry) => entry.status === 'done' || entry.status === 'failed',
    );
    if (!completed) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setOverrideSaveStatus([]);
    }, 6000);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [overrideSaveStatus, saveLoading]);

  useEffect(() => {
    setOverrideSaveStatus([]);
  }, [selectedFile?.PathID]);
  const isAnyPanelEditing = Object.values(panelEditState).some(Boolean);

  const _togglePanelEdit = (key: string) => {
    setPanelEditState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const updateBuilderDraftField = (field: string, value: string) => {
    if (field === 'processorSource') {
      setBuilderProcessorConfig((prev) => ({
        ...prev,
        source: value,
      }));
    }
    if (field === 'processorTarget') {
      setBuilderProcessorConfig((prev) => ({
        ...prev,
        targetField: value,
      }));
    }
    if (field === 'processorPattern') {
      setBuilderProcessorConfig((prev) => ({
        ...prev,
        pattern: value,
      }));
    }
  };

  const handleProcessorSourceChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    const inferredType = value.trim().startsWith('$.') ? 'path' : 'literal';
    setBuilderProcessorConfig((prev) => ({
      ...prev,
      source: value,
      ...(processorType && ['set', 'regex'].includes(processorType)
        ? { sourceType: inferredType }
        : {}),
    }));
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    const trapVars = getTrapVariables(obj);
    if (
      tryOpenVarInsertModal({
        panelKey: builderTarget.panelKey,
        field: 'processorSource',
        value,
        cursorIndex,
        trapVars,
      })
    ) {
      return;
    }
    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch || isPreGlobalFlow) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'processorSource',
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const handleProcessorTargetChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setBuilderProcessorConfig((prev) => ({
      ...prev,
      targetField: value,
    }));
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'processorTarget',
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const handleRegularEvalInputChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setBuilderRegularText(value);
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    const trapVars = getTrapVariables(obj);
    if (
      tryOpenVarInsertModal({
        panelKey: builderTarget.panelKey,
        field: 'builderRegular',
        value,
        cursorIndex,
        trapVars,
      })
    ) {
      return;
    }
    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'builderRegular',
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const splitTopLevel = (expr: string, token: string) => {
    const parts: string[] = [];
    let depth = 0;
    let buffer = '';
    for (let i = 0; i < expr.length; i += 1) {
      const ch = expr[i];
      if (ch === '(') {
        depth += 1;
      }
      if (ch === ')') {
        depth = Math.max(0, depth - 1);
      }
      if (depth === 0 && expr.slice(i, i + token.length) === token) {
        parts.push(buffer.trim());
        buffer = '';
        i += token.length - 1;
        continue;
      }
      buffer += ch;
    }
    if (buffer.trim()) {
      parts.push(buffer.trim());
    }
    return parts;
  };

  const parseConditionExpression = (expr: string): ConditionTree | null => {
    const cleaned = unwrapOuterParens(expr.trim());
    if (!cleaned) {
      return null;
    }
    const orParts = splitTopLevel(cleaned, '||');
    if (orParts.length > 1) {
      const children = orParts.map(parseConditionExpression);
      if (children.some((child) => !child)) {
        return null;
      }
      return {
        id: nextBuilderId(),
        type: 'group',
        operator: 'OR',
        children: children as ConditionTree[],
      };
    }
    const andParts = splitTopLevel(cleaned, '&&');
    if (andParts.length > 1) {
      const children = andParts.map(parseConditionExpression);
      if (children.some((child) => !child)) {
        return null;
      }
      return {
        id: nextBuilderId(),
        type: 'group',
        operator: 'AND',
        children: children as ConditionTree[],
      };
    }
    const match = cleaned.match(/^(.+?)(==|!=|>=|<=|>|<)(.+)$/);
    if (!match) {
      return null;
    }
    const [, left, operator, right] = match;
    return {
      id: nextBuilderId(),
      type: 'condition',
      left: left.trim(),
      operator,
      right: right.trim(),
    };
  };

  const parseEvalToRows = (text: string) => {
    const cleaned = unwrapOuterParens(text.trim());
    if (!cleaned) {
      return null;
    }
    const rows: BuilderConditionRow[] = [];
    let elseResult = '';
    const walk = (expr: string): boolean => {
      const node = splitTernary(unwrapOuterParens(expr.trim()));
      if (!node) {
        elseResult = expr.trim();
        return true;
      }
      const conditionNode = parseConditionExpression(node.condition);
      if (!conditionNode) {
        return false;
      }
      rows.push({
        id: nextBuilderId(),
        condition: conditionNode,
        result: node.whenTrue.trim(),
      });
      return walk(node.whenFalse);
    };
    if (!walk(cleaned)) {
      return null;
    }
    if (!elseResult || rows.length === 0) {
      return null;
    }
    return { rows, elseResult };
  };

  const serverOptions = useMemo(
    () =>
      servers.map((srv) => ({
        value: srv.server_id,
        label: srv.server_name,
      })),
    [servers],
  );

  const redeployStorageKey = useMemo(() => {
    const sessionId = session?.session_id || session?.user || 'anonymous';
    const serverKey = session?.server_id || serverId || 'unknown-server';
    return `fcom.redeployReady.${serverKey}.${sessionId}`;
  }, [serverId, session?.server_id, session?.session_id, session?.user]);

  const microserviceStatusData = isRecord(microserviceStatus) ? microserviceStatus : null;
  const requiredRawMicroservices = Array.isArray(microserviceStatusData?.required)
    ? microserviceStatusData.required
    : [];
  const requiredMicroservices: MicroserviceEntry[] = requiredRawMicroservices
    .filter((entry): entry is UnknownRecord => isRecord(entry))
    .map((entry) => entry as MicroserviceEntry);
  const missingMicroservices = requiredMicroservices
    .filter((entry) => !entry?.installed)
    .map((entry) => entry?.label || entry?.name || 'unknown');
  const unhealthyMicroservices = requiredMicroservices
    .filter((entry) => {
      if (!entry?.installed) {
        return false;
      }
      if (entry?.runningState) {
        return entry.runningState === 'down';
      }
      return entry?.running === false;
    })
    .map((entry) => entry?.label || entry?.name || 'unknown');
  const unknownMicroservices = requiredMicroservices
    .filter((entry) => entry?.installed && entry?.runningState === 'unknown')
    .map((entry) => entry?.label || entry?.name || 'unknown');
  const fcomServiceStatus = requiredMicroservices.find(
    (entry) => entry?.name === 'fcom-processor',
  );
  const showMicroserviceWarning =
    missingMicroservices.length > 0 || unhealthyMicroservices.length > 0;
  const showMicroserviceUnknown = !showMicroserviceWarning && unknownMicroservices.length > 0;
  const microserviceWarningTitle = showMicroserviceWarning
    ? `Issues: ${[...missingMicroservices, ...unhealthyMicroservices].join(', ')}`
    : '';
  const microserviceUnknownTitle = showMicroserviceUnknown
    ? `Unknown: ${unknownMicroservices.join(', ')}`
    : '';
  const microserviceNeedsRedeploy = redeployReady;
  const microserviceIndicatorState = microserviceStatusLoading
    ? 'loading'
    : microserviceStatusError
      ? 'warn'
      : showMicroserviceWarning
        ? 'warn'
        : showMicroserviceUnknown
          ? 'warn'
          : Boolean(microserviceStatusData?.chainReady)
          ? 'ok'
          : 'warn';
  const microserviceIndicatorLabel = microserviceStatusLoading
    ? '...'
    : showMicroserviceWarning
      ? '!'
      : showMicroserviceUnknown
        ? '?'
      : microserviceNeedsRedeploy
        ? null
        : microserviceIndicatorState === 'ok'
          ? 'OK'
          : '!';
  const microserviceIndicatorTitle = microserviceStatusLoading
    ? 'Checking microservice status'
    : microserviceStatusError
      ? microserviceStatusError
      : showMicroserviceWarning
        ? microserviceWarningTitle || 'Microservice issues detected'
        : showMicroserviceUnknown
          ? microserviceUnknownTitle || 'Microservice status unknown'
        : microserviceNeedsRedeploy
          ? 'Changes staged. Redeploy FCOM Processor to apply.'
          : microserviceIndicatorState === 'ok'
            ? 'All required microservices running'
            : 'Microservice issues detected';
    const microserviceStaleMs = 2 * 60 * 1000;
    const microserviceLastRefreshedAt = microserviceLastRefreshed
      ? new Date(microserviceLastRefreshed).getTime()
      : null;
    const microserviceIsStale =
      microserviceLastRefreshedAt !== null &&
      Date.now() - microserviceLastRefreshedAt > microserviceStaleMs;
  const getServiceTone = (entry: MicroserviceEntry): 'ok' | 'warn' | 'error' => {
    if (!entry?.installed) {
      return 'error';
    }
    if (entry?.runningState === 'unknown') {
      return 'warn';
    }
    if (entry?.runningState === 'down' || entry?.running === false) {
      return 'warn';
    }
    return 'ok';
  };
  const getServiceStatusText = (entry: MicroserviceEntry): string => {
    if (!entry?.installed) {
      return entry?.available ? 'Missing (available to deploy)' : 'Missing (not in catalog)';
    }
    if (entry?.runningState === 'unknown') {
      return 'Installed, status unknown';
    }
    if (entry?.runningState === 'down' || entry?.running === false) {
      return 'Installed, not running';
    }
    return 'Running';
  };

  const setRedeployReadyState = (next: boolean) => {
    setRedeployReady(next);
    if (!isAuthenticated) {
      return;
    }
    if (next) {
      sessionStorage.setItem(redeployStorageKey, 'true');
    } else {
      sessionStorage.removeItem(redeployStorageKey);
    }
  };

  const refreshMicroserviceStatus = async (options?: { refresh?: boolean }) => {
    if (!isAuthenticated) {
      return;
    }
    const resp = await runMicroserviceStatusRequest(() => api.getMicroserviceStatus(options), {
      getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to load microservice status'),
    });
    if (resp) {
      setMicroserviceStatus(resp.data);
      setMicroserviceLastRefreshed(new Date().toISOString());
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const sessionResp = await api.getSession();
        setSession(sessionResp.data);
      } catch {
        // no session
      }

      try {
        const serversResp = await api.listServers();
        setServers(serversResp.data);
        if (!serverId && serversResp.data.length > 0) {
          setServerId(serversResp.data[0].server_id);
        }
      } catch {
        setError('Failed to load server list');
      }
    };

    init();
  }, [setSession, setServers, serverId]);

  useEffect(() => {
    if (!isAuthenticated) {
      urlHydrated.current = false;
      setEventsSchemaFields([]);
      setRedeployReady(false);
      sessionStorage.removeItem(redeployStorageKey);
      setRedeployModalOpen(false);
      setRedeployLoading(false);
      setRedeployError(null);
      setMicroserviceActionLabel(null);
      setMicroserviceStatus(null);
      setMicroserviceStatusLoading(false);
      setMicroserviceStatusError(null);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const stored = sessionStorage.getItem(redeployStorageKey);
    setRedeployReady(stored === 'true');
  }, [isAuthenticated, redeployStorageKey]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const loadEventsSchema = async () => {
      try {
        const resp = await api.getEventsSchema();
        const fields = Array.isArray(resp.data?.fields) ? resp.data.fields : [];
        setEventsSchemaFields(fields.map(String));
      } catch {
        setEventsSchemaFields([]);
      }
    };
    loadEventsSchema();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    refreshMicroserviceStatus();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }
    const intervalId = window.setInterval(() => {
      refreshMicroserviceStatus();
    }, 60000);
    return () => window.clearInterval(intervalId);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const storedApp = sessionStorage.getItem('com.activeApp');
    if (
      storedApp === 'overview' ||
      storedApp === 'fcom' ||
      storedApp === 'pcom' ||
      storedApp === 'mib' ||
      storedApp === 'legacy'
    ) {
      setActiveApp(storedApp as AppTab);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    sessionStorage.setItem('com.activeApp', activeApp);
  }, [activeApp, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || activeApp !== 'mib') {
      return;
    }
    let isMounted = true;
    const loadDevices = async () => {
      const resp = await runPcomDevicesRequest(() => api.getDevices({ limit: 500, start: 0 }), {
        getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to load devices'),
      });
      if (!isMounted) {
        return;
      }
      if (resp) {
        const devices = Array.isArray(resp.data?.devices) ? resp.data.devices : [];
        setPcomDevices(devices);
      } else {
        setPcomDevices([]);
      }
    };
    loadDevices();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, activeApp]);

  useEffect(() => {
    if (isAuthenticated && entries.length === 0 && !browseLoading && !urlHydrated.current) {
      if (activeApp === 'fcom' || activeApp === 'pcom') {
        loadDefaultBrowseNode(activeApp);
      } else {
        loadNode(null, '/');
      }
    }
  }, [isAuthenticated, entries.length, browseLoading, activeApp]);

  useEffect(() => {
    if (!isAuthenticated || urlHydrated.current) {
      return;
    }
    urlHydrated.current = true;
    const params = new URLSearchParams(window.location.search);
    const nodeParam = params.get('node');
    const fileParam = params.get('file');
    const viewParam = params.get('view');
    const appParam = params.get('app');
    const mibPathParam = params.get('mibPath');
    const mibFileParam = params.get('mibFile');
    let initialApp: AppTab | null = null;

    if (viewParam === 'friendly') {
      setViewMode('friendly');
    }

    if (
      appParam === 'overview' ||
      appParam === 'fcom' ||
      appParam === 'pcom' ||
      appParam === 'mib' ||
      appParam === 'legacy'
    ) {
      setActiveApp(appParam as AppTab);
      initialApp = appParam as AppTab;
      if (appParam === 'mib') {
        const fallbackPath = mibFileParam
          ? mibFileParam.split('/').slice(0, -1).join('/')
          : null;
        const nextPath = mibPathParam || fallbackPath || '/';
        mibUrlHydratingRef.current = true;
        setMibPath(nextPath);
        void loadMibPath(nextPath, { append: false });
        if (mibFileParam) {
          void openMibFileFromUrl(mibFileParam);
        }
        return;
      }
    } else {
      const inferred = inferAppFromPath(fileParam || nodeParam);
      if (inferred) {
        setActiveApp(inferred);
        initialApp = inferred;
      }
    }

    if (fileParam) {
      void openFileFromUrl(fileParam, nodeParam);
      return;
    }

    if (nodeParam) {
      setBreadcrumbs(buildBreadcrumbsFromNode(nodeParam));
      void loadNodeInternal(nodeParam);
      return;
    }

    if (initialApp === 'fcom' || initialApp === 'pcom') {
      void loadDefaultBrowseNode(initialApp);
      return;
    }
    void loadNodeInternal(null, '/');
  }, [isAuthenticated]);

  useEffect(() => {
    breadcrumbsRef.current = breadcrumbs;
  }, [breadcrumbs]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (activeApp === 'mib') {
      params.delete('node');
      params.delete('file');
      params.set('mibPath', mibPath || '/');
      if (mibSelectedFile) {
        params.set('mibFile', mibSelectedFile);
      } else {
        params.delete('mibFile');
      }
    } else if (activeApp === 'legacy') {
      params.delete('node');
      params.delete('file');
      params.delete('mibPath');
      params.delete('mibFile');
    } else {
      params.delete('mibPath');
      params.delete('mibFile');
      if (browseNode) {
        params.set('node', browseNode);
      } else {
        params.delete('node');
      }
      if (selectedFile?.PathID) {
        params.set('file', selectedFile.PathID);
      } else {
        params.delete('file');
      }
    }
    params.set('app', activeApp);
    params.set('view', viewMode);
    if (session?.server_id) {
      params.set('server', session.server_id);
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [activeApp, browseNode, selectedFile, viewMode, mibPath, mibSelectedFile, isAuthenticated, session?.server_id]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const effectiveAuthType: 'basic' = 'basic';
      const credentials = { username, password };

      const resp = await api.login(serverId, effectiveAuthType, credentials);
      // Debug: log login response payload (omit credentials)
      console.info('Login response:', resp?.data);
      setSession(resp.data);
      setActiveApp('overview');
    } catch (err: unknown) {
      console.error('Login error:', err);
      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutInternal = async () => {
    try {
      await api.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearSession();
      urlHydrated.current = false;
      sessionStorage.removeItem('com.activeApp');
      sessionStorage.removeItem(redeployStorageKey);
      localStorage.removeItem('mib.recentTargets');
      setActiveApp('overview');
      setSelectedFile(null);
      setFileData(null);
      setOverrideInfo(null);
      setOverrideError(null);
      setFileError(null);
      setSaveError(null);
      setSaveSuccess(null);
      setStagedToast(null);
      setRedeployReady(false);
      setRedeployModalOpen(false);
      setRedeployLoading(false);
      setRedeployError(null);
      resetSearchState();
      matchStateByFileRef.current = {};
      scrollStateByFileRef.current = {};
      setSelectedFolder(null);
      setFolderOverview(null);
      setEntries([]);
      setBrowseData(null);
      setBrowseNode(null);
      setBreadcrumbs([{ label: '/', node: null }]);
      setViewMode('friendly');
      resetMibState();
      setMibTrapDefaults(null);
      setTrapModalOpen(false);
      setTrapSource('mib');
      setTrapObjectName('');
      setTrapHost('');
      setTrapPort(162);
      setTrapCommunity('public');
      setTrapVersion('2c');
      setTrapOid('');
      setTrapMibModule('');
      setTrapVarbinds([]);
      setTrapServerList([]);
      setTrapServerError(null);
      setTrapManualOpen(false);
      setTrapSending(false);
      setTrapError(null);
      setRecentTargets([]);
      setBulkTrapContext(null);
      setBulkTrapProgress({
        current: 0,
        total: 0,
        failed: 0,
        currentLabel: '',
      });
      setBulkTrapFailures([]);
      setBulkTrapSummary(null);
      setBulkTrapShowAllFailures(false);
      setPcomDeviceIp('');
      setPcomSnmpVersion('2c');
      setPcomSnmpCommunity('mtsro');
      setPcomAdvancedOpen(false);
      setPcomAdvancedActive(false);
      setPcomAdvancedTargetMode('device');
      setPcomAdvancedDeviceIp('');
      setPcomAdvancedManualIp('');
      setPcomAdvancedSnmpVersion('2c');
      setPcomAdvancedCommunity('mtsro');
      setPcomAdvancedSecurityLevel('authPriv');
      setPcomAdvancedUsername('');
      setPcomAdvancedAuthProtocol('');
      setPcomAdvancedAuthPassword('');
      setPcomAdvancedPrivProtocol('');
      setPcomAdvancedPrivPassword('');
      setPcomAdvancedEngineId('');
      setPcomAdvancedOidEnabled(false);
      setPcomAdvancedOidValue('');
      setPcomSnmpProfile(null);
      setPcomSnmpProfileLoading(false);
      setPcomSnmpProfileError(null);
      setPcomPollLoading(false);
      setPcomPollError(null);
      setPcomPollOutput('');
      setPcomDevices([]);
      setPcomDevicesLoading(false);
      setPcomDevicesError(null);
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleLogout = () => {
    confirmDiscardIfDirty(() => {
      void handleLogoutInternal();
    });
  };

  const pcomEnterpriseBase = useMemo(() => {
    const raw = String(mibSelectedDefinition?.fullOid || mibSelectedDefinition?.oid || '').trim();
    if (!raw || raw === '—') {
      return '';
    }
    const normalized = raw.replace(/\s+/g, '.').replace(/\.+/g, '.');
    const numericOnly = normalized.replace(/^[^0-9]+/, '');
    if (!/^\d+(\.\d+)+$/.test(numericOnly)) {
      return '';
    }
    const parts = numericOnly.split('.').filter(Boolean);
    if (parts.length < 7) {
      return '';
    }
    const prefix = parts.slice(0, 6).join('.');
    if (prefix !== '1.3.6.1.4.1') {
      return '';
    }
    return parts.slice(0, 7).join('.');
  }, [mibSelectedDefinition?.fullOid, mibSelectedDefinition?.oid]);

  const pcomDeviceOptions = useMemo(() => {
    return pcomDevices
      .filter((device) => device.ip)
      .filter((device) => {
        if (!pcomEnterpriseBase) {
          return true;
        }
        const sysOid = String(device.sysOid || '').trim();
        if (!sysOid) {
          return false;
        }
        return sysOid === pcomEnterpriseBase || sysOid.startsWith(`${pcomEnterpriseBase}.`);
      })
      .map((device) => ({
        label: `${device.name} (${device.zoneName || 'Unknown zone'})`,
        value: device.ip,
      }));
  }, [pcomDevices, pcomEnterpriseBase]);

  const pcomDeviceOptionsWithManual = useMemo(() => {
    const manualOption =
      pcomAdvancedActive && pcomAdvancedTargetMode === 'manual' && pcomAdvancedManualIp
        ? {
            label: `Manual: ${pcomAdvancedManualIp}`,
            value: pcomAdvancedManualIp,
          }
        : null;
    return manualOption ? [manualOption, ...pcomDeviceOptions] : pcomDeviceOptions;
  }, [pcomAdvancedActive, pcomAdvancedManualIp, pcomAdvancedTargetMode, pcomDeviceOptions]);

  useEffect(() => {
    if (pcomAdvancedActive && pcomAdvancedTargetMode === 'manual') {
      return;
    }
    if (!pcomDeviceIp) {
      return;
    }
    if (!pcomEnterpriseBase) {
      return;
    }
    const matches = pcomDevices.some((device) => {
      if (!device.ip || device.ip !== pcomDeviceIp) {
        return false;
      }
      const sysOid = String(device.sysOid || '').trim();
      if (!sysOid) {
        return false;
      }
      return sysOid === pcomEnterpriseBase || sysOid.startsWith(`${pcomEnterpriseBase}.`);
    });
    if (!matches) {
      setPcomDeviceIp('');
    }
  }, [pcomDeviceIp, pcomEnterpriseBase, pcomDevices, pcomAdvancedActive, pcomAdvancedTargetMode]);

  useEffect(() => {
    if (selectedFile) {
      return;
    }
    setOverrideInfo(null);
    setOverrideError(null);
    setFileError(null);
    setSaveError(null);
    setSaveSuccess(null);
  }, [selectedFile]);

  const confirmDiscardIfDirty = (action: () => void) => {
    const dirtyMap = getPanelDirtyMap();
    if (Object.keys(dirtyMap).length > 0) {
      setPanelNavWarning({ open: true, fields: dirtyMap });
      return false;
    }
    if (hasStagedChanges) {
      setPendingNav(() => action);
      return false;
    }
    action();
    return true;
  };

  const handleRefreshOverviewCache = async (): Promise<boolean> => {
    setCacheActionMessage('Refreshing overview cache…');
    try {
      await loadOverview({ forceRebuild: true });
      setCacheActionMessage('Overview cache refresh triggered.');
      return true;
    } catch (err: unknown) {
      setCacheActionMessage(getApiErrorMessage(err, 'Failed to refresh overview cache'));
      return false;
    }
  };

  const handleRefreshSearchCache = async (): Promise<boolean> => {
    setCacheActionMessage('Refreshing search cache…');
    try {
      await rebuildSearchIndexAndTrack();
      setCacheActionMessage('Search cache rebuild started.');
      return true;
    } catch (err: unknown) {
      setCacheActionMessage(getApiErrorMessage(err, 'Failed to refresh search cache'));
      return false;
    }
  };

  const handleRefreshFolderCache = async (): Promise<boolean> => {
    setCacheActionMessage('Refreshing folder cache…');
    try {
      await rebuildFolderOverviewCacheAndTrack({
        selectedFolderPathId: selectedFolder?.PathID,
        onFolderOverviewReload: async () => {
          if (!selectedFolder?.PathID) {
            return;
          }
          try {
            const resp = await api.getFolderOverview(selectedFolder.PathID, 25);
            setFolderOverview(resp.data);
          } catch {
            // ignore folder reload errors
          }
        },
      });
      setCacheActionMessage('Folder overview cache refreshed.');
      return true;
    } catch (err: unknown) {
      setCacheActionMessage(getApiErrorMessage(err, 'Failed to refresh folder overview cache'));
      return false;
    }
  };

  const _handleRefreshAllCaches = async () => {
    setCacheActionMessage('Refreshing all caches…');
    const results = await Promise.allSettled([
      handleRefreshOverviewCache(),
      handleRefreshSearchCache(),
      handleRefreshFolderCache(),
    ]);
    const folderSkipped = results[2]?.status === 'fulfilled' && results[2].value === false;
    setCacheActionMessage(
      folderSkipped
        ? 'All cache refresh actions triggered (folder cache skipped — select a folder).'
        : 'All cache refresh actions triggered.',
    );
  };

  const handleResetNavigationInternal = async (appOverride?: AppTab) => {
    const targetApp = appOverride || activeApp;
    clearSearch();
    setSearchScope('all');
    sessionStorage.removeItem('com.search.scope');
    sessionStorage.removeItem('fcom.search.scope');
    matchStateByFileRef.current = {};
    scrollStateByFileRef.current = {};
    setSelectedFile(null);
    setSelectedFolder(null);
    setFileData(null);
    setFolderOverview(null);
    setBrowseNode(null);
    setBrowseData(null);
    setEntries([]);
    setBreadcrumbs([{ label: '/', node: null }]);
    setViewMode('friendly');
    setHighlightQuery(null);
    setHighlightPathId(null);
    setHighlightObjectKeys([]);
    setCurrentMatchIndex(0);
    setMatchObjectOptions([]);
    setSearchHighlightActive(false);
    await loadDefaultBrowseNode(targetApp);
  };

  const handleResetNavigation = () => {
    confirmDiscardIfDirty(() => {
      void handleResetNavigationInternal();
    });
  };

  const handleAppTabChange = (next: AppTab) => {
    if (next === activeApp) {
      return;
    }
    confirmDiscardIfDirty(() => {
      setActiveApp(next);
      if (next === 'fcom' || next === 'pcom') {
        void handleResetNavigationInternal(next);
      }
    });
  };

  const _handleRebuildIndex = async () => {
    setSearchError(null);
    setSearchLoading(true);
    try {
      await rebuildSearchIndexAndTrack();
      const query = searchQuery.trim();
      if (query) {
        await runSearch(query);
      }
    } catch (err: unknown) {
      setSearchError(getApiErrorMessage(err, 'Failed to rebuild index'));
    } finally {
      setSearchLoading(false);
    }
  };

  const formatTime = (value?: string | null) => {
    if (!value) {
      return '';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const getSearchResultName = (result: SearchResultItem): string => {
    const resultPathId =
      typeof result?.pathId === 'string'
        ? result.pathId
        : typeof result?.path === 'string'
          ? result.path
          : '';
    const fallbackName = resultPathId.split('/').pop() || resultPathId;
    if (typeof result?.name === 'string' && result.name) {
      return result.name;
    }
    if (fallbackName) {
      return fallbackName;
    }
    return '';
  };

  const loadNodeInternal = async (node: string | null, label?: string): Promise<boolean> => {
    setBrowseError(null);
    browseSnapshotRef.current = {
      browseData,
      browseNode,
      entries,
      breadcrumbs: breadcrumbsRef.current,
    };
    setBrowseLoading(true);
    setBrowseData(null);
    setEntries([]);
    try {
      const resp = await api.browsePath(browsePath, node ? { node } : undefined);
      setBrowseData(resp.data);
      setEntries(Array.isArray(resp.data?.data) ? resp.data.data : []);
      setBrowseNode(node);
      if (label !== undefined) {
        if (node === null) {
          setBreadcrumbs([{ label: '/', node: null }]);
        } else {
          setBreadcrumbs((prev) => [...prev, { label, node }]);
        }
      }
      return true;
    } catch (err: unknown) {
      setBrowseError(getApiErrorMessage(err, 'Failed to load files'));
      if (browseSnapshotRef.current) {
        setBrowseData(browseSnapshotRef.current.browseData);
        setEntries(browseSnapshotRef.current.entries);
        setBrowseNode(browseSnapshotRef.current.browseNode);
        setBreadcrumbs(browseSnapshotRef.current.breadcrumbs);
      }
      return false;
    } finally {
      setBrowseLoading(false);
    }
  };

  const loadNode = async (node: string | null, label?: string) => {
    if (!confirmDiscardIfDirty(() => loadNodeInternal(node, label))) {
      return;
    }
  };

  const loadDefaultBrowseNode = async (app: AppTab) => {
    const node = getDefaultBrowseNode(app);
    if (node) {
      setBreadcrumbs(buildBreadcrumbsFromPath(node));
      await loadNodeInternal(node);
      return;
    }
    setBreadcrumbs([{ label: '/', node: null }]);
    await loadNodeInternal(null, '/');
  };

  const isFolder = (entry: unknown) => {
    const normalizedEntry = isRecord(entry) ? (entry as BrowseEntry) : null;
    const icon = String(normalizedEntry?.icon || '').toLowerCase();
    const name = String(normalizedEntry?.PathName || '').toLowerCase();
    return (
      icon.includes('folder') ||
      icon.includes('sitemap') ||
      icon.includes('basket') ||
      (name.length > 0 && !name.endsWith('.json'))
    );
  };

  const handleCrumbClick = async (index: number) => {
    const crumb = breadcrumbs[index];
    confirmDiscardIfDirty(async () => {
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      await loadNodeInternal(crumb.node ?? null);
    });
  };

  const handleOpenFileInternal = async (entry: BrowseEntry) => {
    const pathId = typeof entry?.PathID === 'string' ? entry.PathID : '';
    if (!pathId) {
      setFileError('Invalid file selection');
      return;
    }
    const timingLabel = pathId ? `file-load:${pathId}` : 'file-load:unknown';
    const timingStart = nowMs();
    const logTiming = (step: string, start: number) => {
      const elapsed = Math.round(nowMs() - start);
      console.info(`[FCOM Timing] ${timingLabel} ${step} ${elapsed}ms`);
    };
    closeBuilder();
    setPanelEditState({});
    setPanelDrafts({});
    setPanelEvalModes({});
    setPanelOverrideRemovals({});
    setPanelAddedFields({});
    setPanelNavWarning({ open: false, fields: {} });
    setPendingCancel(null);
    setPendingNav(null);
    if (!highlightNextOpenRef.current) {
      setHighlightQuery(null);
      setHighlightPathId(null);
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      setSearchHighlightActive(false);
      setHighlightMatchSource(null);
    }
    setSelectedFolder(null);
    setFolderOverview(null);
    setSelectedFile(entry);
    if (pathId) {
      scrollStateByFileRef.current[pathId] = 0;
    }
    if (friendlyViewRef.current) {
      friendlyViewRef.current.scrollTop = 0;
    }
    if (friendlyMainRef.current) {
      friendlyMainRef.current.scrollTop = 0;
    }
    setFileError(null);
    setSaveError(null);
    setSaveSuccess(null);
    setOverrideError(null);
    setOverrideInfo(null);
    clearTimerList(fileLoadStageTimersRef);
    if (fileLoadStageHideTimeoutRef.current) {
      window.clearTimeout(fileLoadStageHideTimeoutRef.current);
      fileLoadStageHideTimeoutRef.current = null;
    }
    setFileLoadStageTarget('original');
    setFileLoading(true);
    if (pathId) {
      setBreadcrumbs(buildBreadcrumbsFromPath(pathId));
    }
    try {
      const readStart = nowMs();
      const retryMessage = 'Failed to parse rules file... retrying in 1 second';
      const readWithRetry = async () => {
        let attempt = 0;
        while (attempt < 3) {
          try {
            return await api.readFile(pathId);
          } catch (error) {
            attempt += 1;
            if (attempt >= 3) {
              throw error;
            }
            setFileError(retryMessage);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
        return await api.readFile(pathId);
      };
      const resp = await readWithRetry();
      logTiming('readFile', readStart);
      setFileData(resp.data);
      const inferredApp = inferAppFromPath(pathId);
      const shouldLoadOverrides = (inferredApp ?? activeApp) === 'fcom';
      if (shouldLoadOverrides) {
        setFileLoadStageTarget('overrides');
        setOverrideLoading(true);
        try {
          const overridesStart = nowMs();
          const overridesResp = await api.getOverrides(pathId);
          logTiming('getOverrides', overridesStart);
          setOverrideInfo(overridesResp.data);
        } catch (err: unknown) {
          setOverrideError(getApiErrorMessage(err, 'Failed to load overrides'));
          setOverrideInfo(null);
        } finally {
          setOverrideLoading(false);
        }
      } else {
        setOverrideInfo(null);
        setOverrideError(null);
      }
      setFileLoadStageTarget('compare');
      const parseStart = nowMs();
      const ruleText = resp.data?.content?.data?.[0]?.RuleText;
      if (typeof ruleText === 'string') {
        try {
          const parsed = JSON.parse(ruleText);
          const formatted = JSON.stringify(parsed, null, 2);
          setEditorText(formatted);
          setOriginalText(formatted);
        } catch {
          setEditorText(ruleText);
          setOriginalText(ruleText);
        }
      } else {
        const formatted = JSON.stringify(getPreviewContent(resp.data), null, 2);
        setEditorText(formatted);
        setOriginalText(formatted);
      }
      logTiming('parse+format', parseStart);
      setCommitMessage('');
      setViewMode('friendly');
      setFileLoadStageTarget('render');
    } catch (err: unknown) {
      setFileError(getApiErrorMessage(err, 'Failed to load file'));
      setFileLoadStageTarget(null);
    } finally {
      setFileLoading(false);
      logTiming('total', timingStart);
      highlightNextOpenRef.current = false;
      if (fileLoadStageHideTimeoutRef.current) {
        window.clearTimeout(fileLoadStageHideTimeoutRef.current);
        fileLoadStageHideTimeoutRef.current = null;
      }
    }
  };

  const handleOpenFile = async (entry: BrowseEntry) => {
    if (!confirmDiscardIfDirty(() => handleOpenFileInternal(entry))) {
      return;
    }
  };

  const handleOpenFolder = async (entry: BrowseEntry) => {
    if (!confirmDiscardIfDirty(() => handleOpenFolderInternal(entry))) {
      return;
    }
  };

  const handleOpenFolderInternal = async (entry: BrowseEntry) => {
    const pathId = typeof entry?.PathID === 'string' ? entry.PathID : '';
    if (!pathId) {
      setBrowseError('Invalid folder selection');
      return;
    }
    closeBuilder();
    setPanelEditState({});
    setPanelDrafts({});
    setPanelEvalModes({});
    setPanelOverrideRemovals({});
    setPanelAddedFields({});
    setPanelNavWarning({ open: false, fields: {} });
    setPendingCancel(null);
    setPendingNav(null);
    setHighlightQuery(null);
    setHighlightPathId(null);
    setHighlightObjectKeys([]);
    setCurrentMatchIndex(0);
    setSearchHighlightActive(false);
    setHighlightMatchSource(null);
    setSelectedFile(null);
    setFileData(null);
    setOverrideInfo(null);
    setOverrideError(null);
    setSelectedFolder(entry);
    setFolderOverview(null);
    setFolderLoading(true);
    try {
      setBreadcrumbs(buildBreadcrumbsFromPath(pathId));
      await loadNodeInternal(pathId);
      const resp = await api.getFolderOverview(pathId, 25);
      setFolderOverview(resp.data);
    } catch (err: unknown) {
      setBrowseError(getApiErrorMessage(err, 'Failed to load folder overview'));
    } finally {
      setFolderLoading(false);
    }
  };

  const openFileFromUrlInternal = async (fileId: string, nodeParam?: string | null) => {
    const resolvedFileId =
      (await resolveDeepLinkFileId({
        fileId,
        nodeParam,
        browsePath,
        readFile: api.readFile,
        browsePathFn: api.browsePath,
        isFileReadPayload,
        isFolder,
      })) || fileId;
    const fileName = resolvedFileId.split('/').pop() || resolvedFileId;
    const derivedParent = resolvedFileId.split('/').slice(0, -1).join('/');
    const parentNode = ensureCorePrefix(nodeParam) || derivedParent;
    try {
      const inferred = inferAppFromPath(resolvedFileId || parentNode);
      if (inferred && inferred !== activeApp) {
        setActiveApp(inferred);
      }
      await handleOpenFileInternal({ PathID: resolvedFileId, PathName: fileName });
      if (parentNode) {
        try {
          const resp = await api.browsePath(browsePath, { node: parentNode });
          setBrowseData(resp.data);
          setEntries(Array.isArray(resp.data?.data) ? resp.data.data : []);
          setBrowseNode(parentNode);
        } catch {
          // ignore browse failures
        }
      }
    } catch (err: unknown) {
      setBrowseError(getApiErrorMessage(err, 'Failed to restore file from URL'));
    }
  };

  const openFileFromUrl = async (fileId: string, nodeParam?: string | null) =>
    confirmDiscardIfDirty(() => {
      void openFileFromUrlInternal(fileId, nodeParam);
    });

  const handleOpenSearchResult = async (result: SearchResultItem) => {
    const pathId = result?.pathId || result?.path || '';
    if (!pathId) {
      return;
    }
    const query = searchQuery.trim();
    confirmDiscardIfDirty(() => {
      if (query) {
        setHighlightQuery(query);
        setHighlightPathId(pathId);
        const source =
          result?.source === 'both' ? 'both' : result?.source === 'name' ? 'name' : 'content';
        setHighlightMatchSource(source);
        setSearchHighlightActive(source === 'content' || source === 'both');
        highlightNextOpenRef.current = true;
      }
      void openFileFromUrlInternal(pathId);
    });
  };

  const splitCommandLine = (input: string) => {
    const tokens: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let escaping = false;

    for (let i = 0; i < input.length; i += 1) {
      const char = input[i];
      if (escaping) {
        current += char;
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (char === '"' && !inSingle) {
        inDouble = !inDouble;
        continue;
      }
      if (char === "'" && !inDouble) {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && !inDouble && /\s/.test(char)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }
      current += char;
    }
    if (current) {
      tokens.push(current);
    }
    return tokens;
  };

  const normalizeTrapType = (value: string) => {
    const raw = value.trim().toLowerCase();
    if (!raw) {
      return 's';
    }
    if (['s', 'i', 'u', 't', 'o'].includes(raw)) {
      return raw;
    }
    if (raw.startsWith('str')) {
      return 's';
    }
    if (raw.startsWith('int')) {
      return 'i';
    }
    if (raw.startsWith('tim')) {
      return 't';
    }
    if (raw.startsWith('oid')) {
      return 'o';
    }
    if (raw.startsWith('u')) {
      return 'u';
    }
    return 's';
  };

  const stripQuotes = (value: string) => value.replace(/^(['"])(.*)\1$/, '$2');

  const extractModuleFromOid = (value: string) => {
    const parts = value.split('::');
    return parts.length > 1 ? parts[0] : '';
  };

  const parseTrapTestCommand = (command: string) => {
    const tokens = splitCommandLine(command);
    const cleaned = tokens.filter((token) => token && token !== '$SNMPTRAPCMD');
    if (cleaned[0] === 'snmptrap') {
      cleaned.shift();
    }

    let version: string | undefined;
    let community: string | undefined;
    let mibModule: string | undefined;
    let host: string | undefined;
    let trapOid: string | undefined;
    const varbinds: Array<{ oid: string; type: string; value: string }> = [];

    let index = 0;
    while (index < cleaned.length) {
      const token = cleaned[index];
      if (token === '-v' && cleaned[index + 1]) {
        version = cleaned[index + 1];
        index += 2;
        continue;
      }
      if (token === '-c' && cleaned[index + 1]) {
        community = cleaned[index + 1];
        index += 2;
        continue;
      }
      if (token === '-m' && cleaned[index + 1]) {
        mibModule = cleaned[index + 1];
        index += 2;
        continue;
      }
      if (token === '-M' && cleaned[index + 1]) {
        index += 2;
        continue;
      }
      if (token.startsWith('-')) {
        index += 1;
        continue;
      }
      break;
    }

    const remaining = cleaned.slice(index);
    let cursor = 0;
    if (remaining.length >= 3 && remaining[1] === '0') {
      host = remaining[0];
      trapOid = remaining[2];
      cursor = 3;
    } else if (remaining[0] === '0' && remaining[1]) {
      trapOid = remaining[1];
      cursor = 2;
    } else if (remaining[0]) {
      trapOid = remaining[0];
      cursor = 1;
    }

    for (let i = cursor; i + 2 < remaining.length; i += 3) {
      const oid = remaining[i];
      const type = normalizeTrapType(remaining[i + 1]);
      const value = stripQuotes(remaining[i + 2]);
      if (oid) {
        varbinds.push({ oid, type, value });
      }
    }

    const inferredModule = trapOid ? extractModuleFromOid(trapOid) : '';
    if (!mibModule && inferredModule) {
      mibModule = inferredModule;
    }

    return {
      version,
      community,
      host,
      trapOid,
      mibModule,
      varbinds,
    };
  };

  const openTrapComposerFromTest = async (obj: unknown) => {
    const sourceObject = isRecord(obj) ? obj : null;
    const testCommand = sourceObject?.test;
    if (!testCommand || typeof testCommand !== 'string') {
      triggerToast('No test trap command found for this object.', false);
      return;
    }
    const parsed = parseTrapTestCommand(testCommand);
    if (!parsed.trapOid) {
      triggerToast('Test trap command did not include a trap OID.', false);
      return;
    }
    setTrapSource('fcom');
    setTrapError(null);
    setTrapObjectName(String(sourceObject?.['@objectName'] || sourceObject?.name || ''));
    setTrapHost('');
    setTrapPort(162);
    let nextHost = '';
    if (parsed.version) {
      setTrapVersion(parsed.version);
    }
    if (parsed.community) {
      setTrapCommunity(parsed.community);
    }
    if (parsed.host) {
      const [hostValue, portValue] = parsed.host.split(':');
      nextHost = hostValue || parsed.host;
      setTrapHost(nextHost);
      if (portValue && Number(portValue)) {
        setTrapPort(Number(portValue));
      }
    }
    setTrapOid(parsed.trapOid ? String(parsed.trapOid) : '');
    setTrapMibModule(parsed.mibModule || '');
    setTrapVarbinds(
      parsed.varbinds.length > 0 ? parsed.varbinds : [{ oid: '', type: 's', value: '' }],
    );
    setTrapManualOpen(false);
    setTrapModalOpen(true);
    await loadBrokerServers({ currentHost: nextHost, forceDefault: true });
  };

  const buildTrapTestItems = (objects: unknown[], sourceLabel: string) => {
    const items: TrapTestItem[] = [];
    let missing = 0;
    let invalid = 0;
    objects.forEach((obj) => {
      const sourceObject = isRecord(obj) ? obj : null;
      const testCommand = sourceObject?.test;
      if (!testCommand || typeof testCommand !== 'string') {
        missing += 1;
        return;
      }
      const parsed = parseTrapTestCommand(testCommand);
      if (!parsed.trapOid) {
        invalid += 1;
        return;
      }
      items.push({
        objectName: String(sourceObject?.['@objectName'] || sourceObject?.name || 'Object'),
        sourceLabel,
        parsed,
      });
    });
    console.info(
      `[TrapTest] ${sourceLabel}: objects=${objects.length}, tests=${items.length}, missing=${missing}, invalid=${invalid}`,
    );
    return { items, missing, invalid };
  };

  const openBulkTrapModal = async (
    items: TrapTestItem[],
    label: string,
  ) => {
    if (items.length === 0) {
      triggerToast('No valid test commands found in this selection.', false);
      return;
    }
    setTrapSource('fcom');
    setTrapError(null);
    setTrapManualOpen(false);
    setBulkTrapContext({
      label,
      total: items.length,
      items,
    });
    setBulkTrapProgress({
      current: 0,
      total: items.length,
      failed: 0,
      currentLabel: '',
    });
    setBulkTrapFailures([]);
    setBulkTrapSummary(null);
    setBulkTrapShowAllFailures(false);
    setTrapModalOpen(true);
    await loadBrokerServers({ currentHost: '', forceDefault: true });
  };

  const isFileTestLoading = (fileId?: string) =>
    fileId ? Boolean(fileTestLoading[fileId]) : false;

  const runFileTest = async (fileId: string, label?: string) => {
    if (!fileId || !ensureEditPermission()) {
      return;
    }
    if (isFileTestLoading(fileId)) {
      return;
    }
    setFileTestLoading((prev) => ({
      ...prev,
      [fileId]: true,
    }));
    try {
      const resp = await api.readFile(fileId);
      const objects = getFriendlyObjects(resp.data);
      const fileName = label || fileId.split('/').pop() || fileId;
      const vendor = getVendorFromPath(fileId);
      const sourceLabel = vendor ? `${vendor} / ${fileName}` : fileName;
      const { items } = buildTrapTestItems(objects, sourceLabel);
      await openBulkTrapModal(items, sourceLabel);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to load file for testing');
      triggerToast(message, false);
    } finally {
      setFileTestLoading((prev) => ({
        ...prev,
        [fileId]: false,
      }));
    }
  };

  const handleTestCurrentFile = async () => {
    if (!selectedFile?.PathID) {
      return;
    }
    const fileId = selectedFile.PathID;
    const fileName = selectedFile?.PathName || fileId.split('/').pop() || fileId;
    if (isFileTestLoading(fileId)) {
      return;
    }
    setFileTestLoading((prev) => ({
      ...prev,
      [fileId]: true,
    }));
    try {
      const objects = getFriendlyObjects(fileData);
      const vendor = getVendorFromPath(fileId);
      const sourceLabel = vendor ? `${vendor} / ${fileName}` : fileName;
      const { items } = buildTrapTestItems(objects, sourceLabel);
      await openBulkTrapModal(items, sourceLabel);
    } finally {
      setFileTestLoading((prev) => ({
        ...prev,
        [fileId]: false,
      }));
    }
  };

  const getFolderFileIds = () => {
    const listed = entries
      .filter((entry) => !isFolder(entry) && entry?.PathID)
      .map((entry) => entry.PathID)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    if (listed.length > 0) {
      return listed;
    }
    const folderOverviewData = isRecord(folderOverview) ? folderOverview : null;
    const fallbackRows = Array.isArray(folderOverviewData?.topFiles)
      ? folderOverviewData.topFiles
      : [];
    return fallbackRows
      .map((row) => {
        const item = isRecord(row) ? row : null;
        return typeof item?.pathId === 'string' ? item.pathId : '';
      })
      .filter((value): value is string => value.length > 0);
  };

  const handleTestVendorFiles = async () => {
    if (!ensureEditPermission()) {
      return;
    }
    if (vendorTestLoading) {
      return;
    }
    const fileIds = getFolderFileIds();
    if (fileIds.length === 0) {
      triggerToast('No files available to test in this folder.', false);
      return;
    }
    setVendorTestLoading(true);
    const folderLabel = selectedFolder?.PathName || selectedFolder?.PathID || 'this folder';
    const vendor = getVendorFromPath(selectedFolder?.PathID) || folderLabel;
    const sourceLabel = `${vendor} / all files`;
    const allItems: TrapTestItem[] = [];
    try {
      for (const fileId of fileIds) {
        const resp = await api.readFile(fileId);
        const objects = getFriendlyObjects(resp.data);
        const fileName = fileId.split('/').pop() || fileId;
        const fileVendor = getVendorFromPath(fileId) || vendor;
        const fileLabel = `${fileVendor} / ${fileName}`;
        const { items } = buildTrapTestItems(objects, fileLabel);
        allItems.push(...items);
      }
      await openBulkTrapModal(allItems, sourceLabel);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to load folder files for testing');
      triggerToast(message, false);
    } finally {
      setVendorTestLoading(false);
    }
  };

  const loadBrokerServers = async (options?: {
    currentHost?: string | null;
    forceDefault?: boolean;
  }) => {
    setTrapServerError(null);
    try {
      const resp = await api.getBrokerServers();
      type BrokerServer = Record<string, unknown>;
      const data: BrokerServer[] = Array.isArray(resp.data?.data)
        ? (resp.data.data as BrokerServer[])
        : [];
      setTrapServerList(data);
      const currentHost = options?.currentHost ?? trapHost;
      const allowDefault = options?.forceDefault ? !currentHost : !trapHost;
      if (allowDefault && data.length > 0) {
        const activeServerId = String(session?.server_id || serverId || '').trim();
        const getServerId = (entry: BrokerServer) =>
          String(
            entry?.ServerID ?? entry?.server_id ?? entry?.id ?? entry?.ID ?? entry?.ServerName ?? '',
          ).trim();
        const getServerHost = (entry: BrokerServer) =>
          String(
            entry?.ServerHostFQDN ??
              entry?.ServerName ??
              entry?.server_host_fqdn ??
              entry?.server_name ??
              entry?.hostname ??
              entry?.host ??
              '',
          ).trim();
        const matchedServer = activeServerId ? data.find((entry) => getServerId(entry) === activeServerId) : null;
        const fallbackServer = matchedServer || (data.length === 1 ? data[0] : null);
        const hostValue = fallbackServer ? getServerHost(fallbackServer) : '';
        if (hostValue) {
          setTrapHost(hostValue);
        }
      }
      if (data.length === 0) {
        setTrapManualOpen(true);
      }
    } catch (err: unknown) {
      setTrapServerError(getApiErrorMessage(err, 'Failed to load servers'));
      setTrapManualOpen(true);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!mibSelectedDefinition || !mibSelectedFile) {
        setMibTrapDefaults(null);
        return;
      }
      const baseName = getMibBaseName(mibSelectedFile);
      const definitionName = String(mibSelectedDefinition?.name || '').trim();
      if (!baseName || !definitionName) {
        setMibTrapDefaults(null);
        return;
      }
      const moduleName = String(mibSelectedDefinition?.module || '').trim() || baseName;
      const expectedNames = new Set(
        [
          `${moduleName}::${definitionName}`,
          `${baseName}::${definitionName}`,
          definitionName,
        ].map((value) => value.toLowerCase()),
      );
      try {
        const resp = await api.searchComs(`${baseName}-FCOM.json`, 'name', 10);
        const results = Array.isArray(resp.data?.results) ? resp.data.results : [];
        const candidates = results.filter((result: unknown) => {
          const candidate = isRecord(result) ? result : null;
          const name = String(candidate?.name || '').toLowerCase();
          return name === `${baseName.toLowerCase()}-fcom.json`;
        });
        for (const candidate of candidates) {
          if (!active) {
            return;
          }
          const row = isRecord(candidate) ? candidate : null;
          const fileId = row?.pathId || row?.pathID || row?.path;
          if (!fileId) {
            continue;
          }
          const fileResp = await api.readFile(String(fileId));
          const objects = getFriendlyObjects(fileResp.data);
          const match = objects.find((obj: unknown) => {
            const sourceObject = isRecord(obj) ? obj : null;
            const objName = String(sourceObject?.['@objectName'] || sourceObject?.name || '').toLowerCase();
            return expectedNames.has(objName);
          });
          const matchObject = isRecord(match) ? match : null;
          const testCommand = matchObject?.test;
          if (match && typeof testCommand === 'string') {
            const parsed = parseTrapTestCommand(testCommand);
            if (!parsed?.trapOid) {
              continue;
            }
            setMibTrapDefaults({
              objectName: String(matchObject?.['@objectName'] || matchObject?.name || definitionName),
              module: moduleName,
              sourceFile: String(fileId),
              testCommand,
              parsed,
            });
            return;
          }
        }
        if (active) {
          setMibTrapDefaults(null);
        }
      } catch {
        if (active) {
          setMibTrapDefaults(null);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [mibSelectedDefinition, mibSelectedFile, getMibBaseName]);

  const applyTrapDefaults = (defaults: NonNullable<typeof mibTrapDefaults>) => {
    const parsed = defaults.parsed;
    if (!parsed) {
      return '';
    }
    let nextHost = '';
    if (parsed.version) {
      setTrapVersion(parsed.version);
    }
    if (parsed.community) {
      setTrapCommunity(parsed.community);
    }
    if (parsed.host) {
      const [hostValue, portValue] = parsed.host.split(':');
      nextHost = hostValue || parsed.host;
      setTrapHost(nextHost);
      if (portValue && Number(portValue)) {
        setTrapPort(Number(portValue));
      }
    }
    if (parsed.trapOid) {
      setTrapOid(String(parsed.trapOid));
    }
    if (parsed.mibModule) {
      setTrapMibModule(parsed.mibModule);
    }
    if (parsed.varbinds && parsed.varbinds.length > 0) {
      setTrapVarbinds(parsed.varbinds);
    }
    setTrapObjectName(defaults.objectName || '');
    return nextHost;
  };

  const pcomActiveTarget = pcomAdvancedActive
    ? pcomAdvancedTargetMode === 'manual'
      ? pcomAdvancedManualIp.trim()
      : pcomAdvancedDeviceIp
    : pcomDeviceIp;
  const pcomActiveSnmpVersion = pcomAdvancedActive ? pcomAdvancedSnmpVersion : pcomSnmpVersion;
  const pcomActiveCommunity = pcomAdvancedActive ? pcomAdvancedCommunity : pcomSnmpCommunity;

  const normalizeSnmpVersion = (value: string) => {
    const trimmed = String(value || '').trim().toLowerCase();
    if (trimmed === '1' || trimmed === 'v1') {
      return '1';
    }
    if (trimmed === '2' || trimmed === '2c' || trimmed === 'v2' || trimmed === 'v2c') {
      return '2c';
    }
    if (trimmed === '3' || trimmed === 'v3') {
      return '3';
    }
    return '';
  };

  const formatSnmpVersionLabel = (value: string) => {
    if (value === '1') {
      return 'v1';
    }
    if (value === '2c') {
      return 'v2c';
    }
    if (value === '3') {
      return 'v3';
    }
    return value || '-';
  };

  const formatSnmpProfileTooltip = (profile: NonNullable<typeof pcomSnmpProfile>) => {
    const lines = [] as string[];
    if (profile.description) {
      lines.push(`Profile: ${profile.description}`);
    }
    lines.push(`Access ID: ${profile.accessId}`);
    lines.push(`Version: ${formatSnmpVersionLabel(profile.version)}`);
    if (profile.community) {
      lines.push(`Community: ${profile.community}`);
    }
    if (profile.username) {
      lines.push(`Username: ${profile.username}`);
    }
    if (profile.securityLevel) {
      lines.push(`Security level: ${profile.securityLevel}`);
    }
    if (profile.zoneName) {
      lines.push(`Zone: ${profile.zoneName}`);
    }
    return lines.join('\n');
  };

  useEffect(() => {
    if (pcomAdvancedActive) {
      return;
    }
    if (!pcomDeviceIp) {
      setPcomSnmpProfile(null);
      setPcomSnmpProfileError(null);
      setPcomSnmpProfileLoading(false);
      setPcomSnmpVersion('2c');
      setPcomSnmpCommunity('');
      return;
    }
    const device = pcomDevices.find((entry) => entry.ip === pcomDeviceIp);
    const accessId = String(device?.snmpAccessId || '').trim();
    if (!accessId || accessId === '0') {
      setPcomSnmpProfile(null);
      setPcomSnmpProfileError('No SNMP access profile assigned to this device.');
      setPcomSnmpProfileLoading(false);
      setPcomSnmpVersion('2c');
      setPcomSnmpCommunity('');
      return;
    }
    if (pcomSnmpProfile?.accessId === accessId) {
      return;
    }

    let isMounted = true;
    const loadProfile = async () => {
      setPcomSnmpProfileLoading(true);
      setPcomSnmpProfileError(null);
      try {
        const resp = await api.getSnmpAccessProfile(accessId);
        const entry = Array.isArray(resp.data?.data) ? resp.data.data[0] : null;
        if (!entry) {
          if (isMounted) {
            setPcomSnmpProfile(null);
            setPcomSnmpProfileError('SNMP access profile not found.');
          }
          return;
        }
        const version = normalizeSnmpVersion(entry.SNMPVersion);
        const community = String(entry.Community || '').trim();
        const nextProfile = {
          accessId,
          version,
          community,
          username: String(entry.Username || '').trim(),
          securityLevel: String(entry.SecurityLevel || '').trim(),
          description: String(entry.Description || '').trim(),
          zoneName: String(entry.DeviceZoneName || '').trim(),
        };
        if (isMounted) {
          setPcomSnmpProfile(nextProfile);
          if (version) {
            setPcomSnmpVersion(version);
          }
          setPcomSnmpCommunity(community);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setPcomSnmpProfile(null);
          setPcomSnmpProfileError(getApiErrorMessage(err, 'Failed to load SNMP access profile'));
        }
      } finally {
        if (isMounted) {
          setPcomSnmpProfileLoading(false);
        }
      }
    };

    void loadProfile();
    return () => {
      isMounted = false;
    };
  }, [pcomAdvancedActive, pcomDeviceIp, pcomDevices, pcomSnmpProfile?.accessId]);

  const openPcomAdvancedModal = () => {
    if (!pcomAdvancedActive) {
      setPcomAdvancedTargetMode('device');
      setPcomAdvancedDeviceIp(pcomDeviceIp);
      if (pcomSnmpVersion === '1' || pcomSnmpVersion === '2c' || pcomSnmpVersion === '3') {
        setPcomAdvancedSnmpVersion(pcomSnmpVersion);
      } else {
        setPcomAdvancedSnmpVersion('2c');
      }
      setPcomAdvancedCommunity(pcomSnmpCommunity);
    }
    setPcomAdvancedOpen(true);
  };

  const applyPcomAdvanced = () => {
    const targetIp =
      pcomAdvancedTargetMode === 'manual'
        ? pcomAdvancedManualIp.trim()
        : pcomAdvancedDeviceIp;
    setPcomDeviceIp(targetIp);
    setPcomAdvancedActive(true);
    setPcomAdvancedOpen(false);
  };

  const disablePcomAdvanced = () => {
    setPcomAdvancedActive(false);
    setPcomDeviceIp('');
  };

  const runPcomPoll = async () => {
    const oidValue = mibSelectedDefinition?.fullOid || mibSelectedDefinition?.oid;
    const baseOid = oidValue ? String(oidValue).trim() : '';
    const overrideOid = pcomAdvancedActive && pcomAdvancedOidEnabled
      ? String(pcomAdvancedOidValue || '').trim()
      : '';
    const trimmedOid = overrideOid || baseOid;
    const targetHost = pcomActiveTarget;
    if (!targetHost || !trimmedOid) {
      setPcomPollError('Select a target and OID to poll.');
      return;
    }
    setPcomPollError(null);
    setPcomPollOutput('');
    setPcomPollLoading(true);
    try {
      const resp = await api.snmpWalk({
        host: targetHost,
        version: pcomActiveSnmpVersion,
        community: pcomActiveCommunity,
        oid: trimmedOid,
        mibModule: mibSelectedDefinition?.module || undefined,
      });
      const stdout = String(resp.data?.stdout || '').trim();
      const stderr = String(resp.data?.stderr || '').trim();
      const combined = stdout && stderr ? `${stdout}\n\n${stderr}` : stdout || stderr;
      setPcomPollOutput(combined || 'No output received.');
    } catch (err: unknown) {
      setPcomPollError(getApiErrorMessage(err, 'Failed to run snmpwalk'));
    } finally {
      setPcomPollLoading(false);
    }
  };

  const openTrapComposer = async (definition: unknown, sourcePath?: string | null) => {
    const trapDefinition = isRecord(definition) ? definition : null;
    setTrapError(null);
    setTrapSource('mib');
    setTrapObjectName(String(trapDefinition?.name || ''));
    const resolvedOid = trapDefinition?.fullOid || trapDefinition?.oid;
    setTrapOid(resolvedOid ? String(resolvedOid) : '');
    setTrapVarbinds([{ oid: '', type: 's', value: '' }]);
    setTrapHost('');
    setTrapManualOpen(false);
    if (sourcePath) {
      const base = sourcePath.split('/').pop() || '';
      setTrapMibModule(base.replace(/\.(mib|txt)$/i, ''));
    } else {
      setTrapMibModule('');
    }
    const defaultHost = mibTrapDefaults ? applyTrapDefaults(mibTrapDefaults) : '';
    setTrapModalOpen(true);
    await loadBrokerServers({ currentHost: defaultHost, forceDefault: true });
  };

  const addRecentTarget = (hostValue: string) => {
    if (!hostValue) {
      return;
    }
    setRecentTargets((prev) => {
      const next = [hostValue, ...prev.filter((item) => item !== hostValue)];
      return next.slice(0, 8);
    });
  };

  const sendTrap = async () => {
    if (!trapHost || !trapOid) {
      setTrapError('Trap destination and OID are required.');
      return;
    }
    setTrapSending(true);
    setTrapError(null);
    try {
      await api.sendTrap({
        host: trapHost,
        port: trapPort,
        community: trapCommunity,
        version: trapVersion,
        trapOid,
        mibModule: trapMibModule || undefined,
        varbinds: trapVarbinds,
      });
      addRecentTarget(trapHost);
      if (trapSource === 'fcom') {
        const server = trapServerList.find(
          (item) => item?.ServerHostFQDN === trapHost || item?.ServerName === trapHost,
        );
        const destination = server?.ServerName || server?.ServerHostFQDN || trapHost;
        const label = trapObjectName || 'Object';
        triggerToast(`Test Trap: ${label} sent to ${destination}`, true);
      }
      setTrapModalOpen(false);
    } catch (err: unknown) {
      const message = getApiErrorMessage(err, 'Failed to send trap');
      setTrapError(message);
      if (trapSource === 'fcom') {
        const label = trapObjectName || 'Object';
        triggerToast(`Test Trap failed: ${label} (${message})`, false);
      }
    } finally {
      setTrapSending(false);
    }
  };

  const sendBulkTraps = async () => {
    if (!trapHost) {
      setTrapError('Trap destination is required.');
      return;
    }
    if (!bulkTrapContext) {
      return;
    }
    setTrapSending(true);
    setTrapError(null);
    let passed = 0;
    let failed = 0;
    const items = bulkTrapContext.items;
    setBulkTrapProgress((prev) => ({
      ...prev,
      current: 0,
      total: items.length,
      failed: 0,
      currentLabel: '',
    }));
    setBulkTrapFailures([]);
    setBulkTrapSummary(null);
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      setBulkTrapProgress((prev) => ({
        ...prev,
        current: index + 1,
        currentLabel: item.objectName,
      }));
      const payload = {
        host: trapHost,
        port: trapPort,
        community: item.parsed.community || trapCommunity,
        version: item.parsed.version || trapVersion,
        trapOid: item.parsed.trapOid || '',
        mibModule: item.parsed.mibModule || undefined,
        varbinds: item.parsed.varbinds,
      };
      if (!payload.trapOid) {
        failed += 1;
        setBulkTrapProgress((prev) => ({
          ...prev,
          failed: prev.failed + 1,
        }));
        continue;
      }
      try {
        await api.sendTrap(payload);
        passed += 1;
      } catch (err: unknown) {
        const message = getApiErrorMessage(err, 'Failed to send trap');
        console.warn('[TrapTest] send failed', {
          objectName: item.objectName,
          sourceLabel: item.sourceLabel,
          message,
        });
        failed += 1;
        setBulkTrapProgress((prev) => ({
          ...prev,
          failed: prev.failed + 1,
        }));
        setBulkTrapFailures((prev) => [
          ...prev,
          {
            objectName: item.objectName,
            message,
            item,
          },
        ]);
      }
      if (bulkTrapContext.items.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    addRecentTarget(trapHost);
    triggerToast(
      `Sent ${passed}/${bulkTrapContext.items.length} SNMP traps (${failed} failed).`,
      failed === 0,
    );
    setBulkTrapSummary({
      passed,
      failed,
      total: items.length,
    });
    setTrapSending(false);
  };

  const retryFailedTraps = async () => {
    if (!bulkTrapContext || bulkTrapFailures.length === 0) {
      return;
    }
    const retryItems = bulkTrapFailures.map((failure) => failure.item);
    setBulkTrapContext({
      ...bulkTrapContext,
      items: retryItems,
      total: retryItems.length,
    });
    setBulkTrapShowAllFailures(false);
    await sendBulkTraps();
  };

  const saveWithContent = async (content: unknown, message: string) => {
    if (!selectedFile) {
      return null;
    }
    if (!ensureEditPermission()) {
      return null;
    }
    setSaveError(null);
    setSaveSuccess(null);
    setSaveLoading(true);
    try {
      const fileDataRecord = isRecord(fileData) ? fileData : null;
      const etagValue = fileDataRecord?.['etag'];
      const etag = typeof etagValue === 'string' ? etagValue : '';
      const commit = message.trim();
      const resp = await api.saveFile(selectedFile.PathID, content, etag, commit);
      setSaveSuccess('Saved successfully');
      setRedeployReadyState(true);
      setRedeployPulse(true);
      triggerToast(`File saved: ${formatDisplayPath(selectedFile.PathID)}`);
      setOriginalText(editorText);
      const refreshed = await api.readFile(selectedFile.PathID);
      setFileData(refreshed.data);
      if (resp?.data?.revision || resp?.data?.last_modified) {
        setSelectedFile({
          ...selectedFile,
          LastRevision: resp.data.revision ?? selectedFile.LastRevision,
          ModificationTime: resp.data.last_modified ?? selectedFile.ModificationTime,
        });
      }
      setViewMode('friendly');
      setShowCommitModal(false);
      return resp;
    } catch (err: unknown) {
      setSaveError(getApiErrorMessage(err, 'Failed to save file'));
      return null;
    } finally {
      setSaveLoading(false);
    }
  };

  const _handleSaveFile = async (message: string) => {
    const content =
      editorText.trim().startsWith('{') || editorText.trim().startsWith('[')
        ? JSON.parse(editorText)
        : editorText;
    await saveWithContent(content, message);
  };

  const isTransientSocketError = (err: unknown) => {
    if (!isRecord(err)) {
      return false;
    }
    const message = String(
      err?.message || err?.error || err?.toString?.() || '',
    ).toLowerCase();
    const code = String(err?.code || '').toLowerCase();
    const name = String(err?.name || '').toLowerCase();
    const hasResponse = Boolean(err?.response);
    if (hasResponse) {
      return false;
    }
    if (name.includes('typeerror') && (message.includes('fetch') || message.includes('network'))) {
      return true;
    }
    if (code.includes('econnreset') || code.includes('econnaborted') || code.includes('etimedout')) {
      return true;
    }
    return message.includes('network error') || message.includes('socket');
  };

  const handleSaveOverrides = async (message: string) => {
    if (!selectedFile || !pendingOverrideSave) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    const applyOverrideSaveResults = (files: unknown[] | undefined) => {
      if (!Array.isArray(files) || files.length === 0) {
        setOverrideSaveStatus((prev) =>
          prev.map((entry) =>
            entry.status === 'failed' ? entry : { ...entry, status: 'done' },
          ),
        );
        return;
      }
      const fileMap = new Map(
        files
          .filter((entry): entry is UnknownRecord => isRecord(entry) && typeof entry.fileName === 'string')
          .map((entry) => [String(entry.fileName), String(entry.status || 'done')]),
      );
      setOverrideSaveStatus((prev) => {
        if (prev.length === 0) {
          return files
            .filter((entry): entry is UnknownRecord => isRecord(entry) && typeof entry.fileName === 'string')
            .map((entry) => ({
              objectName: String(entry.fileName),
              fileName: String(entry.fileName),
              status:
                entry.status === 'failed'
                  ? 'failed'
                  : entry.status === 'saving'
                    ? 'saving'
                    : entry.status === 'queued'
                      ? 'queued'
                      : 'done',
            }));
        }
        return prev.map((entry) => {
          const nextStatus = fileMap.get(entry.fileName);
          if (!nextStatus) {
            return entry;
          }
          return {
            ...entry,
            status:
              nextStatus === 'failed'
                ? 'failed'
                : nextStatus === 'saving'
                  ? 'saving'
                  : nextStatus === 'queued'
                    ? 'queued'
                    : 'done',
          };
        });
      });
    };
    const buildOverrideSaveStatus = () => {
      const staged = diffOverrides(getBaseOverrides(), pendingOverrideSave);
      let objectNames = staged.editedObjects;
      if (objectNames.length === 0) {
        objectNames = pendingOverrideSave
          .map((entry: unknown) => {
            const row = isRecord(entry) ? entry : null;
            return typeof row?.['@objectName'] === 'string' ? row['@objectName'] : '';
          })
          .filter((name): name is string => typeof name === 'string' && name.length > 0);
      }
      const unique = Array.from(new Set(objectNames));
      return unique.map((objectName) => {
        const overrideInfoData = isRecord(overrideInfo) ? overrideInfo : null;
        const byObject =
          overrideInfoData && isRecord(overrideInfoData.overrideFilesByObject)
            ? overrideInfoData.overrideFilesByObject
            : null;
        const objectEntry = byObject && isRecord(byObject[objectName]) ? byObject[objectName] : null;
        const fileName =
          (objectEntry && typeof objectEntry.fileName === 'string' ? objectEntry.fileName : '') ||
          `${objectName}.override.json`;
        return { objectName, fileName, status: 'queued' as const };
      });
    };
    const setAllOverrideStatus = (
      status: 'queued' | 'saving' | 'retrying' | 'done' | 'failed',
    ) => {
      setOverrideSaveStatus((prev) => prev.map((item) => ({ ...item, status })));
    };
    const applyProgressUpdate = (entry: unknown) => {
      const progressEntry = isRecord(entry) ? entry : null;
      const fileName = typeof progressEntry?.fileName === 'string' ? progressEntry.fileName : '';
      if (!fileName) {
        return;
      }
      const progressStatus = typeof progressEntry?.status === 'string' ? progressEntry.status : '';
      const normalizedStatus =
        progressStatus === 'failed'
          ? 'failed'
          : progressStatus === 'saving'
            ? 'saving'
            : progressStatus === 'retrying'
              ? 'retrying'
              : progressStatus === 'done'
                ? 'done'
                : 'queued';
      setOverrideSaveStatus((prev) => {
        const existingIndex = prev.findIndex((item) => item.fileName === fileName);
        if (existingIndex === -1) {
          return [
            ...prev,
            {
              objectName: fileName,
              fileName,
              status: normalizedStatus,
            },
          ];
        }
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          status: normalizedStatus,
        };
        return next;
      });
    };
    const streamOverrideSave = async () => {
      const response = await fetch('/api/v1/overrides/save-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          file_id: selectedFile.PathID,
          overrides: pendingOverrideSave,
          commit_message: message.trim(),
        }),
      });
      const contentType = response.headers.get('content-type') || '';
      const isEventStream = contentType.includes('text/event-stream');
      if (!response.ok && !isEventStream) {
        let errorPayload: unknown = null;
        try {
          errorPayload = await response.json();
        } catch {
          // ignore
        }
        throw errorPayload || new Error('Failed to save overrides');
      }
      if (!response.body) {
        throw new Error('Streaming response not available');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let completedPayload: unknown = null;
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        parts.forEach((chunk) => {
          const lines = chunk.split('\n');
          let eventName = 'message';
          let dataText = '';
          lines.forEach((line) => {
            if (line.startsWith('event:')) {
              eventName = line.replace('event:', '').trim();
            } else if (line.startsWith('data:')) {
              dataText += line.replace('data:', '').trim();
            }
          });
          if (!dataText) {
            return;
          }
          let payload: unknown = null;
          try {
            payload = JSON.parse(dataText);
          } catch {
            payload = dataText;
          }
          if (eventName === 'progress') {
            applyProgressUpdate(payload);
          } else if (eventName === 'complete') {
            completedPayload = payload;
          } else if (eventName === 'error') {
            throw payload;
          }
        });
      }
      return completedPayload;
    };
    const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
    const retryDelays = [2000, 5000];
    setSaveError(null);
    setSaveSuccess(null);
    setSaveLoading(true);
    setOverrideSaveStatus(buildOverrideSaveStatus());
    try {
      let respData: unknown = null;
      let attempt = 0;
      while (true) {
        try {
          respData = await streamOverrideSave();
          break;
        } catch (streamError: unknown) {
          if (isTransientSocketError(streamError) && attempt < retryDelays.length) {
            setSaveError(`Connection dropped. Retrying (${attempt + 1}/${retryDelays.length})…`);
            setAllOverrideStatus('retrying');
            await wait(retryDelays[attempt]);
            setAllOverrideStatus('saving');
            attempt += 1;
            continue;
          }
          if (isRecord(streamError) && (streamError?.error || streamError?.result)) {
            throw streamError;
          }
          const fallback = await api.saveOverrides(
            selectedFile.PathID,
            pendingOverrideSave,
            message.trim(),
          );
          respData = fallback.data;
          break;
        }
      }
      if (respData) {
        setOverrideInfo(respData);
        applyOverrideSaveResults(getResultFiles(respData));
      }
      try {
        const refreshed = await api.getOverrides(selectedFile.PathID);
        setOverrideInfo(refreshed.data);
      } catch {
        // Keep save response metadata if refresh fails.
      }
      setSaveSuccess(
        'Overrides saved. Literal changes are stored as patch operations. Restart FCOM Processor required.',
      );
      setRedeployReadyState(true);
      setRedeployPulse(true);
      triggerToast(
        `Overrides committed for ${formatDisplayPath(selectedFile.PathID)} (restart required)`,
      );
      setPanelEditState({});
      setPanelDrafts({});
      setPanelOverrideRemovals({});
      setPanelNavWarning({ open: false, fields: {} });
    } catch (err: unknown) {
      if (isTransientSocketError(err) && selectedFile?.PathID) {
        setSaveError('Save completed, but the connection dropped. Refreshing overrides…');
        try {
          const refreshed = await api.getOverrides(selectedFile.PathID);
          setOverrideInfo(refreshed.data);
          setSaveError(null);
          applyOverrideSaveResults(getResultFiles(err));
          triggerToast('Connection recovered. Overrides refreshed.', true);
        } catch (refreshError: unknown) {
          setSaveError(
            getApiErrorMessage(
              refreshError,
              'Connection dropped and override refresh failed. Please refresh the page.',
            ),
          );
          applyOverrideSaveResults(getResultFiles(err));
        }
      } else {
        setSaveError(getApiErrorMessage(err, 'Failed to save overrides'));
        const resultFiles = getResultFiles(err);
        if (resultFiles) {
          applyOverrideSaveResults(resultFiles);
        } else {
          setOverrideSaveStatus((prev) => prev.map((entry) => ({ ...entry, status: 'failed' })));
        }
      }
    } finally {
      setSaveLoading(false);
      setPendingOverrideSave(null);
    }
  };

  const handleRedeployFcomProcessor = async () => {
    if (redeployLoading) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    if (fcomServiceStatus && !fcomServiceStatus.installed) {
      setRedeployError('FCOM Processor is not installed. Deploy it before redeploying.');
      setRedeployModalOpen(true);
      return;
    }
    setRedeployLoading(true);
    setMicroserviceActionLabel('Redeploying FCOM Processor...');
    setRedeployError(null);
    try {
      await api.getMicroserviceHealth();
      await api.redeployMicroservice('fcom-processor');
      setMicroserviceActionLabel('Refreshing status...');
      await refreshMicroserviceStatus();
      setRedeployPulse(false);
      setRedeployReadyState(false);
      setRedeployModalOpen(false);
      triggerToast('FCOM Processor redeployed', true);
    } catch (err: unknown) {
      setRedeployError(getApiErrorMessage(err, 'Failed to redeploy FCOM Processor'));
    } finally {
      setRedeployLoading(false);
      setMicroserviceActionLabel(null);
    }
  };

  const handleDeployMicroservice = async (name: string, label: string) => {
    if (redeployLoading) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    setRedeployLoading(true);
    setMicroserviceActionLabel(`Deploying ${label}...`);
    setRedeployError(null);
    try {
      await api.deployMicroservice(name);
      setMicroserviceActionLabel('Refreshing status...');
      await refreshMicroserviceStatus();
      triggerToast(`${label} deployed`, true);
    } catch (err: unknown) {
      setRedeployError(getApiErrorMessage(err, `Failed to deploy ${label}`));
    } finally {
      setRedeployLoading(false);
      setMicroserviceActionLabel(null);
    }
  };

  const handleRedeployMicroservice = async (name: string, label: string) => {
    if (redeployLoading) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    setRedeployLoading(true);
    setMicroserviceActionLabel(`Redeploying ${label}...`);
    setRedeployError(null);
    try {
      await api.redeployMicroservice(name);
      setMicroserviceActionLabel('Refreshing status...');
      await refreshMicroserviceStatus();
      if (name === 'fcom-processor') {
        setRedeployPulse(false);
        setRedeployReadyState(false);
      }
      triggerToast(`${label} redeployed`, true);
    } catch (err: unknown) {
      setRedeployError(getApiErrorMessage(err, `Failed to redeploy ${label}`));
    } finally {
      setRedeployLoading(false);
      setMicroserviceActionLabel(null);
    }
  };

  const getPreviewContent = (data: unknown): unknown => {
    const dataRecord = isRecord(data) ? data : null;
    const content = dataRecord && isRecord(dataRecord.content) ? dataRecord.content : null;
    const contentData = content && Array.isArray(content.data) ? content.data : [];
    const firstRow = contentData[0];
    const firstRecord = isRecord(firstRow) ? firstRow : null;
    const ruleText = firstRecord?.RuleText;
    if (typeof ruleText === 'string') {
      try {
        return JSON.parse(ruleText);
      } catch {
        return ruleText;
      }
    }
    return firstRow ?? content ?? data ?? {};
  };

  const getFriendlyObjects = (data: unknown): UnknownRecord[] => {
    const content = getPreviewContent(data);
    if (isRecord(content) && Array.isArray(content.objects)) {
      return content.objects.filter((item): item is UnknownRecord => isRecord(item));
    }
    if (Array.isArray(content)) {
      return content.filter((item): item is UnknownRecord => isRecord(item));
    }
    if (isRecord(content)) {
      return [content];
    }
    return [];
  };

  const isTestableObject = (obj: unknown) => {
    const testCommand = isRecord(obj) ? obj.test : undefined;
    if (!testCommand || typeof testCommand !== 'string') {
      return false;
    }
    const parsed = parseTrapTestCommand(testCommand);
    return Boolean(parsed?.trapOid);
  };

  const getBaseOverrides = () =>
    (() => {
      const overrideInfoData = isRecord(overrideInfo) ? overrideInfo : null;
      const overrides = overrideInfoData?.overrides;
      return Array.isArray(overrides) ? overrides : [];
    })();

  const getWorkingOverrides = () => pendingOverrideSave || getBaseOverrides();

  const availableEventFields = useMemo(() => {
    const fields = new Set<string>();
    if (eventsSchemaFields.length > 0) {
      eventsSchemaFields.forEach((field) => fields.add(field));
    }
    getFriendlyObjects(fileData).forEach((obj) => {
      const event = isRecord(obj.event) ? obj.event : null;
      Object.keys(event || {}).forEach((field) => fields.add(field));
    });
    getWorkingOverrides().forEach((entry: unknown) => {
      const event = isRecord(entry) && isRecord(entry.event) ? entry.event : null;
      Object.keys(event || {}).forEach((field) => fields.add(field));
    });
    Object.values(panelAddedFields).forEach((list) => {
      (list || []).forEach((field) => fields.add(field));
    });
    return Array.from(fields).sort((a, b) => a.localeCompare(b));
  }, [eventsSchemaFields, fileData, overrideInfo, pendingOverrideSave, panelAddedFields]);

  const hasLocalOverrides = useMemo(() => {
    if (!selectedFile) {
      return false;
    }
    const overrides = getWorkingOverrides();
    if (!Array.isArray(overrides) || overrides.length === 0) {
      return false;
    }
    const objectNames = new Set(
      getFriendlyObjects(fileData)
        .map((obj) => (typeof obj['@objectName'] === 'string' ? obj['@objectName'] : null))
        .filter((name): name is string => Boolean(name)),
    );
    if (objectNames.size === 0) {
      return false;
    }
    return overrides.some((entry: unknown) => {
      const name = isRecord(entry) ? entry['@objectName'] : undefined;
      return typeof name === 'string' && objectNames.has(name);
    });
  }, [selectedFile, fileData, overrideInfo, pendingOverrideSave]);

  const getOverrideFileInfoForObject = (objectName?: string | null) => {
    if (!objectName) {
      return null;
    }
    const overrideInfoData = isRecord(overrideInfo) ? overrideInfo : null;
    const byObject =
      overrideInfoData && isRecord(overrideInfoData.overrideFilesByObject)
        ? overrideInfoData.overrideFilesByObject
        : null;
    return byObject?.[objectName] || null;
  };

  const getOverrideMetaForObject = (objectName?: string | null) => {
    if (!objectName) {
      return null;
    }
    const overrideInfoData = isRecord(overrideInfo) ? overrideInfo : null;
    const byObject =
      overrideInfoData && isRecord(overrideInfoData.overrideMetaByObject)
        ? overrideInfoData.overrideMetaByObject
        : null;
    return byObject?.[objectName] || null;
  };

  const getOverrideRuleLinkForObject = (objectName?: string | null) => {
    const fileInfo = getOverrideFileInfoForObject(objectName);
    const meta = getOverrideMetaForObject(objectName);
    const fileInfoRecord = isRecord(fileInfo) ? fileInfo : null;
    const metaRecord = isRecord(meta) ? meta : null;
    const fileName =
      (typeof metaRecord?.['pathName'] === 'string' ? metaRecord['pathName'] : '') ||
      (typeof fileInfoRecord?.['fileName'] === 'string' ? fileInfoRecord['fileName'] : '');
    const overrideInfoData = isRecord(overrideInfo) ? overrideInfo : null;
    const overrideRootRulePath =
      overrideInfoData && typeof overrideInfoData.overrideRootRulePath === 'string'
        ? overrideInfoData.overrideRootRulePath
        : '';
    if (!fileName || !overrideRootRulePath) {
      return null;
    }
    const rootPath = normalizeRulesPath(overrideRootRulePath);
    const filePath = `${rootPath}/${fileName}`.replace(/^\/+/, '');
    const nodePath = filePath.split('/').slice(0, -1).join('/');
    const params = new URLSearchParams(window.location.search);
    params.set('app', 'fcom');
    params.set('file', filePath);
    if (nodePath) {
      params.set('node', ensureCorePrefix(nodePath));
    } else {
      params.delete('node');
    }
    params.set('view', 'preview');
    const query = params.toString();
    return `${window.location.origin}${window.location.pathname}?${query}`;
  };

  const getOverrideVersionInfo = (objectName?: string | null) => {
    if (!objectName) {
      return { mode: 'none', label: '', detail: '' } as {
        mode: 'none' | 'v2' | 'v3' | 'mixed';
        label: string;
        detail: string;
      };
    }
    const entries = overrideIndex.get(objectName) || [];
    if (entries.length === 0) {
      return { mode: 'none', label: '', detail: '' } as const;
    }
    let hasV2 = false;
    let hasV3 = false;
    entries.forEach((entry) => {
      const processors = Array.isArray(entry?.processors) ? entry.processors : [];
      const hasPatch = processors.some((proc: unknown) => isRecord(proc) && proc.op && proc.path);
      if (entry?.version === 'v3' || hasPatch) {
        hasV3 = true;
        return;
      }
      if (entry?.version === 'v2' || processors.length > 0) {
        hasV2 = true;
      }
    });
    if (hasV2 && hasV3) {
      return {
        mode: 'mixed',
        label: 'Mixed (v2 + v3)',
        detail: 'Both processor and patch overrides are present.',
      } as const;
    }
    if (hasV3) {
      return { mode: 'v3', label: 'Patch (v3)', detail: 'JSON Patch override.' } as const;
    }
    if (hasV2) {
      return { mode: 'v2', label: 'Processor (v2)', detail: 'Legacy processor override.' } as const;
    }
    return { mode: 'none', label: '', detail: '' } as const;
  };

  const overrideIndex = useMemo(() => {
    const entries: unknown[] = getWorkingOverrides();
    const map = new Map<string, UnknownRecord[]>();
    entries.forEach((overrideEntry: unknown) => {
      if (!isRecord(overrideEntry)) {
        return;
      }
      const name = overrideEntry['@objectName'];
      if (typeof name !== 'string' || !name) {
        return;
      }
      const list = map.get(name) || [];
      list.push(overrideEntry);
      map.set(name, list);
    });
    return map;
  }, [overrideInfo, pendingOverrideSave]);

  const getOverrideMethod = () => {
    const overrideInfoData = isRecord(overrideInfo) ? overrideInfo : null;
    const method =
      overrideInfoData && typeof overrideInfoData.method === 'string' ? overrideInfoData.method : '';
    return method || (String(selectedFile?.PathID || '').includes('/syslog/') ? 'syslog' : 'trap');
  };

  const getOverrideEntries = (): UnknownRecord[] =>
    (getWorkingOverrides() as unknown[]).filter(
      (entry: unknown): entry is UnknownRecord => isRecord(entry),
    );

  const getOverrideEntry = (params: {
    objectName?: string;
    scope: 'pre' | 'post';
    method: string;
  }) =>
    getOverrideEntries().find(
      (entry) =>
        entry?.scope === params.scope &&
        entry?.method === params.method &&
        (params.objectName
          ? entry?.['@objectName'] === params.objectName
          : !entry?.['@objectName']),
    );

  const buildFlowNodesFromProcessors = (processors: unknown[]): FlowNode[] =>
    buildFlowNodesFromProcessorsShared(processors, {
      nextFlowId,
      nextSwitchCaseId,
    });

  const decodeJsonPointerSegment = (segment: string) =>
    segment.replace(/~1/g, '/').replace(/~0/g, '~');

  const _encodeJsonPointerSegment = (segment: string) =>
    segment.replace(/~/g, '~0').replace(/\//g, '~1');

  const getJsonPointerEventPath = (value?: string | null) => {
    if (!value || typeof value !== 'string') {
      return null;
    }
    const normalized = value.startsWith('#') ? value.slice(1) : value;
    if (!normalized.startsWith('/event')) {
      return null;
    }
    const remainder = normalized.slice('/event'.length);
    if (!remainder) {
      return '$.event';
    }
    const parts = remainder
      .split('/')
      .filter(Boolean)
      .map(decodeJsonPointerSegment);
    if (parts.length === 0) {
      return '$.event';
    }
    return `$.event.${parts.join('.')}`;
  };

  const getPatchTargetField = (processor: unknown) => {
    if (!isRecord(processor)) {
      return null;
    }
    if (!processor.op || !processor.path) {
      return null;
    }
    const valuePayload = isRecord(processor.value) ? processor.value : null;
    const setPayload = getSetPayload(valuePayload);
    const setTarget = setPayload?.targetField;
    if (typeof setTarget === 'string') {
      return setTarget;
    }
    return getJsonPointerEventPath(String(processor.path));
  };

  const buildEventPatchOp = (_objectName: string, field: string, value: unknown) => ({
    op: 'add',
    path: '/-',
    value: {
      set: {
        source: value,
        targetField: `$.event.${field}`,
      },
    },
  });

  const getProcessorTargetField = (processor: unknown) => {
    if (!isRecord(processor)) {
      return null;
    }
    if (processor?.op && processor?.path) {
      return null;
    }
    const keys = [
      'set',
      'copy',
      'replace',
      'convert',
      'eval',
      'json',
      'lookup',
      'append',
      'sort',
      'split',
      'math',
      'regex',
      'grok',
      'rename',
      'strcase',
      'substr',
      'trim',
    ];
    for (const key of keys) {
      const payload = isRecord(processor[key]) ? processor[key] : null;
      const target = payload?.targetField;
      if (typeof target === 'string' && target) {
        return target;
      }
    }
    return null;
  };

  const getProcessorType = (processor: unknown) =>
    isRecord(processor)
      ? processor.op
        ? 'patch'
        : Object.keys(processor || {})[0]
      : null;

  const getProcessorSummaryLines = (processor: unknown) => {
    const type = getProcessorType(processor);
    const processorRecord = isRecord(processor) ? processor : null;
    if (!type) {
      return [] as string[];
    }
    if (type === 'patch' && processorRecord) {
      const lines: string[] = [`Op: ${String(processorRecord.op ?? '')}`];
      if (processorRecord.path) {
        lines.push(`Path: ${String(processorRecord.path)}`);
      }
      if (processorRecord.value !== undefined) {
        lines.push(`Value: ${formatOverrideValue(processorRecord.value)}`);
      }
      return lines;
    }
    const payload = processorRecord && isRecord(processorRecord[type]) ? processorRecord[type] : {};
    const lines: string[] = [`Type: ${type}`];
    if (payload.source !== undefined) {
      lines.push(`Source: ${payload.source}`);
    }
    if (payload.pattern !== undefined) {
      lines.push(`Pattern: ${payload.pattern}`);
    }
    if (payload.targetField !== undefined) {
      lines.push(`Target: ${payload.targetField}`);
    }
    if (payload.operator !== undefined) {
      lines.push(`Operator: ${payload.operator}`);
    }
    if (payload.match !== undefined) {
      lines.push(`Match: ${payload.match}`);
    }
    if (payload.key !== undefined) {
      lines.push(`Key: ${payload.key}`);
    }
    if (payload.value !== undefined) {
      lines.push(`Value: ${payload.value}`);
    }
    if (type === 'if') {
      const thenCount = Array.isArray(payload.processors) ? payload.processors.length : 0;
      const elseCount = Array.isArray(payload.else) ? payload.else.length : 0;
      lines.push(`Then: ${thenCount} step(s)`);
      lines.push(`Else: ${elseCount} step(s)`);
    }
    if (type === 'switch') {
      const caseCount = Array.isArray(payload.case) ? payload.case.length : 0;
      const defaultCount = Array.isArray(payload.default) ? payload.default.length : 0;
      lines.push(`Cases: ${caseCount}`);
      lines.push(`Default: ${defaultCount} step(s)`);
    }
    if (type === 'foreach') {
      const procCount = Array.isArray(payload.processors) ? payload.processors.length : 0;
      lines.push(`Processors: ${procCount}`);
    }
    return lines;
  };

  const formatOverrideValue = (value: unknown) => {
    if (value === undefined) {
      return '—';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const getProcessorDisplayValue = (processor: unknown) => {
    if (isRecord(processor) && isRecord(processor.set)) {
      return formatOverrideValue(processor.set.source);
    }
    const summary = getProcessorSummaryLines(processor);
    if (summary.length > 0) {
      return summary.join(' | ');
    }
    return 'override';
  };

  const buildIfConditionLabel = (payload: unknown) => {
    if (!isRecord(payload)) {
      return 'condition';
    }
    const source = payload.source ?? 'value';
    const operator = payload.operator ?? '';
    const value = payload.value ?? '';
    return `${source} ${operator} ${value}`.trim();
  };

  const getOverrideTargetMap = (processors: unknown[]) => {
    const map = new Map<string, unknown>();
    const visit = (list: unknown[]) => {
      (list || []).forEach((processor: unknown) => {
        if (!isRecord(processor)) {
          return;
        }
        if (processor?.op && processor?.path) {
          return;
        }
        const ifPayload = isRecord(processor.if) ? processor.if : null;
        if (ifPayload) {
          const payload = ifPayload;
          const condition = buildIfConditionLabel(payload);
          const thenMap = getOverrideTargetMap(Array.isArray(payload.processors) ? payload.processors : []);
          const elseMap = getOverrideTargetMap(Array.isArray(payload.else) ? payload.else : []);
          const targets = new Set<string>([...thenMap.keys(), ...elseMap.keys()]);
          targets.forEach((target) => {
            const thenValue = thenMap.get(target) ?? 'no change';
            const elseValue = elseMap.get(target) ?? 'no change';
            map.set(
              target,
              `if (${condition}) then ${formatOverrideValue(thenValue)} else ${formatOverrideValue(elseValue)}`,
            );
          });
          return;
        }
        const target = getProcessorTargetField(processor);
        if (target) {
          if (isRecord(processor.set)) {
            map.set(target, processor.set.source);
          } else {
            map.set(target, getProcessorDisplayValue(processor));
          }
        }
      });
    };
    visit(processors);
    return map;
  };

  const getPatchOverrideMap = (processors: unknown[]) => {
    const map = new Map<string, unknown>();
    (processors || []).forEach((processor: unknown) => {
      if (!isRecord(processor)) {
        return;
      }
      if (!processor?.op || !processor?.path) {
        return;
      }
      if (!['add', 'replace', 'test'].includes(String(processor.op))) {
        return;
      }
      const target = getPatchTargetField(processor);
      if (!target) {
        return;
      }
      const valuePayload = isRecord(processor.value) ? processor.value : null;
      const setPayload = getSetPayload(valuePayload);
      const patchValue =
        setPayload && Object.prototype.hasOwnProperty.call(setPayload, 'source')
          ? setPayload.source
          : processor.value;
      map.set(target, patchValue);
    });
    return map;
  };

  const stringifyProcessor = (processor: unknown) => {
    try {
      return JSON.stringify(processor || {});
    } catch {
      return '';
    }
  };

  const diffOverrides = (baseOverrides: unknown[], stagedOverrides: unknown[]) => {
    const indexOverrides = (overrides: unknown[]) => {
      const map = new Map<
        string,
        { entry: Record<string, unknown>; objectName?: string; scope?: string; method?: string }
      >();
      overrides.forEach((entry) => {
        if (!isRecord(entry)) {
          return;
        }
        const objectName = entry?.['@objectName'];
        const scope = entry?.scope || 'post';
        const method = entry?.method || '';
        const key = `${method}:${scope}:${objectName || '__global__'}`;
        map.set(key, {
          entry,
          objectName: typeof objectName === 'string' ? objectName : undefined,
          scope: typeof scope === 'string' ? scope : undefined,
          method: typeof method === 'string' ? method : undefined,
        });
      });
      return map;
    };

    const splitProcessors = (processors: unknown[]) => {
      const targeted = new Map<string, unknown>();
      const untargeted = new Map<string, unknown>();
      processors.forEach((proc, index: number) => {
        const target = getProcessorTargetField(proc) || getPatchTargetField(proc);
        if (target) {
          if (!targeted.has(target)) {
            targeted.set(target, proc);
          }
          return;
        }
        const key = stringifyProcessor(proc) || `${getProcessorType(proc) || 'processor'}:${index}`;
        untargeted.set(key, proc);
      });
      return { targeted, untargeted };
    };

    const baseMap = indexOverrides(baseOverrides);
    const stagedMap = indexOverrides(stagedOverrides);
    const allKeys = new Set<string>([...baseMap.keys(), ...stagedMap.keys()]);
    const sections: Array<{
      title: string;
      objectName?: string;
      scope?: string;
      fieldChanges: Array<{
        target: string;
        action: 'added' | 'updated' | 'removed';
        before?: unknown;
        after?: unknown;
        origin: 'event' | 'processor';
      }>;
      processorChanges: Array<{ action: 'added' | 'removed'; processor: unknown }>;
    }> = [];

    allKeys.forEach((key) => {
      const baseEntry = baseMap.get(key);
      const stagedEntry = stagedMap.get(key);
      const objectName = stagedEntry?.objectName || baseEntry?.objectName;
      const scope = stagedEntry?.scope || baseEntry?.scope;
      const baseProcessors = Array.isArray(baseEntry?.entry?.processors)
        ? baseEntry?.entry?.processors
        : [];
      const stagedProcessors = Array.isArray(stagedEntry?.entry?.processors)
        ? stagedEntry?.entry?.processors
        : [];
      const baseEventOverrides = baseEntry?.entry ? getOverrideEventMap(baseEntry.entry) : {};
      const stagedEventOverrides = stagedEntry?.entry
        ? getOverrideEventMap(stagedEntry.entry)
        : {};
      const { targeted: baseTargeted, untargeted: baseUntargeted } =
        splitProcessors(baseProcessors);
      const { targeted: stagedTargeted, untargeted: stagedUntargeted } =
        splitProcessors(stagedProcessors);
      const baseTargetMap = getOverrideTargetMap(baseProcessors);
      const stagedTargetMap = getOverrideTargetMap(stagedProcessors);
      const targets = new Set<string>([
        ...baseTargetMap.keys(),
        ...stagedTargetMap.keys(),
        ...Object.keys(baseEventOverrides).map((field) => `$.event.${field}`),
        ...Object.keys(stagedEventOverrides).map((field) => `$.event.${field}`),
      ]);
      const fieldChanges: Array<{
        target: string;
        action: 'added' | 'updated' | 'removed';
        before?: unknown;
        after?: unknown;
        origin: 'event' | 'processor';
      }> = [];
      targets.forEach((target) => {
        const fieldName = target.replace('$.event.', '');
        const hasBaseEvent = Object.prototype.hasOwnProperty.call(baseEventOverrides, fieldName);
        const hasStagedEvent = Object.prototype.hasOwnProperty.call(
          stagedEventOverrides,
          fieldName,
        );
        const baseValue =
          objectName && target.startsWith('$.event.')
            ? getBaseObjectValue(objectName, target)
            : undefined;
        const before = Object.prototype.hasOwnProperty.call(baseEventOverrides, fieldName)
          ? baseEventOverrides[fieldName]
          : (baseTargeted.get(target) ?? baseTargetMap.get(target));
        const after = Object.prototype.hasOwnProperty.call(stagedEventOverrides, fieldName)
          ? stagedEventOverrides[fieldName]
          : (stagedTargeted.get(target) ?? stagedTargetMap.get(target));
        const origin: 'event' | 'processor' =
          hasBaseEvent || hasStagedEvent ? 'event' : 'processor';
        if (before !== undefined && after !== undefined) {
          if (stringifyProcessor(before) !== stringifyProcessor(after)) {
            fieldChanges.push({ target, action: 'updated', before, after, origin });
          }
          return;
        }
        if (before !== undefined) {
          fieldChanges.push({ target, action: 'removed', before, origin });
        } else if (after !== undefined) {
          const action: 'added' | 'updated' =
            origin === 'event' && baseValue !== undefined ? 'updated' : 'added';
          fieldChanges.push({ target, action, after, origin });
        }
      });

      const procKeys = new Set<string>([...baseUntargeted.keys(), ...stagedUntargeted.keys()]);
      const processorChanges: Array<{ action: 'added' | 'removed'; processor: unknown }> = [];
      procKeys.forEach((procKey) => {
        const before = baseUntargeted.get(procKey);
        const after = stagedUntargeted.get(procKey);
        if (before && !after) {
          processorChanges.push({ action: 'removed', processor: before });
        } else if (!before && after) {
          processorChanges.push({ action: 'added', processor: after });
        }
      });

      if (fieldChanges.length === 0 && processorChanges.length === 0) {
        return;
      }
      const title = objectName
        ? `${objectName} (Object ${scope || 'post'})`
        : `Global ${String(scope || 'post').toUpperCase()}`;
      sections.push({
        title,
        objectName,
        scope,
        fieldChanges,
        processorChanges,
      });
    });

    const totalChanges = sections.reduce(
      (count, section) => count + section.fieldChanges.length + section.processorChanges.length,
      0,
    );
    const editedObjects = sections
      .filter((section) => Boolean(section.objectName))
      .map((section) => section.objectName as string);

    return { sections, totalChanges, editedObjects };
  };

  const getBaseObjectByName = (objectName?: string): UnknownRecord | null => {
    if (!objectName) {
      return null;
    }
    return getFriendlyObjects(fileData).find(
      (item: unknown): item is UnknownRecord =>
        isRecord(item) && item['@objectName'] === objectName,
    ) || null;
  };

  const stringifyOverrideValue = (value: unknown) => {
    if (value === undefined) {
      return 'undefined';
    }
    if (value === null) {
      return 'null';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const areOverrideValuesEqual = (left: unknown, right: unknown) =>
    stringifyOverrideValue(left) === stringifyOverrideValue(right);

  const getOverrideEventMap = (entry: unknown) => {
    if (!isRecord(entry)) {
      return {} as Record<string, unknown>;
    }
    const objectName = typeof entry['@objectName'] === 'string' ? entry['@objectName'] : undefined;
    const baseObj = getBaseObjectByName(objectName as string | undefined);
    const baseEvent =
      baseObj && isRecord(baseObj.event) ? baseObj.event : {};
    const processors = Array.isArray(entry?.processors) ? entry.processors : [];
    const patchOverrides = getPatchOverrideMap(processors);
    const eventOverrides = isRecord(entry.event) ? entry.event : {};
    const mergedOverrides: Record<string, unknown> = { ...eventOverrides };
    patchOverrides.forEach((value, target) => {
      if (target.startsWith('$.event.')) {
        mergedOverrides[target.replace('$.event.', '')] = value;
      }
    });
    const diff: Record<string, unknown> = {};
    Object.keys(mergedOverrides).forEach((field) => {
      const overrideValue = mergedOverrides[field];
      const baseValue = baseEvent[field];
      if (!areOverrideValuesEqual(overrideValue, baseValue)) {
        diff[field] = overrideValue;
      }
    });
    return diff;
  };

  const getOverrideFlags = (obj: unknown) => {
    const objectNameRaw = isRecord(obj) ? obj['@objectName'] : undefined;
    const objectName = typeof objectNameRaw === 'string' ? objectNameRaw : '';
    if (!objectName) {
      return {
        event: false,
        trap: false,
        pre: false,
        any: false,
        advancedFlow: false,
      };
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry) =>
      Array.isArray(entry?.processors) ? entry.processors : [],
    );
    const targets = processors.map(getProcessorTargetField).filter(Boolean) as string[];
    const hasEventOverrides = overrides.some((entry) => {
      const diff = getOverrideEventMap(entry);
      return Object.keys(diff).length > 0;
    });
    const event = hasEventOverrides || targets.some((target) => target.startsWith('$.event.'));
    const trap = targets.some(
      (target) => target.startsWith('$.trap.') || target.includes('trap.variables'),
    );
    const pre = targets.some((target) => target.startsWith('$.preProcessors'));
    const hasProcessors = processors.length > 0;
    const hasUntargeted = processors.some((proc: unknown) => !getProcessorTargetField(proc));
    return {
      event,
      trap,
      pre,
      any: event || trap || pre || hasProcessors,
      advancedFlow: hasProcessors && (hasUntargeted || (!event && !trap && !pre)),
    };
  };

  const getOverrideTargets = (obj: unknown) => {
    const objectNameRaw = isRecord(obj) ? obj['@objectName'] : undefined;
    const objectName = typeof objectNameRaw === 'string' ? objectNameRaw : '';
    if (!objectName) {
      return new Set<string>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry) =>
      Array.isArray(entry?.processors) ? entry.processors : [],
    );
    const targetMap = getOverrideTargetMap(processors);
    const patchMap = getPatchOverrideMap(processors);
    patchMap.forEach((value, target) => targetMap.set(target, value));
    overrides.forEach((entry) => {
      const eventOverrides = getOverrideEventMap(entry);
      Object.keys(eventOverrides).forEach((field) => {
        targetMap.set(`$.event.${field}`, eventOverrides[field]);
      });
    });
    return new Set<string>(Array.from(targetMap.keys()));
  };

  const getProcessorTargets = (obj: unknown) => getDirectOverrideTargets(obj);

  const getProcessorFieldSummary = (obj: unknown, field: string) => {
    const objectNameRaw = isRecord(obj) ? obj['@objectName'] : undefined;
    const objectName = typeof objectNameRaw === 'string' ? objectNameRaw : '';
    if (!objectName) {
      return '';
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry) =>
      Array.isArray(entry?.processors) ? entry.processors : [],
    );
    const target = `$.event.${field}`;
    const processor = processors.find((proc: unknown) => getProcessorTargetField(proc) === target);
    if (!processor) {
      return '';
    }
    const summary = getProcessorSummaryLines(processor);
    if (summary.length > 0) {
      return summary.join(' • ');
    }
    return getProcessorDisplayValue(processor);
  };

  const getOverrideValueMap = (obj: unknown) => {
    const objectNameRaw = isRecord(obj) ? obj['@objectName'] : undefined;
    const objectName = typeof objectNameRaw === 'string' ? objectNameRaw : '';
    if (!objectName) {
      return new Map<string, unknown>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry) =>
      Array.isArray(entry?.processors) ? entry.processors : [],
    );
    const targetMap = getOverrideTargetMap(processors);
    const patchMap = getPatchOverrideMap(processors);
    patchMap.forEach((value, target) => targetMap.set(target, value));
    overrides.forEach((entry) => {
      const eventOverrides = getOverrideEventMap(entry);
      Object.keys(eventOverrides).forEach((field) => {
        targetMap.set(`$.event.${field}`, eventOverrides[field]);
      });
    });
    return targetMap;
  };

  const getBaseObjectValue = (objectName: string | undefined, target: string) => {
    if (!objectName || !target) {
      return undefined;
    }
    const obj = getBaseObjectByName(objectName);
    if (!obj) {
      return undefined;
    }
    const cleanedPath = target.replace(/^\$\./, '');
    return getNestedValue(obj, cleanedPath);
  };

  const getEffectiveEventValue = (obj: unknown, field: string) => {
    const objRecord = isRecord(obj) ? obj : null;
    if (field === trapOidField) {
      const trap = objRecord && isRecord(objRecord.trap) ? objRecord.trap : null;
      return trap?.oid;
    }
    const overrides = getOverrideValueMap(obj);
    const target = `$.event.${field}`;
    if (overrides.has(target)) {
      return overrides.get(target);
    }
    const event = objRecord && isRecord(objRecord.event) ? objRecord.event : null;
    return event?.[field];
  };

  const getPanelDirtyFields = (obj: unknown, panelKey: string) => {
    const draft = panelDrafts?.[panelKey]?.event;
    if (!draft) {
      return [] as string[];
    }
    const removals = new Set(panelOverrideRemovals[panelKey] || []);
    const dirty: string[] = [];
    getEventFieldList(obj, panelKey).forEach((field) => {
      if (removals.has(field)) {
        dirty.push(field);
        return;
      }
      const original = getEffectiveEventValue(obj, field);
      const { display } = getEditableValue(original);
      if (String(draft[field] ?? '') !== String(display ?? '')) {
        dirty.push(field);
      }
    });
    return dirty;
  };

  const getEventOverrideFields = (obj: unknown) => {
    const overrideValueMap = getOverrideValueMap(obj);
    const fields: string[] = [];
    overrideValueMap.forEach((_value, target) => {
      if (target.startsWith('$.event.')) {
        fields.push(target.replace('$.event.', ''));
      }
    });
    return fields;
  };

  const getDirectOverrideTargets = (obj: unknown) => {
    const objectNameRaw = isRecord(obj) ? obj['@objectName'] : undefined;
    const objectName = typeof objectNameRaw === 'string' ? objectNameRaw : '';
    if (!objectName) {
      return new Set<string>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const targets = new Set<string>();
    overrides.forEach((entry) => {
      const processors = Array.isArray(entry?.processors) ? entry.processors : [];
      processors.forEach((proc: unknown) => {
        const target = getProcessorTargetField(proc);
        if (target) {
          targets.add(target);
        }
      });
    });
    return targets;
  };

  const getPanelDirtyMap = () => {
    const map: Record<string, string[]> = {};
    const objects: unknown[] = getFriendlyObjects(fileData);
    objects.forEach((obj: unknown, idx: number) => {
      const baseKey = getObjectKey(obj, idx);
      const panelKey = `${baseKey}:event`;
      if (!panelEditState[panelKey]) {
        return;
      }
      const dirty = getPanelDirtyFields(obj, panelKey);
      const objRecord = isRecord(obj) ? obj : null;
      const objectName =
        objRecord && typeof objRecord['@objectName'] === 'string'
          ? objRecord['@objectName']
          : undefined;
      const hasPendingConversion = Boolean(
        getPendingOverrideConversion(objectName),
      );
      if (dirty.length > 0 || hasPendingConversion) {
        const nextDirty = dirty.length > 0 ? [...dirty] : [];
        if (hasPendingConversion) {
          nextDirty.push('conversion');
        }
        map[panelKey] = nextDirty;
      }
    });
    return map;
  };

  const isFieldHighlighted = (panelKey: string, field: string) =>
    panelNavWarning.fields?.[panelKey]?.includes(field);

  const isEvalMode = (panelKey: string, field: string) =>
    panelEvalModes?.[panelKey]?.[field] ?? false;

  const isEvalValue = (value: unknown) => isRecord(value) && typeof value.eval === 'string';

  const shouldShowEvalToggle = (panelKey: string, field: string, obj: unknown) =>
    isEvalMode(panelKey, field) || isEvalValue(getEffectiveEventValue(obj, field));

  const positionOverrideTooltip = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement) || typeof window === 'undefined') {
      return;
    }
    const rect = target.getBoundingClientRect();
    const padding = 12;
    const maxWidth = 360;
    const maxLeft = Math.max(padding, window.innerWidth - maxWidth - padding);
    const left = Math.min(Math.max(rect.left, padding), maxLeft);
    const preferAbove = target.classList.contains('eval-label-hover');
    const top = preferAbove ? rect.top - 8 : rect.bottom + 8;
    target.style.setProperty('--override-tooltip-left', `${left}px`);
    target.style.setProperty('--override-tooltip-top', `${top}px`);
    target.style.setProperty('--override-tooltip-shift', preferAbove ? '-100%' : '0');
  };

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (activeOverrideTooltipRef.current) {
        positionOverrideTooltip(activeOverrideTooltipRef.current);
      }
    };
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, []);

  const renderFieldBadges = (
    panelKey: string,
    field: string,
    obj: unknown,
    overrideTargets: Set<string>,
  ) => {
    const evalFlag = shouldShowEvalToggle(panelKey, field, obj);
    const hasOverride = overrideTargets.has(`$.event.${field}`);
    const processorTargets = hasOverride ? getDirectOverrideTargets(obj) : new Set<string>();
    const processorFlag = hasOverride && processorTargets.has(`$.event.${field}`);
    if (!evalFlag && !processorFlag) {
      return null;
    }
    const objectName = getObjectNameValue(obj);
    const processors = objectName
      ? (overrideIndex.get(objectName) || []).flatMap((entry: unknown) => {
          const overrideEntry = isRecord(entry) ? entry : null;
          return Array.isArray(overrideEntry?.processors) ? overrideEntry.processors : [];
        },
        )
      : [];
    const processor = processors.find(
      (proc: unknown) => getProcessorTargetField(proc) === `$.event.${field}`,
    );
    const processorSummary = processor ? getProcessorSummaryLines(processor) : [];
    const overrideHoverProps = {
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
        activeOverrideTooltipRef.current = event.currentTarget;
        positionOverrideTooltip(event.currentTarget);
        setSuppressVarTooltip(true);
        setSuppressEvalTooltip(true);
      },
      onMouseMove: (event: React.MouseEvent<HTMLElement>) => {
        positionOverrideTooltip(event.currentTarget);
      },
      onMouseLeave: () => {
        activeOverrideTooltipRef.current = null;
        setSuppressVarTooltip(false);
        setSuppressEvalTooltip(false);
      },
      onFocus: (event: React.FocusEvent<HTMLElement>) => {
        activeOverrideTooltipRef.current = event.currentTarget;
        positionOverrideTooltip(event.currentTarget);
        setSuppressVarTooltip(true);
        setSuppressEvalTooltip(true);
      },
      onBlur: () => {
        activeOverrideTooltipRef.current = null;
        setSuppressVarTooltip(false);
        setSuppressEvalTooltip(false);
      },
    };
    return (
      <span className="field-badges">
        {evalFlag && <span className="pill status-pill status-pill-eval">Eval</span>}
        {processorFlag && (
          <span className="override-summary" tabIndex={0} {...overrideHoverProps}>
            <span className="pill status-pill status-pill-processor">Processor</span>
            {processorSummary.length > 0 && (
              <div className="override-summary-card" role="tooltip">
                <div className="override-summary-title">Processor Summary</div>
                <ul className="override-summary-list">
                  {processorSummary.map((line, idx) => (
                    <li key={`${line}-${idx}`} className="override-summary-item">
                      <span className="override-summary-value">{line}</span>
                    </li>
                  ))}
                </ul>
                {objectName && hasEditPermission && (
                  <button
                    type="button"
                    className="builder-link"
                    onClick={() => openAdvancedFlowModal('object', objectName, `$.event.${field}`)}
                  >
                    View in Advanced Flow
                  </button>
                )}
              </div>
            )}
          </span>
        )}
      </span>
    );
  };

  const overrideTooltipHoverProps = {
    onMouseEnter: (event: React.MouseEvent<HTMLElement>) => {
      activeOverrideTooltipRef.current = event.currentTarget;
      positionOverrideTooltip(event.currentTarget);
      setSuppressVarTooltip(true);
      setSuppressEvalTooltip(true);
    },
    onMouseMove: (event: React.MouseEvent<HTMLElement>) => {
      positionOverrideTooltip(event.currentTarget);
    },
    onMouseLeave: () => {
      activeOverrideTooltipRef.current = null;
      setSuppressVarTooltip(false);
      setSuppressEvalTooltip(false);
    },
    onFocus: (event: React.FocusEvent<HTMLElement>) => {
      activeOverrideTooltipRef.current = event.currentTarget;
      positionOverrideTooltip(event.currentTarget);
      setSuppressVarTooltip(true);
      setSuppressEvalTooltip(true);
    },
    onBlur: () => {
      activeOverrideTooltipRef.current = null;
      setSuppressVarTooltip(false);
      setSuppressEvalTooltip(false);
    },
  };

  const renderOverrideSummaryCard = (
    obj: unknown,
    overrideValueMap: Map<string, unknown>,
    fields: string[],
    title: string,
  ) => {
    const rows = fields
      .map((field) => {
        const target = field.startsWith('$.') ? field : `$.event.${field}`;
        if (!overrideValueMap.has(target)) {
          return null;
        }
        return { field, value: overrideValueMap.get(target) };
      })
      .filter(Boolean) as Array<{ field: string; value: unknown }>;

    if (rows.length === 0) {
      return null;
    }

    const overrideVersion = getOverrideVersionInfo(getObjectNameValue(obj));

    return (
      <div className="override-summary-card" role="tooltip">
        <div className="override-summary-title">{title}</div>
        {overrideVersion.mode !== 'none' && (
          <div className="override-summary-note">
            {overrideVersion.label}
            {overrideVersion.detail ? ` • ${overrideVersion.detail}` : ''}
          </div>
        )}
        <ul className="override-summary-list">
          {rows.map((row) => {
            const target = row.field.startsWith('$.') ? row.field : `$.event.${row.field}`;
            const objectName = getObjectNameValue(obj);
            const baseValue = getBaseObjectValue(objectName ?? undefined, target);
            const originalDisplay =
              baseValue === undefined
                ? 'New'
                : renderValue(baseValue, getTrapVariables(obj), { suppressEvalTooltip: true });
            return (
              <li key={`${row.field}-${String(row.value)}`} className="override-summary-item">
                <span className="override-summary-field">{row.field}</span>
                <span className="override-summary-value">
                  <span className="override-summary-label">Original is:</span> {originalDisplay}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const reservedEventFields = new Set<string>();
  const trapOidField = 'OID';
  const baseEventFieldOrder = [
    'Node',
    'Summary',
    'Severity',
    'EventType',
    'EventCategory',
    'ExpireTime',
    'Method',
    'SubMethod',
    'SubNode',
  ];
  const eventFieldDescriptions: Record<string, string> = {
    EventID: 'Database-managed ID; do not set or change this value.',
    EventKey: 'Rules-set de-duplication key used to match events in the live table.',
    EventCategory: '1=Resolution, 2=Problem, 3=Discrete; used by correlation logic.',
    EventType: 'Event type string used for correlation (e.g., linkUpDown).',
    Ack: 'Acknowledged flag (1=yes, 0=no).',
    Action: 'Non-human process that made a change (mechanizations/tools).',
    Actor: 'Entity or user that caused the change.',
    Count: 'De-dup count; incremented for duplicate events only.',
    Customer: 'Customer identifier.',
    Department: 'Department label; defaulted if missing.',
    Details: 'JSON text for extra details (replaces Custom1–5).',
    DeviceType: 'General device category; defaulted if missing.',
    Duration: 'Time between FirstReported and LastChanged.',
    EscalationFlag: 'Escalation state: 0=no, 1=pending, 2=escalated.',
    ExpireTime: 'Seconds after LastChanged before eligible for delete.',
    FirstReported: 'Epoch ms when the event first occurred.',
    IPAddress: 'Device IP address; defaults to 0.0.0.0 if missing.',
    LastChanged: 'Epoch ms when the event was last updated.',
    LastReported: 'Epoch ms when the event last occurred.',
    Location: 'Location name/address used by analytics.',
    Method: 'Protocol/source that received the event (e.g., Trapd, Syslogd).',
    Node: 'Device name (often DNS), derived from IP lookup.',
    OrigSeverity: 'Original severity at creation.',
    OwnerName: 'Current owner/assignee username.',
    OID: 'Trap OID derived from the trap definition.',
    RootCauseFlag: 'Flag indicating the event is a root cause.',
    RootCauseID: 'EventID of the root cause event.',
    Score: 'Ranking score (often Severity × Priority).',
    Service: 'SLM service name when a violation is detected.',
    ServiceImpact: 'Service impact indicator/level.',
    Severity: 'Severity 0–5 for display and routing.',
    SubDeviceType: 'Vendor/model information; defaulted if missing.',
    SubMethod: 'Specific processing label (e.g., MIB name).',
    SubNode: 'Event instance (e.g., ifIndex) used for correlation.',
    Summary: 'Free-form summary shown in the event list.',
    TicketFlag: 'Ticket state: 0=none, 1=create, 2=processing, 3=opened.',
    TicketID: 'External ticket ID.',
    ZoneID: 'Device zone identifier.',
  };

  const fileMethodInfo = useMemo(() => {
    const objects = getFriendlyObjects(fileData);
    if (objects.length === 0) {
      return {
        method: null as string | null,
        subMethod: null as string | null,
        methodUniform: false,
        subMethodUniform: false,
      };
    }
    const methodValues = new Set<string>();
    const subMethodValues = new Set<string>();
    objects.forEach((obj: unknown) => {
      const objRecord = isRecord(obj) ? obj : null;
      const eventRecord = objRecord && isRecord(objRecord.event) ? objRecord.event : null;
      const method = objRecord?.method ?? eventRecord?.Method;
      const subMethod = eventRecord?.SubMethod ?? objRecord?.subMethod;
      if (method) {
        methodValues.add(String(method));
      }
      if (subMethod) {
        subMethodValues.add(String(subMethod));
      }
    });
    return {
      method: methodValues.size === 1 ? Array.from(methodValues)[0] : null,
      subMethod: subMethodValues.size === 1 ? Array.from(subMethodValues)[0] : null,
      methodUniform: methodValues.size === 1,
      subMethodUniform: subMethodValues.size === 1,
    };
  }, [fileData]);

  const isTrapMethod = (value?: string | null) =>
    typeof value === 'string' && value.toLowerCase().includes('trap');

  const isTrapFileContext = useMemo(() => {
    if (isTrapMethod(fileMethodInfo.method)) {
      return true;
    }
    if (selectedFile?.PathID && String(selectedFile.PathID).toLowerCase().includes('/trap/')) {
      return true;
    }
    const objects = getFriendlyObjects(fileData);
    const methods = objects
      .map((obj) => {
        const eventRecord = isRecord(obj.event) ? obj.event : null;
        return obj.method ?? eventRecord?.Method;
      })
      .filter(Boolean)
      .map((value) => String(value));
    if (methods.length === 0) {
      return false;
    }
    return methods.every((value: string) => isTrapMethod(value));
  }, [fileMethodInfo.method, selectedFile?.PathID, fileData]);

  const isTrapFolderContext = useMemo(() => {
    const pathId = selectedFolder?.PathID || '';
    return String(pathId).toLowerCase().includes('/trap/');
  }, [selectedFolder?.PathID]);

  const getExistingEventFields = (obj: unknown, panelKey: string) => {
    const fields = new Set<string>();
    const objRecord = isRecord(obj) ? obj : null;
    const eventRecord = objRecord && isRecord(objRecord.event) ? objRecord.event : null;
    Object.keys(eventRecord || {}).forEach((field) => fields.add(field));
    getEventOverrideFields(obj).forEach((field) => fields.add(field));
    (panelAddedFields[panelKey] || []).forEach((field) => fields.add(field));
    getStagedDirtyFields(obj).forEach((field) => fields.add(field));
    return fields;
  };

  const getBaseEventFields = (obj: unknown, panelKey: string) => {
    const existing = getExistingEventFields(obj, panelKey);
    const headerFields = new Set<string>();
    if (fileMethodInfo.methodUniform && fileMethodInfo.method) {
      headerFields.add('Method');
    }
    if (fileMethodInfo.subMethodUniform && fileMethodInfo.subMethod) {
      headerFields.add('SubMethod');
    }
    return baseEventFieldOrder.filter((field) => existing.has(field) && !headerFields.has(field));
  };

  const getAdditionalEventFields = (obj: unknown, panelKey: string) => {
    const existing = Array.from(getExistingEventFields(obj, panelKey));
    const baseFields = new Set(getBaseEventFields(obj, panelKey));
    const additional = existing.filter(
      (field) => !baseFields.has(field) && !reservedEventFields.has(field),
    );
    const objRecord = isRecord(obj) ? obj : null;
    const trapRecord = objRecord && isRecord(objRecord.trap) ? objRecord.trap : null;
    if (isTrapFileContext && trapRecord?.oid && !additional.includes(trapOidField)) {
      additional.push(trapOidField);
    }
    return additional;
  };

  const getEventFieldList = (obj: any, panelKey: string) =>
    [...getBaseEventFields(obj, panelKey), ...getAdditionalEventFields(obj, panelKey)].filter(
      (field) => field !== trapOidField,
    );

  const formatEventFieldLabel = (field: string) => field.replace(/([a-z])([A-Z])/g, '$1 $2');
  const getEventFieldDescription = (field: string) => eventFieldDescriptions[field] || '';

  const openAddFieldModal = (panelKey: string, obj: any) => {
    if (!hasEditPermission) {
      return;
    }
    setAddFieldContext({ panelKey, obj });
    setShowAddFieldModal(true);
    setAddFieldSearch('');
  };

  const addFieldToPanel = (field: string) => {
    if (!addFieldContext) {
      return;
    }
    const { panelKey } = addFieldContext;
    setPanelAddedFields((prev) => {
      const existing = new Set(prev[panelKey] || []);
      existing.add(field);
      return { ...prev, [panelKey]: Array.from(existing) };
    });
    setPanelDrafts((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        event: {
          ...prev[panelKey]?.event,
          [field]: '',
        },
      },
    }));
    setPanelEvalModes((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        [field]: false,
      },
    }));
    setShowAddFieldModal(false);
  };

  const isFieldDirty = (obj: unknown, panelKey: string, field: string) => {
    const removals = new Set(panelOverrideRemovals[panelKey] || []);
    if (removals.has(field)) {
      return true;
    }
    const draftValue = panelDrafts?.[panelKey]?.event?.[field];
    const original = getEffectiveEventValue(obj, field);
    const { display } = getEditableValue(original);
    return String(draftValue ?? '') !== String(display ?? '');
  };

  const isFieldPendingRemoval = (panelKey: string, field: string) =>
    (panelOverrideRemovals[panelKey] || []).includes(field);

  const isFieldNew = (obj: unknown, field: string) =>
    getBaseObjectValue(getObjectNameValue(obj) || undefined, `$.event.${field}`) === undefined;

  const getEditableValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return { editable: true, display: '', isEval: false };
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return { editable: true, display: String(value), isEval: false };
    }
    if (isRecord(value) && typeof value.eval === 'string') {
      return { editable: true, display: value.eval, isEval: true };
    }
    return { editable: true, display: JSON.stringify(value), isEval: false };
  };

  const cloneOverrideEntry = <T,>(entry: T): T => JSON.parse(JSON.stringify(entry));

  const getObjectOverrideEntries = (overrides: unknown[], objectName: string, method: string) =>
    overrides.filter(
      (entry) =>
        isRecord(entry) && entry['@objectName'] === objectName && entry.method === method,
    );

  const getBaseEventDisplay = (obj: unknown, field: string) => {
    const objectName = getObjectNameValue(obj);
    const baseValue = getBaseObjectValue(
      typeof objectName === 'string' ? objectName : undefined,
      `$.event.${field}`,
    );
    if (baseValue === undefined) {
      return 'New';
    }
    const { display } = getEditableValue(baseValue);
    return display || '—';
  };

  const startEventEdit = (obj: unknown, key: string) => {
    if (!hasEditPermission) {
      return;
    }
    const baseKey = key.includes(':') ? key.slice(0, key.lastIndexOf(':')) : key;
    const draft: Record<string, string> = {};
    const evalModes: Record<string, boolean> = {};
    getEventFieldList(obj, key).forEach((field) => {
      const value = getEffectiveEventValue(obj, field);
      const { display, isEval } = getEditableValue(value);
      draft[field] = display;
      evalModes[field] = Boolean(isEval);
    });
    setPanelDrafts((prev) => ({
      ...prev,
      [key]: { event: draft },
    }));
    setPanelEvalModes((prev) => ({
      ...prev,
      [key]: evalModes,
    }));
    const objectName = getObjectNameValue(obj);
    const method = getOverrideMethod();
    if (objectName) {
      const baselineEntries = getObjectOverrideEntries(
        getWorkingOverrides(),
        objectName,
        method,
      ).map(cloneOverrideEntry);
      setPanelOverrideBaselines((prev) => ({
        ...prev,
        [key]: { objectName, method, entries: baselineEntries },
      }));
    }
    setPanelEditState((prev) => ({ ...prev, [key]: true }));
    setBuilderOpen(false);
    window.setTimeout(() => {
      const target = objectRowRefs.current?.[baseKey];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
  };

  const cancelEventEdit = (key: string) => {
    const baseKey = key.includes(':') ? key.slice(0, key.lastIndexOf(':')) : key;
    const objectNameRaw = getObjectByPanelKey(key)?.['@objectName'];
    const objectName = typeof objectNameRaw === 'string' ? objectNameRaw : undefined;
    clearPendingOverrideConversion(objectName);
    setPanelDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelEditState((prev) => ({ ...prev, [key]: false }));
    setPanelEvalModes((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelOverrideBaselines((prev) => {
      if (!prev[key]) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelNavWarning((prev) => {
      if (!prev.fields[key]) {
        return prev;
      }
      const nextFields = { ...prev.fields };
      delete nextFields[key];
      return { ...prev, fields: nextFields };
    });
    window.setTimeout(() => {
      const target = objectRowRefs.current?.[baseKey];
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 0);
    if (builderTarget?.panelKey === key) {
      closeBuilder();
    }
  };

  const hasPanelOverrideChanges = (panelKey: string) => {
    const baseline = panelOverrideBaselines[panelKey];
    if (!baseline) {
      return false;
    }
    const current = getObjectOverrideEntries(
      getWorkingOverrides(),
      baseline.objectName,
      baseline.method,
    );
    return JSON.stringify(current) !== JSON.stringify(baseline.entries);
  };

  const discardPanelOverrides = (panelKey: string) => {
    const baseline = panelOverrideBaselines[panelKey];
    if (!baseline) {
      return;
    }
    const { objectName, method, entries } = baseline;
    const current = getWorkingOverrides();
    const next: any[] = [];
    let inserted = false;
    current.forEach((entry: any) => {
      if (entry?.['@objectName'] === objectName && entry?.method === method) {
        if (!inserted) {
          entries.forEach((item) => next.push(item));
          inserted = true;
        }
        return;
      }
      next.push(entry);
    });
    if (!inserted && entries.length > 0) {
      next.push(...entries);
    }
    const diff = diffOverrides(getBaseOverrides(), next);
    if (diff.totalChanges === 0) {
      setPendingOverrideSave(null);
      return;
    }
    setPendingOverrideSave(next);
  };

  const discardEventEdit = (panelKey: string) => {
    const objectNameRaw = getObjectByPanelKey(panelKey)?.['@objectName'];
    const objectName = typeof objectNameRaw === 'string' ? objectNameRaw : undefined;
    clearPendingOverrideConversion(objectName);
    discardPanelOverrides(panelKey);
    cancelEventEdit(panelKey);
  };

  const discardAllEdits = () => {
    setPendingOverrideSave(null);
    setPendingOverrideConversions({});
    setPanelEditState({});
    setPanelDrafts({});
    setPanelEvalModes({});
    setPanelOverrideRemovals({});
    setPanelAddedFields({});
    setPanelOverrideBaselines({});
    setPanelNavWarning({ open: false, fields: {} });
    setPendingCancel(null);
    closeBuilder();
  };

  const requestCancelEventEdit = (obj: unknown, key: string) => {
    const pendingObjectName = getObjectNameValue(getObjectByPanelKey(key));
    const hasPendingConversion = Boolean(
      getPendingOverrideConversion(pendingObjectName),
    );
    if (
      getPanelDirtyFields(obj, key).length > 0 ||
      hasPanelOverrideChanges(key) ||
      hasPendingConversion
    ) {
      setPendingCancel({ type: 'panel', panelKey: key });
      return;
    }
    cancelEventEdit(key);
  };

  const buildOverridePatchOp = (objectName: string, field: string, value: unknown) =>
    buildEventPatchOp(objectName, field, value);

  const getPendingOverrideConversion = (objectName?: string | null) => {
    if (!objectName) {
      return null;
    }
    return pendingOverrideConversions[objectName] || null;
  };

  const hasPendingOverrideConversion = (objectName?: string | null) =>
    Boolean(getPendingOverrideConversion(objectName));

  const clearPendingOverrideConversion = (objectName?: string | null) => {
    if (!objectName) {
      return;
    }
    setPendingOverrideConversions((prev) => {
      if (!prev[objectName]) {
        return prev;
      }
      const next = { ...prev };
      delete next[objectName];
      return next;
    });
  };

  const canConvertOverrideToV3 = (objectName: string) => {
    if (!objectName) {
      return false;
    }
    if (pendingOverrideConversions[objectName]) {
      return false;
    }
    const overrides = getWorkingOverrides();
    const method = getOverrideMethod();
    const scope = 'post';
    const entry = overrides.find(
      (item: unknown) =>
        isRecord(item) &&
        item['@objectName'] === objectName &&
        item.method === method &&
        item.scope === scope,
    );
    if (!entry) {
      return false;
    }
    const processors: unknown[] = Array.isArray(entry?.processors) ? entry.processors : [];
    if (processors.length === 0) {
      return false;
    }
    if (processors.some((proc: unknown) => isRecord(proc) && proc.op && proc.path)) {
      return false;
    }
    const convertible = processors.filter((processor: unknown) => {
      const target = getProcessorTargetField(processor);
      if (!target || !target.startsWith('$.event.')) {
        return false;
      }
      const setPayload = getSetPayload(processor);
      return Boolean(setPayload && Object.prototype.hasOwnProperty.call(setPayload, 'source'));
    });
    return convertible.length > 0 && convertible.length === processors.length;
  };

  const convertOverrideToV3 = (objectName: string) => {
    if (!objectName) {
      return;
    }
    const overrides = getWorkingOverrides();
    const method = getOverrideMethod();
    const scope = 'post';
    const matchIndex = overrides.findIndex(
      (entry: unknown) =>
        isRecord(entry) &&
        entry['@objectName'] === objectName &&
        entry.method === method &&
        entry.scope === scope,
    );
    if (matchIndex < 0) {
      triggerToast('Conversion failed: override not found.', false);
      return;
    }
    const entry = overrides[matchIndex];
    const processors: unknown[] = Array.isArray(entry?.processors) ? entry.processors : [];
    const patchOps: unknown[] = [];

    processors.forEach((processor: unknown) => {
      if (isRecord(processor) && processor.op && processor.path) {
        patchOps.push(processor);
        return;
      }
      const target = getProcessorTargetField(processor);
      if (!target || !target.startsWith('$.event.')) {
        return;
      }
      const setPayload = getSetPayload(processor);
      if (!setPayload || !Object.prototype.hasOwnProperty.call(setPayload, 'source')) {
        return;
      }
      const field = target.replace('$.event.', '');
      const nextOp = buildOverridePatchOp(objectName, field, setPayload.source);
      for (let i = patchOps.length - 1; i >= 0; i -= 1) {
        if (getPatchTargetField(patchOps[i]) === target) {
          patchOps.splice(i, 1);
        }
      }
      patchOps.push(nextOp);
    });

    if (patchOps.length === 0) {
      triggerToast('Conversion failed: no compatible processors found.', false);
      return;
    }

    const converted = {
      ...entry,
      version: 'v3',
      processors: patchOps,
    };
    setPendingOverrideConversions((prev) => ({
      ...prev,
      [objectName]: {
        entry: converted,
        method,
        scope,
      },
    }));
    triggerToast(
      `Conversion successful for ${objectName}. Click 'Save Conversion' to stage the update.`,
      false,
    );
  };

  const openAdvancedFlowForObject = (objectName: string) => {
    if (!objectName) {
      return;
    }
    openAdvancedFlowModal('object', objectName, null);
  };

  const saveEventEdit = async (obj: unknown, key: string) => {
    if (!selectedFile) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    const objectName = getObjectNameValue(obj);
    if (!objectName) {
      return;
    }
    const method = getOverrideMethod();
    const scope = 'post';
    const pendingConversion = getPendingOverrideConversion(objectName);
    const hasPendingConversion = Boolean(
      pendingConversion &&
        pendingConversion.method === method &&
        pendingConversion.scope === scope,
    );
    const versionInfo = getOverrideVersionInfo(objectName);
    const isV2Mode =
      !hasPendingConversion && (versionInfo.mode === 'v2' || versionInfo.mode === 'mixed');
    const draft = panelDrafts?.[key]?.event || {};
    const overrideValueMap = getOverrideValueMap(obj);
    const removalFields = new Set(panelOverrideRemovals[key] || []);
    const autoRemovalFields = new Set<string>();
    const stagedRemovedFields = new Set<string>();
    const stagedNow = diffOverrides(getBaseOverrides(), getWorkingOverrides());
    stagedNow.sections.forEach((section) => {
      if (section.objectName !== objectName) {
        return;
      }
      section.fieldChanges.forEach((change) => {
        if (change.action === 'removed' && change.target.startsWith('$.event.')) {
          stagedRemovedFields.add(change.target.replace('$.event.', ''));
        }
      });
    });
    stagedRemovedFields.forEach((field) => removalFields.add(field));
    const updates: { field: string; value: unknown }[] = [];
    getEventFieldList(obj, key).forEach((field) => {
      if (stagedRemovedFields.has(field)) {
        return;
      }
      const original = getEffectiveEventValue(obj, field);
      const draftValue = draft[field];
      const { display } = getEditableValue(original);
      if (String(draftValue ?? '') !== String(display ?? '')) {
        let value: unknown = draftValue;
        if (
          !isEvalMode(key, field) &&
          draftValue !== '' &&
          !Number.isNaN(Number(draftValue)) &&
          field !== 'Summary'
        ) {
          value = Number(draftValue);
        }
        if (isEvalMode(key, field)) {
          value = { eval: String(draftValue ?? '') };
        }
        const baseValue = getBaseObjectValue(objectName, `$.event.${field}`);
        const hasOverride = overrideValueMap.has(`$.event.${field}`);
        if (hasOverride && areOverrideValuesEqual(value, baseValue)) {
          autoRemovalFields.add(field);
          return;
        }
        updates.push({ field, value });
      }
    });

    autoRemovalFields.forEach((field) => removalFields.add(field));

    if (updates.length === 0 && removalFields.size === 0 && !hasPendingConversion) {
      setSaveError(null);
      setSaveSuccess('No changes made.');
      return;
    }

    const existingOverrides = [...getBaseOverrides()];
    const baseOverrides = pendingOverrideSave ? [...pendingOverrideSave] : existingOverrides;
    const matchIndex = baseOverrides.findIndex(
      (entry: unknown) =>
        isRecord(entry) &&
        entry['@objectName'] === objectName &&
        entry.method === method &&
        entry.scope === scope,
    );
    let overrideEntry =
      matchIndex >= 0
        ? { ...baseOverrides[matchIndex] }
        : {
            name: `${objectName} Override`,
            description: `Overrides for ${objectName}`,
            domain: 'fault',
            method,
            scope,
            '@objectName': objectName,
            _type: 'override',
            version: isV2Mode ? 'v2' : 'v3',
            processors: [],
          };

    let processors = Array.isArray(overrideEntry.processors) ? [...overrideEntry.processors] : [];

    if (
      pendingConversion?.entry &&
      pendingConversion.method === method &&
      pendingConversion.scope === scope
    ) {
      overrideEntry = {
        ...overrideEntry,
        ...pendingConversion.entry,
        version: 'v3',
      };
      processors = Array.isArray(pendingConversion.entry.processors)
        ? [...pendingConversion.entry.processors]
        : [];
    }

    if (isV2Mode) {
      if (removalFields.size > 0) {
        processors = processors.filter((proc: unknown) => {
          const target = getProcessorTargetField(proc);
          if (!target) {
            return true;
          }
          const field = target.replace('$.event.', '');
          return !removalFields.has(field);
        });
      }

      updates.forEach(({ field, value }) => {
        if (removalFields.has(field)) {
          return;
        }
        const targetField = `$.event.${field}`;
        processors = processors.filter(
          (proc: unknown) => getProcessorTargetField(proc) !== targetField,
        );
        processors.push({
          set: {
            source: value,
            targetField,
          },
        });
      });

      overrideEntry.version = 'v2';
    } else {
      const hasNonPatch = processors.some(
        (proc: unknown) => !(isRecord(proc) && proc.op && proc.path),
      );
      if (hasNonPatch) {
        setSaveError('Advanced processors are not supported in v3 override files yet.');
        return;
      }
      if (!overrideEntry.version) {
        overrideEntry.version = 'v3';
      }

      if (removalFields.size > 0) {
        processors = processors.filter((proc: unknown) => {
          const target = getPatchTargetField(proc);
          if (!target) {
            return true;
          }
          const field = target.replace('$.event.', '');
          return !removalFields.has(field);
        });
      }

      updates.forEach(({ field, value }) => {
        if (removalFields.has(field)) {
          return;
        }
        const targetField = `$.event.${field}`;
        processors = processors.filter((proc: unknown) => getPatchTargetField(proc) !== targetField);
        processors.push(buildOverridePatchOp(objectName, field, value));
      });
    }

    if (processors.length === 0) {
      if (matchIndex >= 0) {
        baseOverrides.splice(matchIndex, 1);
      }
    } else {
      overrideEntry.processors = processors;
      if (matchIndex >= 0) {
        baseOverrides[matchIndex] = overrideEntry;
      } else {
        baseOverrides.push(overrideEntry);
      }
    }

    const stagedCount = updates.length + removalFields.size + (hasPendingConversion ? 1 : 0);
    setPendingOverrideSave(baseOverrides);
    triggerToast(`Staged ${stagedCount} event override change(s) for ${objectName}`, true);
    if (hasPendingConversion) {
      clearPendingOverrideConversion(objectName);
    }
    if (removalFields.size > 0) {
      const removedNewFields = Array.from(removalFields).filter(
        (field) => getBaseObjectValue(objectName, `$.event.${field}`) === undefined,
      );
      if (removedNewFields.length > 0) {
        setPanelAddedFields((prev) => {
          const next = { ...prev };
          const existing = new Set(next[key] || []);
          removedNewFields.forEach((field) => existing.delete(field));
          if (existing.size > 0) {
            next[key] = Array.from(existing);
          } else {
            delete next[key];
          }
          return next;
        });
      }
    }
    if (builderTarget?.panelKey === key) {
      closeBuilder();
    }
    setPanelNavWarning((prev) => {
      if (!prev.fields[key]) {
        return prev;
      }
      const nextFields = { ...prev.fields };
      delete nextFields[key];
      return { ...prev, fields: nextFields };
    });
    cancelEventEdit(key);
  };

  const openRemoveOverrideModal = (obj: unknown, field: string, panelKey: string) => {
    if (!hasEditPermission || !panelEditState[panelKey]) {
      return;
    }
    const baseDisplay = getBaseEventDisplay(obj, field);
    const isNewField = baseDisplay === 'New';
    setRemoveOverrideModal({
      open: true,
      objectName: getObjectNameValue(obj) || undefined,
      field,
      baseValue: baseDisplay || '—',
      panelKey,
      isNewField,
    });
  };

  const confirmRemoveOverride = () => {
    if (!ensureEditPermission()) {
      setRemoveOverrideModal({ open: false });
      return;
    }
    if (
      !removeOverrideModal.objectName ||
      !removeOverrideModal.field ||
      !removeOverrideModal.panelKey
    ) {
      setRemoveOverrideModal({ open: false });
      return;
    }

    const panelKey = removeOverrideModal.panelKey;
    const field = removeOverrideModal.field;
    if (!panelEditState[panelKey]) {
      setRemoveOverrideModal({ open: false });
      return;
    }

    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      const list = new Set(next[panelKey] || []);
      list.add(field);
      next[panelKey] = Array.from(list);
      return next;
    });

    if (!removeOverrideModal.isNewField) {
      setPanelDrafts((prev) => {
        const next = { ...prev };
        const current = next[panelKey]?.event || {};
        next[panelKey] = {
          ...next[panelKey],
          event: {
            ...current,
            [field]: removeOverrideModal.baseValue ?? '',
          },
        };
        return next;
      });
    }

    setRemoveOverrideModal({ open: false });
  };

  const openRemoveAllOverridesModal = (obj: unknown, panelKey: string) => {
    if (!hasEditPermission || !panelEditState[panelKey]) {
      return;
    }
    const objectName = getObjectNameValue(obj);
    if (!objectName) {
      return;
    }
    const overrides = overrideIndex.get(objectName) || [];
    const eventOverrideFields = new Set<string>();
    const processors = overrides.flatMap((entry) =>
      Array.isArray(entry?.processors) ? entry.processors : [],
    );
    const hasAdvancedFlow = processors.some(
      (proc: unknown) => !getProcessorTargetField(proc) && !(isRecord(proc) && proc.op && proc.path),
    );
    overrides.forEach((entry) => {
      const eventOverrides = getOverrideEventMap(entry);
      Object.keys(eventOverrides).forEach((field) => eventOverrideFields.add(field));
    });
    const processorTargets = getDirectOverrideTargets(obj);
    const baseValues: Record<string, string> = {};
    const newFields: string[] = [];
    const removableFields = new Set<string>();
    const processorFields: string[] = [];
    eventOverrideFields.forEach((field) => {
      removableFields.add(field);
    });
    processorTargets.forEach((target) => {
      if (target?.startsWith('$.event.')) {
        const field = target.replace('$.event.', '');
        processorFields.push(field);
        removableFields.add(field);
      }
    });

    removableFields.forEach((field) => {
      const baseValue = getBaseEventDisplay(obj, field) || '—';
      if (baseValue === 'New') {
        newFields.push(field);
        baseValues[field] = 'Added field (will be removed)';
      } else {
        baseValues[field] = baseValue;
      }
    });

    if (removableFields.size === 0 && !hasAdvancedFlow) {
      return;
    }
    setRemoveAllOverridesModal({
      open: true,
      panelKey,
      fields: Array.from(removableFields),
      baseValues,
      newFields,
      processorFields,
      objectName,
      hasAdvancedFlow,
    });
  };

  const confirmRemoveAllOverrides = () => {
    if (!ensureEditPermission()) {
      setRemoveAllOverridesModal({ open: false });
      return;
    }
    if (!removeAllOverridesModal.panelKey || !removeAllOverridesModal.fields) {
      setRemoveAllOverridesModal({ open: false });
      return;
    }

    const panelKey = removeAllOverridesModal.panelKey;
    const fields = removeAllOverridesModal.fields;
    if (fields.length === 0) {
      setRemoveAllOverridesModal({ open: false });
      return;
    }
    if (!panelEditState[panelKey]) {
      setRemoveAllOverridesModal({ open: false });
      return;
    }

    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      const list = new Set(next[panelKey] || []);
      fields.forEach((field) => list.add(field));
      next[panelKey] = Array.from(list);
      return next;
    });

    setPanelDrafts((prev) => {
      const next = { ...prev };
      const current = next[panelKey]?.event || {};
      const baseValues = removeAllOverridesModal.baseValues || {};
      const newFields = new Set(removeAllOverridesModal.newFields || []);
      const merged = { ...current };
      fields.forEach((field) => {
        if (!newFields.has(field)) {
          merged[field] = baseValues[field] ?? '';
        }
      });
      next[panelKey] = {
        ...next[panelKey],
        event: merged,
      };
      return next;
    });

    setRemoveAllOverridesModal({ open: false });
  };

  const getObjectKey = (obj: unknown, index: number) => {
    const name = isRecord(obj) ? obj['@objectName'] : undefined;
    return typeof name === 'string' && name ? `name:${name}` : `idx:${index}`;
  };

  const getStickyOffset = (container: HTMLElement | null) => {
    if (!container) {
      return 0;
    }
    const bars = Array.from(container.querySelectorAll<HTMLElement>('.match-bar'));
    if (bars.length === 0) {
      return 0;
    }
    const total = bars.reduce((sum, bar) => sum + bar.getBoundingClientRect().height, 0);
    return total + 12;
  };

  const scrollToRef = (target?: HTMLDivElement | null, options?: { offset?: number }) => {
    if (!target) {
      return;
    }
    const container = getActiveScrollContainer();
    if (!container) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const offset = options?.offset ?? 0;
    const targetTop = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
    const nextTop = container.scrollTop + targetTop - offset;
    container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
  };

  const getActiveScrollContainer = () =>
    isAnyPanelEditing ? friendlyMainRef.current : friendlyViewRef.current;

  const handleFileScroll = () => {
    if (!selectedFile?.PathID) {
      return;
    }
    const container = getActiveScrollContainer();
    if (container) {
      scrollStateByFileRef.current[selectedFile.PathID] = container.scrollTop;
    }
  };

  const scrollToMatchIndex = (index: number) => {
    if (index < 0 || index >= highlightObjectKeys.length) {
      return;
    }
    const key = highlightObjectKeys[index];
    scrollToRef(objectRowRefs.current[key]);
  };

  const scrollToOverrideIndex = (index: number) => {
    if (index < 0 || index >= overrideObjectKeys.length) {
      return;
    }
    const key = overrideObjectKeys[index];
    const container = getActiveScrollContainer();
    scrollToRef(objectRowRefs.current[key], { offset: getStickyOffset(container) });
  };

  const handlePrevOverride = () => {
    if (overrideObjectKeys.length === 0) {
      return;
    }
    setOverrideMatchIndex((prev) => {
      const next = prev <= 0 ? overrideObjectKeys.length - 1 : prev - 1;
      scrollToOverrideIndex(next);
      return next;
    });
  };

  const handleNextOverride = () => {
    if (overrideObjectKeys.length === 0) {
      return;
    }
    setOverrideMatchIndex((prev) => {
      const next = prev >= overrideObjectKeys.length - 1 ? 0 : prev + 1;
      scrollToOverrideIndex(next);
      return next;
    });
  };

  const handleJumpToOverride = (key: string) => {
    const index = overrideObjectKeys.indexOf(key);
    if (index === -1) {
      return;
    }
    setOverrideMatchIndex(index);
    scrollToOverrideIndex(index);
  };

  const registerObjectRowRef = (key: string, node: HTMLDivElement | null) => {
    objectRowRefs.current[key] = node;
  };

  const shouldHighlightTerm = () => Boolean(searchHighlightActive && highlightQuery);

  const renderHighlightedText = (text: string) => {
    if (!shouldHighlightTerm() || !highlightQuery) {
      return text;
    }
    const query = highlightQuery.trim();
    if (!query) {
      return text;
    }
    const lower = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (!lower.includes(lowerQuery)) {
      return text;
    }
    const parts: React.ReactNode[] = [];
    let start = 0;
    while (true) {
      const idx = lower.indexOf(lowerQuery, start);
      if (idx === -1) {
        break;
      }
      if (idx > start) {
        parts.push(text.slice(start, idx));
      }
      parts.push(
        <span
          key={`match-${idx}`}
          className={`match-highlight${matchPingKey ? ' match-highlight-ping' : ''}`}
        >
          {text.slice(idx, idx + query.length)}
        </span>,
      );
      start = idx + query.length;
    }
    if (start < text.length) {
      parts.push(text.slice(start));
    }
    return parts;
  };

  const highlightFileName = Boolean(
    highlightQuery &&
    highlightMatchSource &&
    (highlightMatchSource === 'name' || highlightMatchSource === 'both') &&
    selectedFile?.PathID &&
    selectedFile.PathID === highlightPathId,
  );

  const modalBaseZ = 1200;
  const modalStepZ = 10;
  const updateModalStack = (id: string, open: boolean) => {
    setModalStack((prev) => {
      if (open) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((entry) => entry !== id);
    });
  };
  const getModalOverlayStyle = (id: string, fallbackLevel = 0) => {
    const index = modalStack.indexOf(id);
    const level = index >= 0 ? index : fallbackLevel;
    return { zIndex: modalBaseZ + level * modalStepZ };
  };

  const triggerValidationPulse = (container: HTMLElement | null) => {
    if (!container) {
      return;
    }
    const target = container.querySelector<HTMLElement>('[data-error="true"]');
    if (!target) {
      return;
    }
    target.classList.remove('input-pulse');
    void target.offsetWidth;
    target.classList.add('input-pulse');
    target.focus();
    window.setTimeout(() => target.classList.remove('input-pulse'), 800);
  };

  const triggerFlowErrorPulse = (container: HTMLElement | null) => {
    if (!container) {
      return;
    }
    const target = container.querySelector<HTMLElement>('.flow-node-error');
    if (!target) {
      return;
    }
    target.classList.remove('flow-node-pulse');
    void target.offsetWidth;
    target.classList.add('flow-node-pulse');
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => target.classList.remove('flow-node-pulse'), 800);
  };

  const clearPingSequence = (sequenceRef: React.MutableRefObject<number[]>) => {
    sequenceRef.current.forEach((timeout) => window.clearTimeout(timeout));
    sequenceRef.current = [];
  };

  const startMatchPingSequence = (key: string, count = 3) => {
    clearPingSequence(matchPingSequenceRef);
    let runCount = 0;
    const trigger = () => {
      setMatchPingKey(key);
      matchPingSequenceRef.current.push(
        window.setTimeout(() => {
          setMatchPingKey(null);
          runCount += 1;
          if (runCount < count) {
            matchPingSequenceRef.current.push(window.setTimeout(trigger, 260));
          }
        }, 520),
      );
    };
    trigger();
  };

  const startFileNamePingSequence = (count = 3) => {
    clearPingSequence(fileNamePingSequenceRef);
    let runCount = 0;
    const trigger = () => {
      setFileNamePingActive(true);
      fileNamePingSequenceRef.current.push(
        window.setTimeout(() => {
          setFileNamePingActive(false);
          runCount += 1;
          if (runCount < count) {
            fileNamePingSequenceRef.current.push(window.setTimeout(trigger, 260));
          }
        }, 520),
      );
    };
    trigger();
  };

  const renderValue = (
    value: any,
    trapVars?: any[],
    options?: { suppressEvalTooltip?: boolean },
  ) => {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      const text = String(value);
      if (typeof value === 'string' && text.includes('$v')) {
        return renderEvalLineWithVars(text, trapVars);
      }
      return renderHighlightedText(text);
    }
    if (value && typeof value === 'object' && typeof value.eval === 'string') {
      return renderEvalDisplay(value.eval, trapVars, !options?.suppressEvalTooltip);
    }
    try {
      return renderHighlightedText(JSON.stringify(value));
    } catch {
      return '—';
    }
  };

  const _getEvalText = (value: any) => {
    if (value && typeof value === 'object' && typeof value.eval === 'string') {
      return value.eval;
    }
    return typeof value === 'string' ? value : '';
  };

  const getVarInsertMatch = (value: string, cursorIndex: number | null) => {
    if (cursorIndex === null) {
      return null;
    }
    const prefix = value.slice(0, cursorIndex);
    const match = prefix.match(/\$v\d*$/);
    if (!match) {
      return null;
    }
    const start = prefix.lastIndexOf(match[0]);
    return { token: match[0], replaceStart: start, replaceEnd: cursorIndex };
  };

  const getEventFieldInsertMatch = (value: string, cursorIndex: number | null) => {
    if (cursorIndex === null) {
      return null;
    }
    const prefix = value.slice(0, cursorIndex);
    const match = prefix.match(/\$\.event\.?[A-Za-z0-9_]*$/);
    if (!match) {
      return null;
    }
    const start = prefix.lastIndexOf(match[0]);
    const token = match[0];
    const rawQuery = token.replace('$.event', '').replace(/^\./, '');
    return {
      token,
      query: rawQuery,
      replaceStart: start,
      replaceEnd: cursorIndex,
    };
  };

  const tryOpenVarInsertModal = (params: {
    panelKey: string;
    field: string;
    value: string;
    cursorIndex: number | null;
    trapVars: any[];
    meta?: {
      rowId?: string;
      nodeId?: string;
      key?: 'left' | 'right' | 'result' | 'else';
    };
  }) => {
    const match = getVarInsertMatch(params.value, params.cursorIndex);
    if (!match) {
      return false;
    }
    setVarModalVars(Array.isArray(params.trapVars) ? params.trapVars : []);
    setVarInsertContext({
      panelKey: params.panelKey,
      field: params.field,
      value: params.value,
      replaceStart: match.replaceStart,
      replaceEnd: match.replaceEnd,
      meta: params.meta,
    });
    setVarModalMode('insert');
    setVarModalOpen(true);
    setVarModalToken(match.token);
    return true;
  };

  const handleVarInsertSelect = (token: string) => {
    if (!varInsertContext) {
      return;
    }
    const { panelKey, field, value, replaceStart, replaceEnd, meta } = varInsertContext;
    const nextValue = `${value.slice(0, replaceStart)}${token}${value.slice(replaceEnd)}`;
    if (meta?.key === 'else') {
      setBuilderElseResult(nextValue);
    } else if (meta?.key === 'result' && meta.rowId) {
      updateBuilderResult(meta.rowId, nextValue);
    } else if ((meta?.key === 'left' || meta?.key === 'right') && meta.rowId && meta.nodeId) {
      updateBuilderCondition(meta.rowId, meta.nodeId, meta.key, nextValue);
    } else if (panelKey === '__flow__') {
      setFlowEditorDraft((prev) => {
        if (!prev) {
          return prev;
        }
        if (field === 'flowEditor.source') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              source: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.targetField') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              targetField: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.pattern') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              pattern: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.property' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              property: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.value' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              value: nextValue,
            },
          } as FlowNode;
        }
        return prev;
      });
    } else if (field === 'processorSource' || field === 'processorTarget') {
      updateBuilderDraftField(field, nextValue);
    } else if (field === 'builderLiteral') {
      setBuilderLiteralText(nextValue);
    } else if (field === 'builderRegular') {
      setBuilderRegularText(nextValue);
    } else {
      setPanelDrafts((prev) => ({
        ...prev,
        [panelKey]: {
          ...prev[panelKey],
          event: {
            ...prev[panelKey]?.event,
            [field]: nextValue,
          },
        },
      }));
    }
    setVarModalOpen(false);
    setVarModalMode('view');
    setVarInsertContext(null);
    setVarModalToken(null);
  };

  const handleEventFieldInsertSelect = (fieldName: string) => {
    if (!eventFieldInsertContext) {
      return;
    }
    const { panelKey, field, value, replaceStart, replaceEnd } = eventFieldInsertContext;
    if (panelKey === '__flow__' && isPreGlobalFlow) {
      setEventFieldPickerOpen(false);
      setEventFieldInsertContext(null);
      return;
    }
    const insertToken = `$.event.${fieldName}`;
    const nextValue = `${value.slice(0, replaceStart)}${insertToken}${value.slice(replaceEnd)}`;
    if (panelKey === '__flow__') {
      setFlowEditorDraft((prev) => {
        if (!prev) {
          return prev;
        }
        if (field === 'flowEditor.source') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              source: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.targetField') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              targetField: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.pattern') {
          return {
            ...prev,
            config: {
              ...(prev as FlowProcessorNode).config,
              pattern: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.property' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              property: nextValue,
            },
          } as FlowNode;
        }
        if (field === 'flowEditor.condition.value' && prev.kind === 'if') {
          return {
            ...prev,
            condition: {
              ...prev.condition,
              value: nextValue,
            },
          } as FlowNode;
        }
        return prev;
      });
    } else if (field === 'processorSource') {
      updateBuilderDraftField(field, nextValue);
    } else if (field === 'builderLiteral') {
      setBuilderLiteralText(nextValue);
    } else if (field === 'builderRegular') {
      setBuilderRegularText(nextValue);
    } else {
      setPanelDrafts((prev) => ({
        ...prev,
        [panelKey]: {
          ...prev[panelKey],
          event: {
            ...prev[panelKey]?.event,
            [field]: nextValue,
          },
        },
      }));
    }
    setEventFieldPickerOpen(false);
    setEventFieldInsertContext(null);
  };

  const handleBuilderProcessorInputChange = (
    fieldKey: 'source' | 'targetField' | 'pattern',
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    if (fieldKey === 'source') {
      handleProcessorSourceChange(value, cursorIndex, inputType);
      return;
    }
    if (fieldKey === 'targetField') {
      handleProcessorTargetChange(value, cursorIndex, inputType);
      return;
    }
    updateBuilderDraftField('processorPattern', value);
  };

  const createFlowNodeFromPaletteValue = (value: string) =>
    createFlowNode(
      value === 'if' ? { nodeKind: 'if' } : { nodeKind: 'processor', processorType: value },
    );

  const renderProcessorConfigFields = (
    processorType: string,
    config: Record<string, any>,
    onConfigChange: (key: string, value: string | boolean) => void,
    context: 'flow' | 'builder',
    fieldErrors?: Record<string, string[]>,
  ) =>
    (processorConfigSpecs[processorType] || []).map((field) => {
      const isJsonField = field.type === 'json';
      const valueKey = isJsonField ? `${field.key}Text` : field.key;
      const value = (config?.[valueKey] ?? '') as string | boolean;
      const jsonError =
        isJsonField && String(value).trim()
          ? (() => {
              try {
                JSON.parse(String(value));
                return '';
              } catch {
                return `${field.label} must be valid JSON.`;
              }
            })()
          : '';
      const handleTextChange = (
        nextValue: string,
        cursorIndex: number | null,
        inputType?: string,
      ) => {
        if (field.key === 'source' || field.key === 'targetField' || field.key === 'pattern') {
          if (context === 'flow') {
            handleFlowEditorInputChange(
              field.key === 'source'
                ? 'flowEditor.source'
                : field.key === 'targetField'
                  ? 'flowEditor.targetField'
                  : 'flowEditor.pattern',
              nextValue,
              cursorIndex,
              inputType,
            );
            return;
          }
          handleBuilderProcessorInputChange(field.key, nextValue, cursorIndex, inputType);
          return;
        }
        onConfigChange(valueKey, nextValue);
      };
      const errors = fieldErrors?.[field.key] || (jsonError ? [jsonError] : []);
      return (
        <div key={field.key} className="processor-row">
          <label className="builder-label">{field.label}</label>
          {field.type === 'boolean' ? (
            <select
              className="builder-select"
              value={value ? 'true' : 'false'}
              onChange={(e) => onConfigChange(field.key, e.target.value === 'true')}
              data-error={errors.length > 0 ? 'true' : undefined}
              aria-invalid={errors.length > 0}
            >
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          ) : field.type === 'select' && field.key === 'sourceType' ? (
            <div className="builder-source-toggle">
              <div className="builder-toggle-group" role="group" aria-label="Source interpretation">
                {(
                  field.options || [
                    { label: 'Literal', value: 'literal' },
                    { label: 'Path', value: 'path' },
                  ]
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`builder-toggle${
                      String(value || (processorType === 'regex' ? 'path' : 'literal')) ===
                      option.value
                        ? ' builder-toggle-active'
                        : ''
                    }`}
                    onClick={() => onConfigChange(field.key, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="builder-hint">Auto-detects from $. prefix. Toggle to override.</div>
            </div>
          ) : field.type === 'select' ? (
            <select
              className="builder-select"
              value={String(value || '')}
              onChange={(e) => onConfigChange(field.key, e.target.value)}
              data-error={errors.length > 0 ? 'true' : undefined}
              aria-invalid={errors.length > 0}
            >
              {(field.options || []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : isJsonField ? (
            <textarea
              className="builder-textarea"
              placeholder={field.placeholder}
              value={value as string}
              onChange={(e) =>
                handleTextChange(
                  e.target.value,
                  e.target.selectionStart,
                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                )
              }
              data-error={errors.length > 0 ? 'true' : undefined}
              aria-invalid={errors.length > 0}
            />
          ) : (
            <input
              className="builder-input"
              placeholder={field.placeholder}
              value={value as string}
              onChange={(e) =>
                handleTextChange(
                  e.target.value,
                  e.target.selectionStart,
                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                )
              }
              data-error={errors.length > 0 ? 'true' : undefined}
              aria-invalid={errors.length > 0}
            />
          )}
          {context === 'builder' && field.key === 'source' && builderTarget && (
            <div className="builder-inline-actions">
              <button
                type="button"
                className="builder-link builder-var-button"
                title={`Insert variable (${builderTrapVars.length})`}
                onClick={() => {
                  openVarInsertModal(
                    builderTarget.panelKey,
                    'processorSource',
                    String(value || ''),
                    Array.isArray(builderTrapVars) ? builderTrapVars : [],
                  );
                }}
                disabled={builderTrapVars.length === 0}
              >
                Variables ({builderTrapVars.length})
              </button>
            </div>
          )}
          {errors.length > 0 && (
            <div className="builder-hint builder-hint-warning">
              {errors.map((message) => (
                <div key={`${field.key}-${message}`}>{message}</div>
              ))}
            </div>
          )}
        </div>
      );
    });

  const handleFlowEditorInputChange = (
    fieldKey:
      | 'flowEditor.source'
      | 'flowEditor.targetField'
      | 'flowEditor.pattern'
      | 'flowEditor.condition.property'
      | 'flowEditor.condition.value',
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setFlowEditorDraft((prev) => {
      if (!prev) {
        return prev;
      }
      if (fieldKey === 'flowEditor.source') {
        const inferredType = value.trim().startsWith('$.') ? 'path' : 'literal';
        return {
          ...prev,
          config: {
            ...(prev as FlowProcessorNode).config,
            source: value,
            ...(prev.kind === 'processor' && ['set', 'regex'].includes(prev.processorType)
              ? { sourceType: inferredType }
              : {}),
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.targetField') {
        return {
          ...prev,
          config: {
            ...(prev as FlowProcessorNode).config,
            targetField: value,
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.pattern') {
        return {
          ...prev,
          config: {
            ...(prev as FlowProcessorNode).config,
            pattern: value,
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.condition.property' && prev.kind === 'if') {
        return {
          ...prev,
          condition: {
            ...prev.condition,
            property: value,
          },
        } as FlowNode;
      }
      if (fieldKey === 'flowEditor.condition.value' && prev.kind === 'if') {
        return {
          ...prev,
          condition: {
            ...prev.condition,
            value,
          },
        } as FlowNode;
      }
      return prev;
    });

    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const obj = builderTarget ? getObjectByPanelKey(builderTarget.panelKey) : null;
    const trapVars = getTrapVariables(obj);
    if (
      tryOpenVarInsertModal({
        panelKey: '__flow__',
        field: fieldKey,
        value,
        cursorIndex,
        trapVars,
      })
    ) {
      return;
    }

    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: '__flow__',
      field: fieldKey,
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const handleLiteralInputChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setBuilderLiteralText(value);
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    const trapVars = getTrapVariables(obj);
    if (
      tryOpenVarInsertModal({
        panelKey: builderTarget.panelKey,
        field: 'builderLiteral',
        value,
        cursorIndex,
        trapVars,
      })
    ) {
      return;
    }
    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'builderLiteral',
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const handleEventInputChange = (
    obj: any,
    panelKey: string,
    field: string,
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setPanelDrafts((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        event: {
          ...prev[panelKey]?.event,
          [field]: value,
        },
      },
    }));

    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const trapVars = getTrapVariables(obj);
    if (
      tryOpenVarInsertModal({
        panelKey,
        field,
        value,
        cursorIndex,
        trapVars,
      })
    ) {
      return;
    }

    const eventMatch = getEventFieldInsertMatch(value, cursorIndex);
    if (!eventMatch) {
      return;
    }
    setEventFieldSearch(eventMatch.query || '');
    setEventFieldInsertContext({
      panelKey,
      field,
      value,
      replaceStart: eventMatch.replaceStart,
      replaceEnd: eventMatch.replaceEnd,
    });
    setEventFieldPickerOpen(true);
  };

  const openBuilderForField = (obj: any, panelKey: string, field: string) => {
    if (!hasEditPermission) {
      return;
    }
    const versionInfo = getOverrideVersionInfo(obj?.['@objectName']);
    if (versionInfo.mode === 'v2' || versionInfo.mode === 'mixed') {
      const objectName = obj?.['@objectName'] || null;
      openAdvancedFlowModal('object', objectName, `$.event.${field}`);
      return;
    }
    if (!panelEditState[panelKey]) {
      startEventEdit(obj, panelKey);
    }
    builderHistoryInitRef.current = true;
    const overrideProcessors = (() => {
      const objectName = obj?.['@objectName'];
      if (!objectName) {
        return [];
      }
      const overrides = getOverrideEntries();
      const method = getOverrideMethod();
      const scope = 'post';
      const entry = overrides.find(
        (item: any) =>
          item?.['@objectName'] === objectName && item?.method === method && item?.scope === scope,
      );
      return Array.isArray(entry?.processors) ? entry.processors : [];
    })();
    const targetPath = `$.event.${field}`;
    const existingProcessor = overrideProcessors.find(
      (proc: any) => (getProcessorTargetField(proc) || getPatchTargetField(proc)) === targetPath,
    );
    const builderProcessor =
      existingProcessor?.op && existingProcessor?.path
        ? existingProcessor?.value && typeof existingProcessor.value === 'object'
          ? existingProcessor.value
          : null
        : existingProcessor;
    const isPatchMode =
      Boolean(existingProcessor?.op && existingProcessor?.path) || versionInfo.mode === 'v3';
    setBuilderPatchMode(isPatchMode);
    setBuilderPatchOp(existingProcessor?.op && existingProcessor?.path ? existingProcessor : null);
    const draftValue = panelDrafts?.[panelKey]?.event?.[field];
    const evalSource = builderProcessor?.set?.source;
    const evalTextFromOverride =
      isRecord(evalSource) && typeof evalSource.eval === 'string'
        ? evalSource.eval
        : null;
    const evalValue = getEffectiveEventValue(obj, field);
    const evalTextFromValue =
      isRecord(evalValue) && typeof evalValue.eval === 'string'
        ? evalValue.eval
        : typeof evalValue === 'string'
          ? evalValue.trim()
          : '';
    const evalEnabled =
      isEvalMode(panelKey, field) ||
      Boolean(evalTextFromOverride) ||
      (isRecord(evalValue) && typeof evalValue.eval === 'string');
    const evalText = evalEnabled
      ? typeof draftValue === 'string' && draftValue.trim()
        ? draftValue.trim()
        : evalTextFromOverride || evalTextFromValue
      : '';

    setBuilderTarget({ panelKey, field });
    setBuilderOpen(true);
    setShowProcessorJson(true);
    const builderConfig = builderProcessor
      ? buildBuilderConfigFromProcessor(builderProcessor, targetPath)
      : null;
    if (builderConfig) {
      setBuilderFocus('processor');
      setBuilderTypeLocked('processor');
      setProcessorType(builderConfig.type);
      setProcessorStep('configure');
      setBuilderProcessorConfig(builderConfig.config);
      return;
    }
    if (evalEnabled && evalText) {
      const parsed = parseEvalToRows(evalText);
      setBuilderFocus('eval');
      setBuilderTypeLocked('eval');
      if (parsed) {
        setBuilderMode('friendly');
        setBuilderConditions(parsed.rows);
        setBuilderElseResult(parsed.elseResult);
      } else {
        setBuilderMode('friendly');
      }
      setBuilderRegularText(evalText);
      return;
    }
    if (!evalEnabled) {
      setBuilderFocus('literal');
      setBuilderTypeLocked('literal');
      setBuilderLiteralText(getCurrentFieldValue(obj, panelKey, field));
      return;
    }
    setBuilderFocus(null);
    setProcessorStep('select');
    setProcessorType(null);
    setBuilderProcessorConfig({
      sourceType: 'literal',
      source: '',
      pattern: '',
      targetField: targetPath,
    });
  };

  const updatePanelDraftField = (panelKey: string, field: string, value: string) => {
    setPanelDrafts((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        event: {
          ...prev[panelKey]?.event,
          [field]: value,
        },
      },
    }));
  };

  const setEvalModeForField = (panelKey: string, field: string, enabled: boolean) => {
    setPanelEvalModes((prev) => ({
      ...prev,
      [panelKey]: {
        ...prev[panelKey],
        [field]: enabled,
      },
    }));
  };

  const isBuilderTargetReady = Boolean(builderTarget && panelEditState[builderTarget.panelKey]);
  const isFieldLockedByBuilder = (panelKey: string, field: string) => {
    void panelKey;
    void field;
    return false;
  };
  const getCurrentFieldValue = (obj: any, panelKey: string, field: string) => {
    const draftValue = panelDrafts?.[panelKey]?.event?.[field];
    if (draftValue !== undefined) {
      return String(draftValue ?? '');
    }
    const original = getEffectiveEventValue(obj, field);
    const { display } = getEditableValue(original);
    return String(display ?? '');
  };
  const getLiteralEligibility = () => {
    if (!builderTarget) {
      return { eligible: false, value: '' };
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return { eligible: false, value: '' };
    }
    if (isEvalMode(builderTarget.panelKey, builderTarget.field)) {
      return { eligible: false, value: '' };
    }
    const original = getEffectiveEventValue(obj, builderTarget.field);
    const { display, isEval } = getEditableValue(original);
    const eligible =
      !isEval && (typeof original === 'string' || typeof original === 'number' || original == null);
    return { eligible, value: String(display ?? '') };
  };

  const hasBuilderUnsavedChanges = () => {
    if (!builderTarget) {
      return false;
    }
    if (!builderDirtySigRef.current) {
      return false;
    }
    const snapshot = createBuilderSnapshot();
    const sig = JSON.stringify(snapshot);
    return sig !== builderDirtySigRef.current;
  };

  const requestCancelBuilder = () => {
    if (hasBuilderUnsavedChanges()) {
      setPendingCancel({ type: 'builder' });
      return;
    }
    closeBuilder();
  };
  const closeBuilder = () => {
    setBuilderTarget(null);
    setBuilderFocus(null);
    setProcessorStep('select');
    setProcessorType(null);
    setBuilderLiteralText('');
    setBuilderTypeLocked(null);
    setBuilderPatchMode(false);
    setBuilderPatchOp(null);
    setBuilderSwitchModal({ open: false });
    setBuilderOpen(false);
    resetBuilderHistory(null);
  };

  const canUndoBuilder = builderUndoStack.length > 1;
  const canRedoBuilder = builderRedoStack.length > 0;

  const handleBuilderUndo = () => {
    if (!canUndoBuilder) {
      return;
    }
    builderHistoryBusyRef.current = true;
    const nextUndo = [...builderUndoStack];
    const current = nextUndo.pop();
    const previous = nextUndo[nextUndo.length - 1];
    setBuilderUndoStack(nextUndo);
    if (current) {
      setBuilderRedoStack((prev) => [current, ...prev]);
    }
    if (previous) {
      applyBuilderSnapshot(previous);
      builderHistorySigRef.current = JSON.stringify(previous);
    }
    builderHistoryBusyRef.current = false;
  };

  const handleBuilderRedo = () => {
    if (!canRedoBuilder) {
      return;
    }
    builderHistoryBusyRef.current = true;
    const nextRedo = [...builderRedoStack];
    const next = nextRedo.shift();
    setBuilderRedoStack(nextRedo);
    if (next) {
      setBuilderUndoStack((prev) => {
        const updated = [...prev, next];
        if (updated.length > BUILDER_HISTORY_LIMIT) {
          updated.shift();
        }
        return updated;
      });
      applyBuilderSnapshot(next);
      builderHistorySigRef.current = JSON.stringify(next);
    }
    builderHistoryBusyRef.current = false;
  };

  useEffect(() => {
    if (!builderTarget) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleBuilderRedo();
        } else {
          handleBuilderUndo();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [builderTarget, canUndoBuilder, canRedoBuilder, builderUndoStack, builderRedoStack]);

  useEffect(() => {
    if (!builderTarget) {
      resetBuilderHistory(null);
      return;
    }
    if (!builderHistoryInitRef.current) {
      return;
    }
    const snapshot = createBuilderSnapshot();
    resetBuilderHistory(snapshot);
    builderDirtySigRef.current = JSON.stringify(snapshot);
    builderHistoryInitRef.current = false;
  }, [builderTarget, builderFocus, builderMode, processorType, processorStep, builderTypeLocked]);

  useEffect(() => {
    if (!builderTarget) {
      return;
    }
    if (builderHistoryBusyRef.current || builderHistoryInitRef.current) {
      return;
    }
    const snapshot = createBuilderSnapshot();
    const sig = JSON.stringify(snapshot);
    if (sig === builderHistorySigRef.current) {
      return;
    }
    setBuilderUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > BUILDER_HISTORY_LIMIT) {
        next.shift();
      }
      return next;
    });
    setBuilderRedoStack([]);
    builderHistorySigRef.current = sig;
  }, [
    builderTarget,
    builderFocus,
    builderTypeLocked,
    builderMode,
    processorStep,
    processorType,
    builderLiteralText,
    builderRegularText,
    builderConditions,
    builderElseResult,
    builderProcessorConfig,
    builderNestedAddType,
    builderSwitchCaseAddType,
    builderSwitchDefaultAddType,
    showProcessorJson,
  ]);

  const applyBuilderTypeSwitch = (target: 'eval' | 'processor' | 'literal') => {
    if (!builderTarget) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    if (target === 'literal') {
      setBuilderLiteralText(getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field));
      setBuilderFocus('literal');
    }
    if (target === 'eval') {
      const baseValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
      setBuilderMode('friendly');
      setBuilderRegularText(baseValue);
      setBuilderFocus('eval');
    }
    if (target === 'processor') {
      setProcessorStep('select');
      setProcessorType(null);
      setBuilderFocus('processor');
    }
    setBuilderTypeLocked(target);
  };

  const getObjectByPanelKey = (panelKey: string) => {
    const baseKey = panelKey.includes(':')
      ? panelKey.slice(0, panelKey.lastIndexOf(':'))
      : panelKey;
    const objects = getFriendlyObjects(fileData);
    for (let idx = 0; idx < objects.length; idx += 1) {
      if (getObjectKey(objects[idx], idx) === baseKey) {
        return objects[idx];
      }
    }
    return null;
  };

  const _getObjectByName = (objectName?: string | null) => {
    if (!objectName) {
      return null;
    }
    return getFriendlyObjects(fileData).find((item) => item['@objectName'] === objectName) || null;
  };

  const normalizeTargetField = (value: string, fallbackField?: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('$.')) {
      return trimmed;
    }
    if (!trimmed && fallbackField) {
      return `$.event.${fallbackField}`;
    }
    return `$.event.${trimmed}`;
  };

  const normalizeSourcePath = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('$.')) {
      return trimmed;
    }
    if (!trimmed) {
      return '';
    }
    return `$.event.${trimmed}`;
  };

  const asConfigString = (value: unknown) => (typeof value === 'string' ? value : '');

  const getBuilderProcessorConfig = () => {
    const targetField = normalizeTargetField(
      asConfigString(builderProcessorConfig.targetField),
      builderTarget?.field,
    );
    return {
      ...builderProcessorConfig,
      targetField,
    };
  };

  const getDefaultProcessorConfig = (processorType: string, fallbackTarget?: string) => {
    const specs = processorConfigSpecs[processorType] || [];
    const defaults: Record<string, any> = {};
    specs.forEach((spec) => {
      if (spec.type === 'select') {
        defaults[spec.key] = spec.options?.[0]?.value ?? '';
        return;
      }
      defaults[spec.key] = '';
    });
    if (processorType === 'regex') {
      defaults.sourceType = 'path';
    }
    if (processorType === 'set') {
      defaults.sourceType = 'literal';
    }
    if (fallbackTarget && specs.some((spec) => spec.key === 'targetField')) {
      defaults.targetField = fallbackTarget;
    }
    return defaults;
  };

  const formatProcessorConfigValue = (value: any) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const buildBuilderConfigFromProcessor = (
    processor: any,
    fallbackTarget: string,
  ): { type: string; config: Record<string, any> } | null => {
    const type = getProcessorType(processor);
    if (!type) {
      return null;
    }
    const payload = processor?.[type] || {};
    const specs = processorConfigSpecs[type] || [];
    const config: Record<string, any> = {
      ...getDefaultProcessorConfig(type, fallbackTarget),
    };
    specs.forEach((spec) => {
      if (spec.key === 'sourceType') {
        const sourceValue = payload.source;
        if (typeof sourceValue === 'string') {
          config.sourceType = sourceValue.startsWith('$.') ? 'path' : 'literal';
        } else if (sourceValue !== undefined) {
          config.sourceType = 'literal';
        }
        return;
      }
      if (spec.type === 'json') {
        if (payload?.[spec.key] !== undefined) {
          const rawValue = payload[spec.key];
          config[`${spec.key}Text`] =
            typeof rawValue === 'string' ? rawValue : formatProcessorConfigValue(rawValue);
        }
        return;
      }
      if (payload?.[spec.key] !== undefined) {
        config[spec.key] =
          spec.type === 'boolean'
            ? Boolean(payload[spec.key])
            : formatProcessorConfigValue(payload[spec.key]);
      }
    });
    if (type === 'foreach') {
      config.processors = buildFlowNodesFromProcessors(
        Array.isArray(payload.processors) ? payload.processors : [],
      );
    }
    if (type === 'switch') {
      const cases = Array.isArray(payload.case) ? payload.case : [];
      config.cases = cases.map((item: any) => ({
        id: nextSwitchCaseId(),
        match: formatProcessorConfigValue(item?.match ?? ''),
        operator: formatProcessorConfigValue(item?.operator ?? ''),
        processors: buildFlowNodesFromProcessors(Array.isArray(item?.then) ? item.then : []),
      }));
      config.defaultProcessors = buildFlowNodesFromProcessors(
        Array.isArray(payload.default) ? payload.default : [],
      );
    }
    return { type, config };
  };

  const buildProcessorPayload = () => {
    if (!processorType || !builderTarget) {
      return null;
    }
    return buildProcessorPayloadFromConfig(
      processorType,
      getBuilderProcessorConfig(),
      buildFlowProcessors,
    );
  };

  const processorCatalog: ProcessorCatalogItem[] = [
    {
      id: 'set',
      label: 'Set',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'set',
    },
    {
      id: 'regex',
      label: 'Regex',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'regex',
    },
    {
      id: 'if',
      label: 'If',
      paletteLabel: 'If (Flow)',
      nodeKind: 'if',
      status: 'testing',
      builderEnabled: false,
      helpKey: 'if',
    },
    {
      id: 'append',
      label: 'Append',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'append',
    },
    {
      id: 'appendToOutputStream',
      label: 'Append to Output Stream',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'appendToOutputStream',
    },
    {
      id: 'break',
      label: 'Break',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'break',
    },
    {
      id: 'convert',
      label: 'Convert',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'convert',
    },
    {
      id: 'copy',
      label: 'Copy',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'copy',
    },
    {
      id: 'discard',
      label: 'Discard',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'discard',
    },
    {
      id: 'eval',
      label: 'Eval',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'eval',
    },
    {
      id: 'foreach',
      label: 'Foreach',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'foreach',
    },
    {
      id: 'grok',
      label: 'Grok',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'grok',
    },
    {
      id: 'json',
      label: 'JSON',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'json',
    },
    {
      id: 'log',
      label: 'Log',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'log',
    },
    {
      id: 'lookup',
      label: 'Lookup',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'lookup',
    },
    {
      id: 'math',
      label: 'Math',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'math',
    },
    {
      id: 'remove',
      label: 'Remove',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'remove',
    },
    {
      id: 'rename',
      label: 'Rename',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'rename',
    },
    {
      id: 'replace',
      label: 'Replace',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'replace',
    },
    {
      id: 'setOutputStream',
      label: 'Set Output Stream',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'setOutputStream',
    },
    {
      id: 'sort',
      label: 'Sort',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'sort',
    },
    {
      id: 'split',
      label: 'Split',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'split',
    },
    {
      id: 'strcase',
      label: 'String Case',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'strcase',
    },
    {
      id: 'substr',
      label: 'Substring',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'substr',
    },
    {
      id: 'switch',
      label: 'Switch',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'switch',
    },
    {
      id: 'trim',
      label: 'Trim',
      nodeKind: 'processor',
      status: 'testing',
      builderEnabled: true,
      helpKey: 'trim',
    },
  ];

  const flowPalette: FlowPaletteItem[] = processorCatalog.map((item) => ({
    label: item.paletteLabel || item.label,
    nodeKind: item.nodeKind,
    processorType: item.nodeKind === 'processor' ? item.id : undefined,
    status: item.status,
  }));
  const paletteSearch = advancedProcessorSearch.trim().toLowerCase();
  const filteredFlowPalette = flowPalette.filter((item) =>
    item.label.toLowerCase().includes(paletteSearch),
  );
  const paletteSections = [
    { title: 'Working', status: 'working' as const },
    { title: 'Testing', status: 'testing' as const },
    { title: 'Planned', status: 'planned' as const },
  ].map((section) => ({
    ...section,
    items: filteredFlowPalette.filter((item) => item.status === section.status),
  }));
  const builderPaletteItems = flowPalette.filter((item) => item.status !== 'planned');

  const getFlowNodeLabel = (node: FlowNode) => {
    if (node.kind === 'if') {
      return 'If';
    }
    const item = flowPalette.find((entry) => entry.processorType === node.processorType);
    const baseLabel = item?.label || node.processorType;
    const processorPayload = buildProcessorPayloadFromConfig(
      node.processorType,
      node.config || {},
      buildFlowProcessors,
    );
    const targetField = getProcessorTargetField(processorPayload);
    if (!targetField) {
      return `${baseLabel} (no target)`;
    }
    const trimmed = String(targetField).trim();
    const label = trimmed.startsWith('$.event.')
      ? trimmed.replace('$.event.', '')
      : trimmed.startsWith('$.localmem.')
        ? trimmed.replace('$.localmem.', 'localmem.')
        : trimmed.startsWith('$.globalmem.')
          ? trimmed.replace('$.globalmem.', 'globalmem.')
          : trimmed.replace('$.', '');
    return `${baseLabel} (${label || 'no target'})`;
  };

  const getFlowNodeTargetField = (node: FlowNode) => {
    if (node.kind !== 'processor') {
      return null;
    }
    const processorPayload = buildProcessorPayloadFromConfig(
      node.processorType,
      node.config || {},
      buildFlowProcessors,
    );
    return getProcessorTargetField(processorPayload);
  };

  const nodeMatchesFocusTarget = (node: FlowNode, target: string | null): boolean => {
    if (!target) {
      return false;
    }
    if (node.kind === 'processor') {
      return getFlowNodeTargetField(node) === target;
    }
    return (
      node.then.some((child) => nodeMatchesFocusTarget(child, target)) ||
      node.else.some((child) => nodeMatchesFocusTarget(child, target))
    );
  };

  const getProcessorCatalogLabel = (id: string | null) => {
    if (!id) {
      return '';
    }
    const item = processorCatalog.find((entry) => entry.id === id);
    return item?.label || id;
  };

  const handleFlowDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleFlowDrop = (
    event: React.DragEvent<HTMLElement>,
    path: FlowBranchPath,
    setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const payloadRaw =
      event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    if (!payloadRaw) {
      return;
    }
    let payload: any = null;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') {
      return;
    }
    if (payload.source === 'palette') {
      const newNode = createFlowNode(payload);
      setNodes((prev) => {
        const next = appendNodeAtPath(prev, path, newNode);
        const errorMap: FlowNodeErrorMap = {};
        validateFlowNode(newNode, lane, errorMap);
        if (errorMap[newNode.id]?.length) {
          openFlowEditor(newNode.id, scope, lane, next, setNodes);
        }
        return next;
      });
      return;
    }
    if (payload.source === 'flow' && payload.nodeId) {
      setNodes((prev) => {
        const { nodes, removed } = removeNodeById(prev, payload.nodeId);
        if (!removed) {
          return prev;
        }
        return appendNodeAtPath(nodes, path, removed);
      });
    }
  };

  const renderFlowList = (
    nodes: FlowNode[],
    path: FlowBranchPath,
    setNodes: React.Dispatch<React.SetStateAction<FlowNode[]>>,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
    nodeErrorsMap?: FlowNodeErrorMap,
    versionInfo?: {
      mode: 'none' | 'v2' | 'v3' | 'mixed';
      label: string;
      detail: string;
    } | null,
  ) => (
    <FlowCanvas
      nodes={nodes}
      path={path}
      setNodes={setNodes}
      scope={scope}
      lane={lane}
      nodeErrorsMap={nodeErrorsMap}
      versionInfo={versionInfo}
      focusTarget={advancedFlowFocusTarget}
      getFlowNodeLabel={getFlowNodeLabel}
      nodeMatchesFocusTarget={nodeMatchesFocusTarget}
      onDragOver={handleFlowDragOver}
      onDrop={handleFlowDrop}
      onOpenEditor={openFlowEditor}
    />
  );

  const applyProcessor = () => {
    if (!builderTarget) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj || !selectedFile) {
      return;
    }
    const processor = buildProcessorPayload();
    if (!processor) {
      return;
    }
    const objectName = getObjectNameValue(obj);
    if (!objectName) {
      return;
    }
    const existingOverrides = [...getBaseOverrides()];
    const baseOverrides = pendingOverrideSave ? [...pendingOverrideSave] : existingOverrides;
    const method = getOverrideMethod();
    const scope = 'post';
    const matchIndex = baseOverrides.findIndex(
      (entry: unknown) =>
        isRecord(entry) &&
        entry['@objectName'] === objectName &&
        entry.method === method &&
        entry.scope === scope,
    );
    const overrideEntry =
      matchIndex >= 0
        ? { ...baseOverrides[matchIndex] }
        : {
            name: `${objectName} Override`,
            description: `Overrides for ${objectName}`,
            domain: 'fault',
            method,
            scope,
            '@objectName': objectName,
            _type: 'override',
            version: 'v3',
            processors: [],
          };
    let processors = Array.isArray(overrideEntry.processors) ? [...overrideEntry.processors] : [];
    const hasNonPatch = processors.some((proc: any) => !(proc?.op && proc?.path));
    if (hasNonPatch) {
      setSaveError('Advanced processors are not supported in v3 override files yet.');
      return;
    }
    if (!overrideEntry.version) {
      overrideEntry.version = 'v3';
    }

    const patchOp = (() => {
      const setPayload = getSetPayload(processor);
      const targetField = typeof setPayload?.targetField === 'string' ? setPayload.targetField : '';
      if (targetField.startsWith('$.event.')) {
        const field = targetField.replace('$.event.', '');
        return buildOverridePatchOp(objectName, field, setPayload?.source);
      }
      return null;
    })();
    if (!patchOp) {
      setSaveError('Only event field set operations are supported in v3 overrides.');
      return;
    }

    const targetField = getPatchTargetField(patchOp);
    if (targetField) {
      processors = processors.filter((proc: any) => getPatchTargetField(proc) !== targetField);
    }
    processors.push(patchOp);
    overrideEntry.processors = processors;
    if (matchIndex >= 0) {
      baseOverrides[matchIndex] = overrideEntry;
    } else {
      baseOverrides.push(overrideEntry);
    }
    setPendingOverrideSave(baseOverrides);
    triggerToast(`Staged 1 processor override for ${objectName}`, true);
    setProcessorStep('review');
    closeBuilder();
  };

  const processorHelp: Record<string, { title: string; description: string; example: string }> = {
    append: {
      title: 'Append',
      description: 'Append a value to an array or concatenate text into a target field (planned).',
      example:
        '{"append": {"source": "Example Value", "array": [], "targetField": "$.event.NewArray"}}',
    },
    appendToOutputStream: {
      title: 'Append to Output Stream',
      description: 'Append data to a configured output stream (planned).',
      example:
        '{"appendToOutputStream": {"source": "$.trap", "output": "pulsar+ssl:///assure1/event/sink"}}',
    },
    break: {
      title: 'Break',
      description: 'Stop processing the current processor chain (planned).',
      example: '{"break": {}}',
    },
    convert: {
      title: 'Convert',
      description: 'Convert a value from one type/format to another (planned).',
      example:
        '{"convert": {"source": "$.event.Count", "type": "inttostring", "targetField": "$.event.CountString", "ignoreFailure": true}}',
    },
    copy: {
      title: 'Copy',
      description: 'Copy a value from one field to another (planned).',
      example: '{"copy": {"source": "$.event.Count", "targetField": "$.event.CopiedCount"}}',
    },
    discard: {
      title: 'Discard',
      description: 'Discard the event or processing result (planned).',
      example: '{"discard": {}}',
    },
    eval: {
      title: 'Eval',
      description: 'Evaluate a JavaScript expression and store the result (planned).',
      example: '{"eval": {"source": "<expression>", "targetField": "$.localmem.evalResult"}}',
    },
    foreach: {
      title: 'Foreach',
      description: 'Iterate over an array/object and run processors for each item (planned).',
      example:
        '{"foreach": {"source": "$.event.Details.trap.variables", "keyVal": "i", "valField": "v", "processors": []}}',
    },
    grok: {
      title: 'Grok',
      description: 'Parse text using Grok patterns and store extracted values (planned).',
      example:
        '{"grok": {"source": "$.syslog.datagram", "pattern": "%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}", "targetField": "$.syslog.variables"}}',
    },
    if: {
      title: 'If',
      description: 'Conditionally run processors based on a single condition (planned).',
      example:
        '{"if": {"source": "$.event.EventCategory", "operator": "==", "value": 3, "processors": [], "else": []}}',
    },
    json: {
      title: 'JSON',
      description: 'Parse a JSON string and store the result (planned).',
      example: '{"json": {"source": "{\"key\":\"value\"}", "targetField": "$.localmem.json"}}',
    },
    log: {
      title: 'Log',
      description: 'Write a message to the processor log (planned).',
      example: '{"log": {"type": "info", "source": "Log message"}}',
    },
    lookup: {
      title: 'Lookup',
      description: 'Lookup data from a source and store it in a target field (planned).',
      example:
        '{"lookup": {"source": "db", "properties": {}, "fallback": {}, "targetField": "$.localmem.results"}}',
    },
    math: {
      title: 'Math',
      description: 'Apply arithmetic to a numeric source and store the result (planned).',
      example:
        '{"math": {"source": "$.event.Count", "operation": "*", "value": 2, "targetField": "$.localmem.CountTimesTwo"}}',
    },
    regex: {
      title: 'Regex',
      description:
        'Extract a value from text using a regular expression capture group and store it in a target field.',
      example:
        '{"regex": {"source": "Events are cleared", "pattern": "Events are (?<text>.*$)", "targetField": ""}}',
    },
    remove: {
      title: 'Remove',
      description: 'Remove a field from the payload (planned).',
      example: '{"remove": {"source": "$.trap.timeTicks"}}',
    },
    rename: {
      title: 'Rename',
      description: 'Rename or move a field to a new target (planned).',
      example: '{"rename": {"source": "$.event.Details", "targetField": "$.event.DetailsOld"}}',
    },
    replace: {
      title: 'Replace',
      description: 'Replace text in a source string (planned).',
      example:
        '{"replace": {"source": "This is a test", "pattern": "a test", "replacement": "not a test", "targetField": "$.localmem.example"}}',
    },
    set: {
      title: 'Set',
      description:
        'Set a target field to a literal value or another field path. Useful for overrides or copying values.',
      example:
        '{"set": {"source": "$.event.%s", "args": ["Details"], "targetField": "$.event.Details2"}}',
    },
    setOutputStream: {
      title: 'Set Output Stream',
      description: 'Change the output stream for the event (planned).',
      example: '{"setOutputStream": {"output": "pulsar+ssl:///assure1/event/sink"}}',
    },
    sort: {
      title: 'Sort',
      description: 'Sort an array or list and store it (planned).',
      example: '{"sort": {"source": "$.trap.variables", "targetField": "$.trap.sortedVariables"}}',
    },
    split: {
      title: 'Split',
      description: 'Split a string using a delimiter (planned).',
      example:
        '{"split": {"source": "1,2,3,4", "delimiter": ",", "targetField": "$.localmem.splitarr"}}',
    },
    strcase: {
      title: 'String Case',
      description: 'Change the case of a string (planned).',
      example:
        '{"strcase": {"source": "HELLO, WORLD", "type": "lower", "targetField": "$.localmem.lowercase"}}',
    },
    substr: {
      title: 'Substring',
      description: 'Extract a substring from a source value (planned).',
      example: '{"substr": {"source": "Hello", "start": 1, "targetField": "$.localmem.substr"}}',
    },
    switch: {
      title: 'Switch',
      description: 'Branch processors based on matching cases (planned).',
      example:
        '{"switch": {"source": "$.localmem.val1", "operator": "!=", "case": [{"match": 2, "then": [{"discard": {}}]}, {"match": 5, "operator": "==", "then": [{"discard": {}}]}], "default": [{"log": {"type": "info", "source": "Do nothing since none of the cases were met"}}]}}',
    },
    trim: {
      title: 'Trim',
      description: 'Trim characters from a source string (planned).',
      example: '{"trim": {"source": "Hello", "cutset": "H", "targetField": "$.localmem.trim"}}',
    },
  };

  const renderProcessorHelp = (key: keyof typeof processorHelp) => {
    const help = processorHelp[key];
    return (
      <span
        className="processor-help"
        tabIndex={0}
        role="button"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setProcessorTooltip({
            title: help.title,
            description: help.description,
            example: help.example,
            x: rect.left + rect.width / 2,
            y: rect.bottom + 8,
          });
        }}
        onMouseLeave={() => setProcessorTooltip(null)}
        onFocus={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setProcessorTooltip({
            title: help.title,
            description: help.description,
            example: help.example,
            x: rect.left + rect.width / 2,
            y: rect.bottom + 8,
          });
        }}
        onBlur={() => setProcessorTooltip(null)}
      >
        <span className="processor-help-icon">?</span>
      </span>
    );
  };

  const applyBuilderTemplate = (template: string) => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    setBuilderRegularText(template);
  };

  const hasGlobalAdvancedFlow = (() => {
    const method = getOverrideMethod();
    const preEntry = getOverrideEntry({ scope: 'pre', method });
    const postEntry = getOverrideEntry({ scope: 'post', method });
    const preCount = Array.isArray(preEntry?.processors) ? preEntry.processors.length : 0;
    const postCount = Array.isArray(postEntry?.processors) ? postEntry.processors.length : 0;
    return preCount + postCount > 0;
  })();

  const advancedFlowDirty = (() => {
    if (!advancedFlowBaseline) {
      return false;
    }
    if (advancedFlowBaseline.scope === 'global') {
      const pre = JSON.stringify(buildFlowProcessors(globalPreFlow));
      const post = JSON.stringify(buildFlowProcessors(globalPostFlow));
      return pre !== (advancedFlowBaseline.pre || '') || post !== (advancedFlowBaseline.post || '');
    }
    const object = JSON.stringify(buildFlowProcessors(advancedFlow));
    return object !== (advancedFlowBaseline.object || '');
  })();

  const requestCloseAdvancedFlowModal = () => {
    if (advancedFlowDirty) {
      setPendingAdvancedFlowClose(true);
      return;
    }
    setShowAdvancedProcessorModal(false);
    setFlowEditor(null);
    setFlowEditorDraft(null);
    setAdvancedFlowDefaultTarget(null);
  };

  const focusedFlowMatches = useMemo(() => {
    if (!advancedFlowFocusTarget) {
      return [] as FocusMatch[];
    }
    if (advancedProcessorScope === 'global') {
      const prePayloads = buildFlowProcessors(globalPreFlow);
      const postPayloads = buildFlowProcessors(globalPostFlow);
      return [
        ...collectFocusMatches(prePayloads, advancedFlowFocusTarget, 'pre', getProcessorTargetField),
        ...collectFocusMatches(postPayloads, advancedFlowFocusTarget, 'post', getProcessorTargetField),
      ];
    }
    const objectPayloads = buildFlowProcessors(advancedFlow);
    return collectFocusMatches(objectPayloads, advancedFlowFocusTarget, 'object', getProcessorTargetField);
  }, [
    advancedFlowFocusTarget,
    advancedProcessorScope,
    advancedFlow,
    globalPreFlow,
    globalPostFlow,
  ]);

  const flowValidation = useMemo(() => {
    if (advancedProcessorScope === 'global') {
      return {
        pre: validateFlowNodes(globalPreFlow, 'pre'),
        post: validateFlowNodes(globalPostFlow, 'post'),
        object: {} as FlowNodeErrorMap,
      };
    }
    return {
      pre: {} as FlowNodeErrorMap,
      post: {} as FlowNodeErrorMap,
      object: validateFlowNodes(advancedFlow, 'object'),
    };
  }, [advancedProcessorScope, globalPreFlow, globalPostFlow, advancedFlow]);

  const flowErrorCount =
    Object.keys(flowValidation.pre).length +
    Object.keys(flowValidation.post).length +
    Object.keys(flowValidation.object).length;

  const focusedFlowMatch = focusedFlowMatches[advancedFlowFocusIndex] || null;

  useEffect(() => {
    if (advancedFlowFocusIndex >= focusedFlowMatches.length) {
      setAdvancedFlowFocusIndex(0);
    }
  }, [advancedFlowFocusIndex, focusedFlowMatches.length]);

  useEffect(() => {
    if (!showAdvancedProcessorModal || !focusedFlowMatch) {
      return;
    }
    window.setTimeout(() => {
      advancedFlowHighlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, [showAdvancedProcessorModal, focusedFlowMatch, advancedFlowFocusIndex]);

  const baseOverrides = getBaseOverrides();
  const workingOverrides = getWorkingOverrides();
  const stagedDiff = diffOverrides(baseOverrides, workingOverrides);
  const hasStagedChanges = stagedDiff.totalChanges > 0;
  useEffect(() => {
    if (!hasStagedChanges || !hasEditPermission) {
      if (reviewPulseIntervalRef.current) {
        window.clearInterval(reviewPulseIntervalRef.current);
        reviewPulseIntervalRef.current = null;
      }
      if (reviewPulseTimeoutRef.current) {
        window.clearTimeout(reviewPulseTimeoutRef.current);
        reviewPulseTimeoutRef.current = null;
      }
      stagedPulseActiveRef.current = false;
      setReviewCtaPulse(false);
      return;
    }

    const triggerPulse = () => {
      setReviewCtaPulse(true);
      if (reviewPulseTimeoutRef.current) {
        window.clearTimeout(reviewPulseTimeoutRef.current);
      }
      reviewPulseTimeoutRef.current = window.setTimeout(() => {
        setReviewCtaPulse(false);
      }, 1400);
    };

    if (!stagedPulseActiveRef.current) {
      triggerPulse();
      stagedPulseActiveRef.current = true;
    }

    if (!reviewPulseIntervalRef.current) {
      reviewPulseIntervalRef.current = window.setInterval(triggerPulse, 6000);
    }

    return () => {
      if (reviewPulseIntervalRef.current) {
        window.clearInterval(reviewPulseIntervalRef.current);
        reviewPulseIntervalRef.current = null;
      }
      if (reviewPulseTimeoutRef.current) {
        window.clearTimeout(reviewPulseTimeoutRef.current);
        reviewPulseTimeoutRef.current = null;
      }
      stagedPulseActiveRef.current = false;
      setReviewCtaPulse(false);
    };
  }, [hasStagedChanges, hasEditPermission]);
  const stagedFieldChangeMap = useMemo(() => {
    const map = new Map<string, Map<string, 'added' | 'updated' | 'removed'>>();
    stagedDiff.sections.forEach((section) => {
      const objectName = section.objectName;
      if (!objectName) {
        return;
      }
      section.fieldChanges.forEach((change) => {
        const target = change.target ?? '';
        if (!target.startsWith('$.event.')) {
          return;
        }
        const field = target.replace('$.event.', '');
        const fieldMap = map.get(objectName) || new Map<string, 'added' | 'updated' | 'removed'>();
        fieldMap.set(field, change.action);
        map.set(objectName, fieldMap);
      });
    });
    return map;
  }, [stagedDiff.sections]);
  const getStagedDirtyFields = (obj: unknown) => {
    const objectName = getObjectNameValue(obj);
    if (!objectName) {
      return [] as string[];
    }
    return Array.from(stagedFieldChangeMap.get(objectName)?.keys() || []);
  };
  const getStagedFieldChange = (obj: unknown, field: string) => {
    const objectName = getObjectNameValue(obj);
    if (!objectName) {
      return undefined;
    }
    return stagedFieldChangeMap.get(objectName)?.get(field);
  };
  const isFieldStagedDirty = (obj: unknown, field: string) =>
    Boolean(getStagedFieldChange(obj, field));
  const isFieldStagedRemoved = (obj: unknown, field: string) =>
    getStagedFieldChange(obj, field) === 'removed';
  const formatDiffValue = (value: unknown) =>
    value === undefined ? '' : JSON.stringify(value, null, 2);

  const diffLines = (beforeText: string, afterText: string) => {
    const beforeLines = beforeText === '' ? [] : beforeText.split('\n');
    const afterLines = afterText === '' ? [] : afterText.split('\n');
    const beforeCount = beforeLines.length;
    const afterCount = afterLines.length;
    const dp: number[][] = Array.from({ length: beforeCount + 1 }, () =>
      Array(afterCount + 1).fill(0),
    );

    for (let i = beforeCount - 1; i >= 0; i -= 1) {
      for (let j = afterCount - 1; j >= 0; j -= 1) {
        if (beforeLines[i] === afterLines[j]) {
          dp[i][j] = dp[i + 1][j + 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
    }

    const output: { type: 'equal' | 'add' | 'remove'; value: string }[] = [];
    let i = 0;
    let j = 0;
    while (i < beforeCount || j < afterCount) {
      if (i < beforeCount && j < afterCount && beforeLines[i] === afterLines[j]) {
        output.push({ type: 'equal', value: beforeLines[i] });
        i += 1;
        j += 1;
      } else if (j < afterCount && (i === beforeCount || dp[i][j + 1] >= dp[i + 1][j])) {
        output.push({ type: 'add', value: afterLines[j] });
        j += 1;
      } else if (i < beforeCount) {
        output.push({ type: 'remove', value: beforeLines[i] });
        i += 1;
      }
    }
    return output;
  };

  const renderInlineDiff = (beforeValue: unknown, afterValue: unknown, mode: 'after' | 'original') => {
    const beforeText = formatDiffValue(beforeValue);
    const afterText = formatDiffValue(afterValue);
    const lines = diffLines(beforeText, afterText);
    const filtered = lines.filter((line) =>
      mode === 'after' ? line.type !== 'remove' : line.type !== 'add',
    );
    return filtered.map((line, idx) => {
      const prefix =
        mode === 'after' ? (line.type === 'add' ? '+' : ' ') : line.type === 'remove' ? '-' : ' ';
      return (
        <span key={`${mode}-${idx}-${line.type}`} className={`diff-line diff-line-${line.type}`}>
          <span className="diff-line-prefix">{prefix}</span>
          {line.value === '' ? ' ' : line.value}
        </span>
      );
    });
  };

  useEffect(() => {
    const dirtyMap = getPanelDirtyMap();
    unsavedChangesRef.current = Object.keys(dirtyMap).length > 0 || hasStagedChanges;
  }, [hasStagedChanges, panelEditState, panelDrafts, panelOverrideRemovals, fileData]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!unsavedChangesRef.current) {
        return undefined;
      }
      event.preventDefault();
      event.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.onbeforeunload = handleBeforeUnload;
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (window.onbeforeunload === handleBeforeUnload) {
        window.onbeforeunload = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!showReviewModal || reviewStep !== 'review') {
      reviewModalOpenRef.current = false;
      return;
    }
    if (reviewModalOpenRef.current) {
      return;
    }
    reviewModalOpenRef.current = true;
    const openByDefault = stagedDiff.sections.length === 1;
    const next: Record<string, boolean> = {};
    stagedDiff.sections.forEach((section) => {
      next[section.title] = openByDefault;
    });
    setStagedSectionOpen(next);
    setExpandedOriginals({});
  }, [showReviewModal, reviewStep, stagedDiff.sections]);

  const { openAdvancedFlowModal: openAdvancedFlowModalInternal, saveAdvancedFlow } =
    useAdvancedFlowOrchestration({
      selectedFile,
      builderTarget,
      getObjectByPanelKey,
      getOverrideMethod,
      getOverrideEntry,
      buildFlowNodesFromProcessors,
      buildFlowProcessors,
      setAdvancedFlowNotice,
      setShowAdvancedFlowJsonPreview,
      setSaveError,
      setGlobalPreFlow,
      setGlobalPostFlow,
      setAdvancedFlow,
      setAdvancedFlowBaseline,
      setAdvancedFlowTarget,
      setAdvancedProcessorScope,
      setAdvancedProcessorSearch,
      setAdvancedFlowFocusTarget,
      setAdvancedFlowFocusIndex,
      setAdvancedFlowFocusOnly,
      setAdvancedFlowDefaultTarget,
      setFlowEditor: () => setFlowEditor(null),
      setFlowEditorDraft: () => setFlowEditorDraft(null),
      ensureEditPermission,
      advancedFlowTarget,
      pendingOverrideSave,
      getBaseOverrides,
      advancedProcessorScope,
      globalPreFlow,
      globalPostFlow,
      advancedFlow,
      setPendingOverrideSave,
      triggerToast,
    });

  const openAdvancedFlowModal: (
    scope: 'object' | 'global',
    objectNameOverride?: string | null,
    focusTargetField?: string | null,
  ) => void = (scope, objectNameOverride, focusTargetField) => {
    const opened = openAdvancedFlowModalInternal(scope, objectNameOverride, focusTargetField);
    if (opened) {
      setShowAdvancedProcessorModal(true);
    }
  };

  const advancedFlowPatchPreview = useMemo(() => {
    if (!advancedFlowTarget?.objectName) {
      return null;
    }
    const pendingConversion = getPendingOverrideConversion(advancedFlowTarget.objectName);
    if (pendingConversion?.entry) {
      return JSON.stringify(pendingConversion.entry, null, 2);
    }
    const method = advancedFlowTarget.method || getOverrideMethod();
    const entry = getOverrideEntry({
      objectName: advancedFlowTarget.objectName,
      scope: 'post',
      method,
    });
    if (!entry) {
      return null;
    }
    const processors = Array.isArray(entry?.processors) ? entry.processors : [];
    if (!hasPatchOps(processors) && entry?.version !== 'v3') {
      return null;
    }
    return JSON.stringify(entry, null, 2);
  }, [advancedFlowTarget, overrideInfo, pendingOverrideSave, pendingOverrideConversions, selectedFile]);

  const handleBuilderSelect = (item: ProcessorCatalogItem, isEnabled: boolean) => {
    if (!isEnabled) {
      return;
    }
    if (item.id === 'if') {
      setSaveError('Advanced flow processors are not supported in v3 override files yet.');
      return;
    }
    if (item.id === 'set') {
      setProcessorType('set');
      setProcessorStep('configure');
      setBuilderProcessorConfig((prev) => ({
        ...prev,
        ...getDefaultProcessorConfig(
          'set',
          builderTarget ? `$.event.${builderTarget.field}` : asConfigString(prev.targetField),
        ),
      }));
      return;
    }
    if (item.id === 'regex') {
      setProcessorType('regex');
      setProcessorStep('configure');
      setBuilderProcessorConfig((prev) => ({
        ...prev,
        ...getDefaultProcessorConfig(
          'regex',
          builderTarget ? `$.event.${builderTarget.field}` : asConfigString(prev.targetField),
        ),
      }));
      return;
    }
    setProcessorType(item.id);
    setProcessorStep('configure');
    setBuilderProcessorConfig((prev) => ({
      ...prev,
      ...getDefaultProcessorConfig(
        item.id,
        builderTarget ? `$.event.${builderTarget.field}` : asConfigString(prev.targetField),
      ),
      ...(item.id === 'foreach' ? { processors: [] } : {}),
      ...(item.id === 'switch'
        ? {
            cases: [
              {
                id: nextSwitchCaseId(),
                match: '',
                operator: '',
                processors: [],
              },
            ],
            defaultProcessors: [],
          }
        : {}),
    }));
  };

  useEffect(() => {
    if (!builderTarget) {
      return;
    }
    const compiled = buildFriendlyEval();
    if (!compiled) {
      return;
    }
    if (builderSyncRef.current === 'regular') {
      builderSyncRef.current = null;
      return;
    }
    if (compiled.trim() === builderRegularText.trim()) {
      return;
    }
    builderSyncRef.current = 'friendly';
    setBuilderRegularText(compiled);
  }, [builderConditions, builderElseResult]);

  useEffect(() => {
    if (!builderTarget) {
      return;
    }
    const text = builderRegularText.trim();
    if (!text) {
      return;
    }
    if (builderSyncRef.current === 'friendly') {
      builderSyncRef.current = null;
      return;
    }
    const parsed = parseEvalToRows(text);
    if (!parsed) {
      return;
    }
    builderSyncRef.current = 'regular';
    setBuilderConditions(parsed.rows);
    setBuilderElseResult(parsed.elseResult);
  }, [builderRegularText]);

  const updateConditionNode = (
    node: ConditionTree,
    targetId: string,
    updater: (current: ConditionTree) => ConditionTree,
  ): ConditionTree => {
    if (node.id === targetId) {
      return updater(node);
    }
    if (node.type === 'group') {
      return {
        ...node,
        children: node.children.map((child) => updateConditionNode(child, targetId, updater)),
      };
    }
    return node;
  };

  const updateBuilderCondition = (
    rowId: string,
    nodeId: string,
    key: 'left' | 'operator' | 'right',
    value: string,
  ) => {
    setBuilderConditions((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              condition: updateConditionNode(row.condition, nodeId, (current) =>
                current.type === 'condition' ? { ...current, [key]: value } : current,
              ),
            }
          : row,
      ),
    );
  };

  const updateConditionGroupOperator = (rowId: string, nodeId: string, operator: 'AND' | 'OR') => {
    setBuilderConditions((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              condition: updateConditionNode(row.condition, nodeId, (current) =>
                current.type === 'group' ? { ...current, operator } : current,
              ),
            }
          : row,
      ),
    );
  };

  const addConditionChild = (rowId: string, nodeId: string, type: 'condition' | 'group') => {
    const newChild = type === 'group' ? createGroupNode() : createConditionNode();
    setBuilderConditions((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              condition: updateConditionNode(row.condition, nodeId, (current) =>
                current.type === 'group'
                  ? { ...current, children: [...current.children, newChild] }
                  : current,
              ),
            }
          : row,
      ),
    );
  };

  const removeConditionChild = (rowId: string, nodeId: string) => {
    const removeNode = (node: ConditionTree): ConditionTree | null => {
      if (node.id === nodeId) {
        return null;
      }
      if (node.type === 'group') {
        const nextChildren = node.children
          .map(removeNode)
          .filter((child): child is ConditionTree => Boolean(child));
        if (nextChildren.length === 0) {
          return createConditionNode();
        }
        return { ...node, children: nextChildren };
      }
      return node;
    };
    setBuilderConditions((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, condition: removeNode(row.condition) as ConditionTree } : row,
      ),
    );
  };

  const updateBuilderResult = (rowId: string, value: string) => {
    setBuilderConditions((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, result: value } : row)),
    );
  };

  const handleFriendlyConditionInputChange = (
    rowId: string,
    nodeId: string,
    key: 'left' | 'right',
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    updateBuilderCondition(rowId, nodeId, key, value);
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    const trapVars = getTrapVariables(obj);
    tryOpenVarInsertModal({
      panelKey: builderTarget.panelKey,
      field: 'builderCondition',
      value,
      cursorIndex,
      trapVars,
      meta: {
        rowId,
        nodeId,
        key,
      },
    });
  };

  const handleFriendlyResultInputChange = (
    rowId: string,
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    updateBuilderResult(rowId, value);
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    const trapVars = getTrapVariables(obj);
    tryOpenVarInsertModal({
      panelKey: builderTarget.panelKey,
      field: 'builderResult',
      value,
      cursorIndex,
      trapVars,
      meta: {
        rowId,
        key: 'result',
      },
    });
  };

  const handleFriendlyElseResultInputChange = (
    value: string,
    cursorIndex: number | null,
    inputType?: string,
  ) => {
    setBuilderElseResult(value);
    if (!builderTarget) {
      return;
    }
    if (inputType && !inputType.startsWith('insert')) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    const trapVars = getTrapVariables(obj);
    tryOpenVarInsertModal({
      panelKey: builderTarget.panelKey,
      field: 'builderElse',
      value,
      cursorIndex,
      trapVars,
      meta: {
        key: 'else',
      },
    });
  };

  const addBuilderRow = () => {
    setBuilderConditions((prev) => [
      ...prev,
      { id: nextBuilderId(), condition: createConditionNode(), result: '' },
    ]);
  };

  const removeBuilderRow = (rowId: string) => {
    setBuilderConditions((prev) => prev.filter((row) => row.id !== rowId));
  };

  const buildConditionExpression = (node: ConditionTree): string => {
    if (node.type === 'condition') {
      const left = node.left.trim();
      const right = node.right.trim();
      if (!left || !node.operator || !right) {
        return '';
      }
      return `${left} ${node.operator} ${right}`;
    }
    const parts = node.children.map((child) => buildConditionExpression(child)).filter(Boolean);
    if (parts.length !== node.children.length) {
      return '';
    }
    const joiner = node.operator === 'AND' ? ' && ' : ' || ';
    return `(${parts.join(joiner)})`;
  };

  const buildFriendlyEval = () => {
    if (builderConditions.length === 0) {
      return '';
    }
    const elseValue = builderElseResult.trim();
    if (!elseValue) {
      return '';
    }
    let expr = elseValue;
    for (let i = builderConditions.length - 1; i >= 0; i -= 1) {
      const row = builderConditions[i];
      const result = row.result.trim();
      const condition = buildConditionExpression(row.condition);
      if (!condition || !result) {
        return '';
      }
      expr = `(${condition}) ? ${result} : ${expr}`;
    }
    return expr;
  };

  const renderConditionNode = (
    rowId: string,
    node: ConditionTree,
    depth: number,
    isNested: boolean,
    parentCount: number,
  ) => {
    if (node.type === 'condition') {
      return (
        <div
          className={`builder-condition-line${isNested ? ' builder-condition-line-nested' : ''}`}
        >
          <input
            className="builder-input"
            value={node.left}
            onChange={(e) =>
              handleFriendlyConditionInputChange(
                rowId,
                node.id,
                'left',
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )
            }
            placeholder="$v1"
            disabled={!isBuilderTargetReady}
            title={node.left}
          />
          <select
            className="builder-select"
            value={node.operator}
            onChange={(e) => updateBuilderCondition(rowId, node.id, 'operator', e.target.value)}
            disabled={!isBuilderTargetReady}
          >
            <option value="==">==</option>
            <option value="!=">!=</option>
            <option value=">">&gt;</option>
            <option value=">=">&gt;=</option>
            <option value="<">&lt;</option>
            <option value="<=">&lt;=</option>
          </select>
          <input
            className="builder-input"
            value={node.right}
            onChange={(e) =>
              handleFriendlyConditionInputChange(
                rowId,
                node.id,
                'right',
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )
            }
            placeholder="1"
            disabled={!isBuilderTargetReady}
            title={node.right}
          />
          {isNested && (
            <button
              type="button"
              className="builder-remove"
              onClick={() => removeConditionChild(rowId, node.id)}
              disabled={!isBuilderTargetReady || parentCount <= 1}
              aria-label="Remove condition"
            >
              ×
            </button>
          )}
        </div>
      );
    }
    return (
      <div className={`builder-group builder-group-depth-${depth}`}>
        <div className="builder-group-header">
          <div className="builder-group-title-row">
            <span className="builder-group-title">Group</span>
            <span className="builder-group-operator-pill">{node.operator}</span>
          </div>
          <div className="builder-mode-toggle">
            <button
              type="button"
              className={
                node.operator === 'AND'
                  ? 'builder-mode-button builder-mode-button-active'
                  : 'builder-mode-button'
              }
              onClick={() => updateConditionGroupOperator(rowId, node.id, 'AND')}
              disabled={!isBuilderTargetReady}
            >
              AND
            </button>
            <button
              type="button"
              className={
                node.operator === 'OR'
                  ? 'builder-mode-button builder-mode-button-active'
                  : 'builder-mode-button'
              }
              onClick={() => updateConditionGroupOperator(rowId, node.id, 'OR')}
              disabled={!isBuilderTargetReady}
            >
              OR
            </button>
          </div>
          {isNested && (
            <button
              type="button"
              className="builder-remove"
              onClick={() => removeConditionChild(rowId, node.id)}
              disabled={!isBuilderTargetReady || parentCount <= 1}
              aria-label="Remove group"
            >
              ×
            </button>
          )}
        </div>
        <div className="builder-group-children">
          {node.children.map((child) => (
            <div key={child.id} className="builder-group-child">
              {renderConditionNode(rowId, child, depth + 1, true, node.children.length)}
            </div>
          ))}
        </div>
        <div className="builder-group-actions">
          <button
            type="button"
            className="builder-link"
            onClick={() => addConditionChild(rowId, node.id, 'condition')}
            disabled={!isBuilderTargetReady}
          >
            Add condition
          </button>
          <button
            type="button"
            className="builder-link"
            onClick={() => addConditionChild(rowId, node.id, 'group')}
            disabled={!isBuilderTargetReady}
          >
            Add group
          </button>
        </div>
      </div>
    );
  };

  const applyFriendlyEval = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    const compiled = buildFriendlyEval();
    if (!compiled) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    const currentValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
    if (String(currentValue) !== String(compiled)) {
      updatePanelDraftField(builderTarget.panelKey, builderTarget.field, compiled);
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, true);
    closeBuilder();
  };

  const applyRegularEval = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    const text = builderRegularText.trim();
    if (!text) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    const currentValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
    if (String(currentValue) !== String(text)) {
      updatePanelDraftField(builderTarget.panelKey, builderTarget.field, text);
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, true);
    closeBuilder();
  };

  const applyLiteralValue = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return;
    }
    const currentValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
    if (String(currentValue) !== String(builderLiteralText)) {
      updatePanelDraftField(builderTarget.panelKey, builderTarget.field, builderLiteralText);
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, false);
    closeBuilder();
  };

  const clearRegularEval = () => {
    setBuilderRegularText('');
  };

  const _enableEvalForTarget = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, true);
  };

  const varTooltipHoverProps = {
    onMouseEnter: (event: any) => {
      activeOverrideTooltipRef.current = event.currentTarget;
      positionOverrideTooltip(event.currentTarget);
    },
    onMouseMove: (event: any) => {
      positionOverrideTooltip(event.currentTarget);
    },
    onMouseLeave: () => {
      activeOverrideTooltipRef.current = null;
    },
    onFocus: (event: any) => {
      activeOverrideTooltipRef.current = event.currentTarget;
      positionOverrideTooltip(event.currentTarget);
    },
    onBlur: () => {
      activeOverrideTooltipRef.current = null;
    },
  };

  const renderVarToken = (token: string, trapVars?: any[]) => {
    const index = Number(token.replace('$v', '')) - 1;
    const variable = Array.isArray(trapVars) ? trapVars[index] : null;
    const description = Array.isArray(variable?.description)
      ? variable.description.filter(Boolean).join(' ')
      : renderValue(variable?.description);
    return (
      <span
        className="override-summary var-token-wrap"
        tabIndex={0}
        {...varTooltipHoverProps}
      >
        <button
          type="button"
          className="var-token"
          onClick={() => {
            setVarModalToken(token);
            setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
            setVarModalMode('view');
            setVarInsertContext(null);
            setVarModalOpen(true);
          }}
        >
          {token}
        </button>
        {variable && !suppressVarTooltip && (
          <div className="override-summary-card" role="tooltip">
            <div className="override-summary-title">Variable {token}</div>
            <ul className="override-summary-list">
              <li className="override-summary-item">
                <span className="override-summary-field">Name</span>
                <span className="override-summary-value">{renderValue(variable?.name)}</span>
              </li>
              <li className="override-summary-item">
                <span className="override-summary-field">OID</span>
                <span className="override-summary-value">{renderValue(variable?.oid)}</span>
              </li>
              {description && description !== '—' && (
                <li className="override-summary-item">
                  <span className="override-summary-field">Description</span>
                  <span className="override-summary-value">{description}</span>
                </li>
              )}
            </ul>
          </div>
        )}
      </span>
    );
  };

  const openVarInsertModal = (
    panelKey: string,
    field: string,
    currentValue: string,
    trapVars: any[],
    replaceStart?: number,
    replaceEnd?: number,
  ) => {
    const start = replaceStart ?? currentValue.length;
    const end = replaceEnd ?? currentValue.length;
    setVarInsertContext({
      panelKey,
      field,
      value: currentValue,
      replaceStart: start,
      replaceEnd: end,
    });
    setVarModalToken(null);
    setVarModalMode('insert');
    setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
    setVarModalOpen(true);
  };

  const renderSummary = (
    value: any,
    trapVars: any[] = [],
    options?: { suppressEvalTooltip?: boolean },
  ) => {
    if (value && typeof value === 'object' && typeof value.eval === 'string') {
      return renderEvalDisplay(value.eval, trapVars, !options?.suppressEvalTooltip);
    }
    const text = typeof value === 'string' ? value : '—';
    if (!text || text === '—') {
      return text;
    }
    const isEvalLike = Boolean(splitTernary(unwrapOuterParens(text.trim())));
    if (isEvalLike) {
      return renderEvalDisplay(text, trapVars, !options?.suppressEvalTooltip);
    }
    const parts = text.split(/(\$v\d+)/g);
    return (
      <span>
        {parts.map((part: string, index: number) => {
          if (!part.match(/^\$v\d+$/)) {
            return <span key={`text-${index}`}>{renderHighlightedText(part)}</span>;
          }
          return <span key={`var-${index}`}>{renderVarToken(part, trapVars)}</span>;
        })}
      </span>
    );
  };

  const renderEvalLineWithVars = (line: string, trapVars?: any[]) => {
    const parts = line.split(/(\$v\d+)/g);
    return (
      <span>
        {parts.map((part: string, index: number) => {
          if (!part.match(/^\$v\d+$/)) {
            return <span key={`line-text-${index}`}>{renderHighlightedText(part)}</span>;
          }
          return <span key={`line-var-${index}`}>{renderVarToken(part, trapVars)}</span>;
        })}
      </span>
    );
  };

  const getObjectDescription = (obj: any) => {
    const raw = obj?.description;
    if (Array.isArray(raw)) {
      return raw.map(String).join(' ');
    }
    if (typeof raw === 'string') {
      return raw;
    }
    return '';
  };

  useEffect(() => {
    if (!varModalOpen || !varModalToken) {
      return;
    }
    scrollToRef(varRowRefs.current[varModalToken]);
  }, [varModalOpen, varModalToken, varModalVars]);

  useEffect(() => {
    updateModalStack('advancedFlow', showAdvancedProcessorModal);
  }, [showAdvancedProcessorModal]);

  useEffect(() => {
    updateModalStack('flowEditor', Boolean(flowEditor && flowEditorDraft));
  }, [flowEditor, flowEditorDraft]);

  useEffect(() => {
    updateModalStack('varModal', varModalOpen);
  }, [varModalOpen]);

  useEffect(() => {
    updateModalStack('fieldReference', showFieldReferenceModal);
  }, [showFieldReferenceModal]);

  useEffect(() => {
    updateModalStack('advancedFlowConfirm', pendingAdvancedFlowClose);
  }, [pendingAdvancedFlowClose]);

  useEffect(() => {
    if (!highlightQuery || !selectedFile || !searchHighlightActive) {
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      setMatchObjectOptions([]);
      setRawMatchPositions([]);
      setRawMatchIndex(0);
      return;
    }
    const query = highlightQuery.toLowerCase();
    const objects = getFriendlyObjects(fileData);
    const matches: string[] = [];
    const options: Array<{ key: string; label: string }> = [];
    objects.forEach((obj: unknown, idx: number) => {
      try {
        const text = JSON.stringify(obj).toLowerCase();
        if (text.includes(query)) {
          const key = getObjectKey(obj, idx);
          const label =
            isRecord(obj) && typeof obj['@objectName'] === 'string'
              ? obj['@objectName']
              : `Object ${idx + 1}`;
          matches.push(key);
          options.push({ key, label });
        }
      } catch {
        // ignore
      }
    });
    setHighlightObjectKeys(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : 0);
    setMatchObjectOptions(options);
  }, [fileData, highlightQuery, highlightPathId, selectedFile, searchHighlightActive]);

  useEffect(() => {
    if (!selectedFile) {
      setOverrideObjectKeys([]);
      setOverrideObjectOptions([]);
      setOverrideMatchIndex(0);
      return;
    }
    const objects = getFriendlyObjects(fileData);
    const keys: string[] = [];
    const options: Array<{ key: string; label: string }> = [];
    objects.forEach((obj: unknown, idx: number) => {
      if (!getOverrideFlags(obj).any) {
        return;
      }
      const key = getObjectKey(obj, idx);
      const label =
        isRecord(obj) && typeof obj['@objectName'] === 'string'
          ? obj['@objectName']
          : `Object ${idx + 1}`;
      keys.push(key);
      options.push({ key, label });
    });
    setOverrideObjectKeys(keys);
    setOverrideObjectOptions(options);
    setOverrideMatchIndex((prev) => (keys.length === 0 ? 0 : Math.min(prev, keys.length - 1)));
  }, [fileData, overrideInfo, pendingOverrideSave, selectedFile]);

  useEffect(() => {
    if (viewMode === 'friendly' || !searchHighlightActive || !highlightQuery) {
      setRawMatchPositions([]);
      setRawMatchIndex(0);
      return;
    }
    const text = editorText || JSON.stringify(getPreviewContent(fileData), null, 2);
    const lower = text.toLowerCase();
    const lowerQuery = highlightQuery.toLowerCase();
    if (!lowerQuery || !lower.includes(lowerQuery)) {
      setRawMatchPositions([]);
      setRawMatchIndex(0);
      return;
    }
    const positions: number[] = [];
    let start = 0;
    while (true) {
      const idx = lower.indexOf(lowerQuery, start);
      if (idx === -1) {
        break;
      }
      positions.push(idx);
      start = idx + lowerQuery.length;
    }
    setRawMatchPositions(positions);
    setRawMatchIndex(positions.length > 0 ? 0 : 0);
  }, [viewMode, searchHighlightActive, highlightQuery, editorText, fileData]);

  useEffect(() => {
    if (rawMatchPositions.length === 0) {
      return;
    }
    const target = rawMatchRefs.current[rawMatchIndex];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [rawMatchIndex, rawMatchPositions]);

  useEffect(() => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    scrollToMatchIndex(currentMatchIndex);
  }, [currentMatchIndex, highlightObjectKeys]);

  useEffect(() => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    const key = highlightObjectKeys[currentMatchIndex];
    if (!key) {
      return;
    }
    setMatchPingKey(key);
    if (matchPingTimeoutRef.current) {
      window.clearTimeout(matchPingTimeoutRef.current);
    }
    matchPingTimeoutRef.current = window.setTimeout(() => {
      setMatchPingKey(null);
    }, 800);
  }, [currentMatchIndex, highlightObjectKeys]);

  useEffect(() => {
    if (!highlightFileName || highlightObjectKeys.length > 0) {
      return;
    }
    setFileNamePingActive(true);
    if (fileNamePingTimeoutRef.current) {
      window.clearTimeout(fileNamePingTimeoutRef.current);
    }
    fileNamePingTimeoutRef.current = window.setTimeout(() => {
      setFileNamePingActive(false);
    }, 800);
  }, [highlightFileName, highlightObjectKeys, selectedFile]);

  useEffect(() => {
    if (!selectedFile?.PathID || fileLoading) {
      return;
    }
    const currentFileId = selectedFile.PathID;
    if (highlightObjectKeys.length > 0) {
      const key = highlightObjectKeys[currentMatchIndex];
      if (!key) {
        return;
      }
      if (
        lastLoadPingRef.current.fileId === currentFileId &&
        lastLoadPingRef.current.key === key &&
        lastLoadPingRef.current.mode === 'match'
      ) {
        return;
      }
      lastLoadPingRef.current = { fileId: currentFileId, key, mode: 'match' };
      startMatchPingSequence(key, 3);
      return;
    }
    if (highlightFileName) {
      if (
        lastLoadPingRef.current.fileId === currentFileId &&
        lastLoadPingRef.current.mode === 'file'
      ) {
        return;
      }
      lastLoadPingRef.current = { fileId: currentFileId, mode: 'file' };
      startFileNamePingSequence(3);
    }
  }, [selectedFile, fileLoading, highlightObjectKeys, currentMatchIndex, highlightFileName]);

  useEffect(() => {
    if (!selectedFile?.PathID || highlightObjectKeys.length === 0) {
      return;
    }
    const key = highlightObjectKeys[currentMatchIndex];
    matchStateByFileRef.current[selectedFile.PathID] = {
      index: currentMatchIndex,
      key,
    };
  }, [currentMatchIndex, highlightObjectKeys, selectedFile]);

  useEffect(() => {
    if (!selectedFile?.PathID || highlightObjectKeys.length === 0) {
      return;
    }
    const saved = matchStateByFileRef.current[selectedFile.PathID];
    if (!saved) {
      return;
    }
    if (saved.key && highlightObjectKeys.includes(saved.key)) {
      const idx = highlightObjectKeys.indexOf(saved.key);
      if (idx !== currentMatchIndex) {
        setCurrentMatchIndex(idx);
      }
      return;
    }
    if (
      typeof saved.index === 'number' &&
      saved.index < highlightObjectKeys.length &&
      saved.index !== currentMatchIndex
    ) {
      setCurrentMatchIndex(saved.index);
    }
  }, [selectedFile, highlightObjectKeys]);

  useEffect(() => {
    if (!selectedFile?.PathID) {
      return;
    }
    const container = getActiveScrollContainer();
    if (!container) {
      return;
    }
    const currentId = selectedFile.PathID;
    const lastId = lastSelectedFileRef.current;
    if (lastId && lastId !== currentId) {
      container.scrollTop = 0;
    } else {
      const saved = scrollStateByFileRef.current[currentId];
      container.scrollTop = typeof saved === 'number' ? saved : 0;
    }
    lastSelectedFileRef.current = currentId;
  }, [selectedFile, fileData, viewMode, isAnyPanelEditing]);

  useEffect(() => {
    if (!selectedFile) {
      setHighlightQuery(null);
      setHighlightPathId(null);
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      setMatchObjectOptions([]);
      setSearchHighlightActive(false);
      return;
    }
  }, [selectedFile, highlightPathId]);

  const formatDescription = (value: any) => {
    if (Array.isArray(value)) {
      return value.filter(Boolean).join(' ');
    }
    return renderValue(value);
  };

  const renderEnums = (enums: any) => {
    if (!enums || typeof enums !== 'object') {
      return null;
    }
    const entries = Object.entries(enums);
    if (entries.length === 0) {
      return null;
    }
    return (
      <details className="trap-var-enums">
        <summary>Enums ({entries.length})</summary>
        <ul>
          {entries.map(([key, value]) => (
            <li key={key}>
              <span className="enum-key">{key}</span>
              <span className="enum-value">{renderValue(value)}</span>
            </li>
          ))}
        </ul>
      </details>
    );
  };

  const renderTrapVariables = (variables: any) => {
    if (!Array.isArray(variables) || variables.length === 0) {
      return '—';
    }
    const count = variables.length;
    return (
      <details className="trap-vars">
        <summary>
          {count} available variable{count === 1 ? '' : 's'}
        </summary>
        <div className="trap-vars-list">
          {variables.map((variable: any, index: number) => {
            const token = `$v${index + 1}`;
            return (
              <div className="trap-var" key={variable?.name || variable?.oid || index}>
                <div className="trap-var-title">
                  <span className="trap-var-name">{renderValue(variable?.name)}</span>
                  <span className="pill">{token}</span>
                  {variable?.valueType && <span className="pill">{variable.valueType}</span>}
                </div>
                <div className="trap-var-grid">
                  <div className="trap-var-col">
                    <div className="trap-var-row">
                      <span className="label">OID</span>
                      <span className="value monospace">{renderValue(variable?.oid)}</span>
                    </div>
                    <div className="trap-var-row">
                      <span className="label">Description</span>
                      <span className="value">{formatDescription(variable?.description)}</span>
                    </div>
                  </div>
                  <div className="trap-var-col">
                    {renderEnums(variable?.enums) || <span className="muted">No enums</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </details>
    );
  };

  const handleNextMatch = () => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    setCurrentMatchIndex((prev) => (prev + 1) % highlightObjectKeys.length);
  };

  const handlePrevMatch = () => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    setCurrentMatchIndex(
      (prev) => (prev - 1 + highlightObjectKeys.length) % highlightObjectKeys.length,
    );
  };

  const handleJumpToMatch = (key: string) => {
    if (!key) {
      return;
    }
    const idx = highlightObjectKeys.indexOf(key);
    if (idx >= 0) {
      setCurrentMatchIndex(idx);
    }
  };

  const handleNextRawMatch = () => {
    if (rawMatchPositions.length === 0) {
      return;
    }
    setRawMatchIndex((prev) => (prev + 1) % rawMatchPositions.length);
  };

  const handlePrevRawMatch = () => {
    if (rawMatchPositions.length === 0) {
      return;
    }
    setRawMatchIndex((prev) => (prev - 1 + rawMatchPositions.length) % rawMatchPositions.length);
  };

  const renderRawHighlightedText = (text: string, query: string) => {
    if (!searchHighlightActive || !query) {
      return text;
    }
    const lower = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    if (!lower.includes(lowerQuery)) {
      return text;
    }
    const parts: React.ReactNode[] = [];
    let start = 0;
    let matchIndex = 0;
    while (true) {
      const idx = lower.indexOf(lowerQuery, start);
      if (idx === -1) {
        break;
      }
      if (idx > start) {
        parts.push(text.slice(start, idx));
      }
      parts.push(
        <span
          key={`raw-match-${idx}`}
          className={matchIndex === rawMatchIndex ? 'raw-match raw-match-active' : 'raw-match'}
          ref={(el) => {
            rawMatchRefs.current[matchIndex] = el;
          }}
        >
          {text.slice(idx, idx + query.length)}
        </span>,
      );
      start = idx + query.length;
      matchIndex += 1;
    }
    if (start < text.length) {
      parts.push(text.slice(start));
    }
    return parts;
  };

  const normalizeEvalText = (value: string) =>
    value
      .replace(/\s+/g, ' ')
      .replace(/&&/g, ' AND ')
      .replace(/\|\|/g, ' OR ')
      .replace(/==/g, ' = ')
      .replace(/!=/g, ' ≠ ')
      .replace(/>=/g, ' ≥ ')
      .replace(/<=/g, ' ≤ ')
      .replace(/\s+/g, ' ')
      .trim();

  const unwrapOuterParens = (value: string) => {
    let result = value.trim();
    while (result.startsWith('(') && result.endsWith(')')) {
      let depth = 0;
      let isWrapped = true;
      for (let i = 0; i < result.length; i += 1) {
        const char = result[i];
        if (char === '(') {
          depth += 1;
        } else if (char === ')') {
          depth -= 1;
          if (depth === 0 && i !== result.length - 1) {
            isWrapped = false;
            break;
          }
        }
      }
      if (!isWrapped || depth !== 0) {
        break;
      }
      result = result.slice(1, -1).trim();
    }
    return result;
  };

  const splitTernary = (value: string) => {
    const cleaned = unwrapOuterParens(value);
    let questionIndex = -1;
    let depth = 0;
    let parenDepth = 0;
    for (let i = 0; i < cleaned.length; i += 1) {
      const char = cleaned[i];
      if (char === '(') {
        parenDepth += 1;
      } else if (char === ')') {
        parenDepth = Math.max(0, parenDepth - 1);
      }
      if (parenDepth > 0) {
        continue;
      }
      if (char === '?') {
        if (depth === 0) {
          questionIndex = i;
        }
        depth += 1;
      } else if (char === ':') {
        if (depth === 1) {
          const condition = cleaned.slice(0, questionIndex);
          const whenTrue = cleaned.slice(questionIndex + 1, i);
          const whenFalse = cleaned.slice(i + 1);
          return { condition, whenTrue, whenFalse };
        }
        if (depth > 0) {
          depth -= 1;
        }
      }
    }
    return null;
  };

  const formatEvalReadableList = (text: string) => {
    const cleaned = unwrapOuterParens(text.trim());
    const ternary = splitTernary(cleaned);
    if (!ternary) {
      return [`Set to ${normalizeEvalText(cleaned)}`];
    }
    const lines: string[] = [];
    const walk = (expr: string, isFirst: boolean) => {
      const node = splitTernary(unwrapOuterParens(expr.trim()));
      if (!node) {
        lines.push(
          isFirst ? `Set to ${normalizeEvalText(expr)}` : `Else set to ${normalizeEvalText(expr)}`,
        );
        return;
      }
      const condition = normalizeEvalText(node.condition)
        .replace(/=\s*(\d+)/g, 'is $1')
        .replace(/\bOR\b/g, 'or');
      const thenExpr = normalizeEvalText(node.whenTrue);
      if (isFirst) {
        lines.push(`If ${condition}, set to ${thenExpr}`);
      } else {
        lines.push(`Else if ${condition}, set to ${thenExpr}`);
      }
      walk(node.whenFalse, false);
    };
    walk(cleaned, true);
    return lines;
  };
  const renderEvalDisplay = (evalText: string, trapVars?: any[], showTooltip = true) => {
    try {
      const lines = formatEvalReadableList(evalText);
      return (
        <div className="eval-display">
          <span
            className="eval-label eval-label-hover override-summary"
            tabIndex={0}
            onMouseEnter={(event) => {
              activeOverrideTooltipRef.current = event.currentTarget;
              positionOverrideTooltip(event.currentTarget);
              setSuppressVarTooltip(true);
              setSuppressEvalTooltip(false);
            }}
            onMouseMove={(event) => {
              positionOverrideTooltip(event.currentTarget);
            }}
            onMouseLeave={() => {
              activeOverrideTooltipRef.current = null;
              setSuppressVarTooltip(false);
              setSuppressEvalTooltip(false);
            }}
            onFocus={(event) => {
              activeOverrideTooltipRef.current = event.currentTarget;
              positionOverrideTooltip(event.currentTarget);
              setSuppressVarTooltip(true);
              setSuppressEvalTooltip(false);
            }}
            onBlur={() => {
              activeOverrideTooltipRef.current = null;
              setSuppressVarTooltip(false);
              setSuppressEvalTooltip(false);
            }}
          >
            <span className="eval-label-icon">ⓘ</span>
            Eval
            {!suppressEvalTooltip && showTooltip && (
              <div className="override-summary-card eval-summary-card" role="tooltip">
                <div className="override-summary-title">Eval (Raw)</div>
                <div className="override-summary-value monospace">{evalText}</div>
              </div>
            )}
          </span>
          <div className="eval-demo eval-demo-lines">
            {lines.map((line, index) => (
              <span key={`${line}-${index}`}>{renderEvalLineWithVars(line, trapVars)}</span>
            ))}
          </div>
        </div>
      );
    } catch {
      return <span className="eval-fallback">{renderHighlightedText(evalText)}</span>;
    }
  };

  const friendlyPreview = buildFriendlyEval();
  const _literalMeta = getLiteralEligibility();
  const literalDirty = builderTarget
    ? (() => {
        const obj = getObjectByPanelKey(builderTarget.panelKey);
        if (!obj) {
          return false;
        }
        return (
          getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field) !==
          builderLiteralText
        );
      })()
    : false;
  const builderDirty = hasBuilderUnsavedChanges();
  const processorPayload = buildProcessorPayload();
  const builderPatchPreview = (() => {
    if (!builderPatchMode || !builderTarget || !processorPayload) {
      return null;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    const objectName =
      isRecord(obj) && typeof obj['@objectName'] === 'string' ? obj['@objectName'] : null;
    if (!objectName) {
      return null;
    }
    const target = getProcessorTargetField(processorPayload);
    const setPayload = getSetPayload(processorPayload);
    if (!target || !target.startsWith('$.event.') || !setPayload) {
      return null;
    }
    const field = target.replace('$.event.', '');
    return buildOverridePatchOp(objectName, field, setPayload.source);
  })();
  const builderTrapVars = builderTarget ? getTrapVariables(getObjectByPanelKey(builderTarget.panelKey)) : [];
  const flowEditorLane = flowEditor?.lane || 'object';
  const flowEditorValidation = validateFlowEditorDraft(flowEditorDraft, flowEditorLane);
  const flowEditorFieldErrors = flowEditorValidation.fieldErrors;
  const flowEditorNodeErrors = flowEditorValidation.nodeErrors;
  const flowEditorHasErrors =
    flowEditorNodeErrors.length > 0 || Object.keys(flowEditorFieldErrors).length > 0;
  const focusedFlowJson = focusedFlowMatch
    ? JSON.stringify(focusedFlowMatch.processor, null, 2)
    : '';
  const focusedLaneLabel = focusedFlowMatch
    ? focusedFlowMatch.lane === 'pre'
      ? 'Pre'
      : focusedFlowMatch.lane === 'post'
        ? 'Post'
        : 'Object'
    : '';
  const formatFlowTargetLabel = (target: string) =>
    target.startsWith('$.event.') ? target.replace('$.event.', '') : target;
  const advancedFlowRemovedTargets = useMemo(() => {
    const target = advancedFlowTarget;
    if (!target) {
      return [] as string[];
    }
    const removed = new Set<string>();
    stagedDiff.sections.forEach((section) => {
      if (advancedProcessorScope === 'global') {
        if (section.objectName) {
          return;
        }
      } else if (section.objectName !== target.objectName) {
        return;
      }
      section.fieldChanges.forEach((change) => {
        if (change.action === 'removed') {
          removed.add(change.target);
        }
      });
    });
    return Array.from(removed);
  }, [advancedFlowTarget, advancedProcessorScope, stagedDiff.sections]);
  const rawPreviewText = editorText || JSON.stringify(getPreviewContent(fileData), null, 2);
  const formatPcomValue = (value: any) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  };
  const getPcomObjectName = (obj: any) => String(obj?.['@objectName'] || obj?.objectName || '');
  const pcomParsed = useMemo(() => {
    if (activeApp !== 'pcom') {
      return null;
    }
    const source = rawPreviewText.trim();
    if (!source || (!source.startsWith('{') && !source.startsWith('['))) {
      return null;
    }
    try {
      return JSON.parse(source);
    } catch {
      return null;
    }
  }, [activeApp, rawPreviewText]);
  const pcomObjectEntries = useMemo<Array<{ key: string; name: string; obj: any }>>(() => {
    const objects = Array.isArray(pcomParsed?.objects) ? pcomParsed.objects : [];
    return objects.map((obj: any, index: number) => {
      const name = getPcomObjectName(obj);
      return {
        key: name || `object-${index}`,
        name: name || `Object ${index + 1}`,
        obj,
      };
    });
  }, [pcomParsed]);
  const pcomSelectedObject = useMemo(() => {
    if (pcomObjectEntries.length === 0) {
      return null;
    }
    const match = pcomObjectEntries.find(
      (entry: { key: string }) => entry.key === pcomSelectedObjectKey,
    );
    return match || pcomObjectEntries[0];
  }, [pcomObjectEntries, pcomSelectedObjectKey]);
  useEffect(() => {
    if (activeApp !== 'pcom') {
      return;
    }
    if (pcomObjectEntries.length === 0) {
      if (pcomSelectedObjectKey) {
        setPcomSelectedObjectKey(null);
      }
      return;
    }
    if (
      !pcomSelectedObjectKey ||
      !pcomObjectEntries.some(
        (entry: { key: string }) => entry.key === pcomSelectedObjectKey,
      )
    ) {
      setPcomSelectedObjectKey(pcomObjectEntries[0].key);
    }
  }, [activeApp, pcomObjectEntries, pcomSelectedObjectKey]);
  const renderFlowJsonPreview = (fullJson: string) => (
    <div
      className={`flow-preview${showAdvancedFlowJsonPreview ? '' : ' flow-preview-collapsed'}`}
    >
      <div className="flow-preview-title-row">
        <div className="flow-preview-title">JSON Preview</div>
        <button
          type="button"
          className="builder-link"
          onClick={() => setShowAdvancedFlowJsonPreview((prev) => !prev)}
        >
          {showAdvancedFlowJsonPreview ? 'Hide JSON' : 'Show JSON'}
        </button>
      </div>
      {showAdvancedFlowJsonPreview &&
        (advancedFlowFocusOnly && focusedFlowMatch
          ? renderJsonWithFocus(focusedFlowJson, focusedFlowJson)
          : renderJsonWithFocus(fullJson, focusedFlowJson))}
    </div>
  );
  const getFieldChangeLabel = (change: {
    before?: any;
    after?: any;
    action: string;
    origin?: 'event' | 'processor';
  }) => {
    const label = change.origin === 'processor' ? 'Processor' : 'Field';
    if (change.action === 'updated') {
      return `${label} updated`;
    }
    if (change.action === 'added') {
      return `${label} added`;
    }
    return `${label} removed`;
  };

  const builderContextValue = useFcomBuilderContextValue({
    builderOpen,
    builderTarget,
    builderDirty,
    canUndoBuilder,
    canRedoBuilder,
    handleBuilderUndo,
    handleBuilderRedo,
    setShowBuilderHelpModal,
    requestCancelBuilder,
    builderFocus,
    builderPatchMode,
    builderPatchPreview,
    isBuilderTargetReady,
    builderTypeLocked,
    setBuilderSwitchModal,
    applyBuilderTypeSwitch,
    builderLiteralText,
    handleLiteralInputChange,
    literalDirty,
    applyLiteralValue,
    builderMode,
    setBuilderMode,
    hasEditPermission,
    setAdvancedProcessorScope,
    setShowAdvancedProcessorModal,
    builderConditions,
    setBuilderConditions,
    updateBuilderCondition,
    handleFriendlyConditionInputChange,
    handleFriendlyResultInputChange,
    handleFriendlyElseResultInputChange,
    removeBuilderRow,
    addBuilderRow,
    createConditionNode,
    createGroupNode,
    nextBuilderId,
    renderConditionNode,
    builderElseResult,
    friendlyPreview,
    applyFriendlyEval,
    formatEvalReadableList,
    builderRegularText,
    handleRegularEvalInputChange,
    clearRegularEval,
    applyRegularEval,
    applyBuilderTemplate,
    openAdvancedFlowModal,
    processorStep,
    setProcessorStep,
    processorType,
    processorPayload,
    processorCatalog,
    handleBuilderSelect,
    builderProcessorConfig,
    setBuilderProcessorConfig,
    builderNestedAddType,
    setBuilderNestedAddType,
    builderPaletteItems,
    builderSwitchCaseAddType,
    setBuilderSwitchCaseAddType,
    builderSwitchDefaultAddType,
    setBuilderSwitchDefaultAddType,
    createFlowNodeFromPaletteValue,
    renderProcessorHelp,
    renderProcessorConfigFields,
    renderFlowList,
    getProcessorCatalogLabel,
    getProcessorSummaryLines,
    showProcessorJson,
    setShowProcessorJson,
    applyProcessor,
    nextSwitchCaseId,
    getOverrideVersionInfo,
    getObjectByPanelKey,
  });

  const builderSidebar = (
    <FcomBuilderSidebar
      isAnyPanelEditing={isAnyPanelEditing}
      contextValue={builderContextValue}
    />
  );

  const microserviceModal = redeployModalOpen ? (
    <Modal className="modal-wide" ariaLabel="Microservice Status">
        <h3>Microservice Status</h3>
        <p>
          Trap processing requires the chain below to be installed and running:
          trap-collector -&gt; fcom-processor -&gt; event-sink.
        </p>
        {redeployReady && (
          <div className="builder-hint builder-hint-warning">
            Changes staged. Redeploy FCOM Processor to apply them.
          </div>
        )}
        {showMicroserviceWarning && (
          <div className="builder-hint builder-hint-warning">
            Attention: {[...missingMicroservices, ...unhealthyMicroservices].join(', ')}
          </div>
        )}
        {microserviceStatusError && (
          <div className="builder-hint builder-hint-warning">{microserviceStatusError}</div>
        )}
        {microserviceIsStale && (
          <div className="builder-hint builder-hint-warning">
            Status may be stale. Last refresh was {formatTime(microserviceLastRefreshed)}.
          </div>
        )}
        {redeployError && <div className="error-message">{redeployError}</div>}
        <div className="microservice-action-banner">
          {microserviceStatusLoading
            ? microserviceLastRefreshed
              ? `Refreshing... Last refreshed at ${formatTime(microserviceLastRefreshed)}`
              : 'Refreshing...'
            : microserviceLastRefreshed
              ? `Last refreshed at ${formatTime(microserviceLastRefreshed)}`
              : 'Status not refreshed yet.'}
        </div>
        {requiredMicroservices.length === 0 && microserviceStatusLoading ? (
          <div className="microservice-loading">Loading status...</div>
        ) : (
          <div className="microservice-chain">
            {requiredMicroservices.map((entry: MicroserviceEntry, idx: number) => {
              const tone = getServiceTone(entry);
              const label = String(entry?.label || entry?.name || 'Unknown');
              const canDeploy = !entry?.installed && entry?.available;
              const serviceName = typeof entry?.name === 'string' ? entry.name : '';
              const workload = isRecord(entry?.workload) ? entry.workload : null;
              const workloadReady = workload && typeof workload['ready'] !== 'undefined' ? workload['ready'] : '0';
              const workloadAvailable =
                workload && typeof workload['available'] !== 'undefined' ? workload['available'] : '0';
              const canRedeploy =
                Boolean(entry?.installed) &&
                (serviceName === 'fcom-processor' || !entry?.running);
              const actionLabel = (microserviceActionLabel || '').toLowerCase();
              const labelKey = String(label).toLowerCase();
              const isActionFor = labelKey && actionLabel.includes(labelKey);
              const isDeploying = isActionFor && actionLabel.startsWith('deploying');
              const isRedeploying = isActionFor && actionLabel.startsWith('redeploying');
              const isWorking = isDeploying || isRedeploying;
              return (
                <div key={serviceName || idx} className="microservice-chain-step">
                  <div
                    className={`microservice-card microservice-card-${tone}${
                      isWorking ? ' microservice-card-working' : ''
                    }${microserviceStatusLoading ? ' microservice-card-refreshing' : ''}`}
                  >
                    {microserviceStatusLoading && (
                      <div className="microservice-card-overlay">
                        <span className="microservice-spinner" aria-hidden="true" />
                        Refreshing...
                      </div>
                    )}
                    <div className="microservice-card-header">
                      <span
                        className={`microservice-dot microservice-dot-${tone}`}
                        aria-hidden="true"
                      />
                      <div className="microservice-card-title">{label}</div>
                    </div>
                    <div className="microservice-card-status">{getServiceStatusText(entry)}</div>
                    {workload && (
                      <div className="microservice-card-meta">
                        Ready {String(workloadReady)} - Available {String(workloadAvailable)}
                      </div>
                    )}
                    {isWorking && (
                      <div className="microservice-card-progress">
                        <span className="microservice-spinner" aria-hidden="true" />
                        Working...
                      </div>
                    )}
                    <div className="microservice-card-actions">
                      {canDeploy && (
                        <button
                          type="button"
                          className="builder-card builder-card-primary"
                          onClick={() => handleDeployMicroservice(serviceName, label)}
                          disabled={redeployLoading || !hasEditPermission}
                        >
                          {isDeploying ? 'Deploying...' : 'Deploy'}
                        </button>
                      )}
                      {canRedeploy && (
                        <button
                          type="button"
                          className="builder-card builder-card-primary"
                          onClick={() => handleRedeployMicroservice(serviceName, label)}
                          disabled={redeployLoading || !hasEditPermission}
                        >
                          {isRedeploying ? 'Redeploying...' : 'Redeploy'}
                        </button>
                      )}
                    </div>
                  </div>
                  {idx < requiredMicroservices.length - 1 && (
                    <div className="microservice-chain-arrow" aria-hidden="true">
                      -&gt;
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            onClick={() => {
              if (!redeployLoading) {
                setRedeployModalOpen(false);
                setRedeployError(null);
              }
            }}
          >
            Close
          </button>
          <button
            type="button"
            className="builder-card"
            onClick={async () => {
              setMicroserviceActionLabel('Refreshing status...');
              await refreshMicroserviceStatus({ refresh: true });
              setMicroserviceActionLabel(null);
            }}
            disabled={microserviceStatusLoading || redeployLoading}
          >
            {microserviceStatusLoading ? 'Refreshing...' : 'Refresh status'}
          </button>
          {redeployReady && (
            <button
              type="button"
              className="builder-card builder-card-primary microservice-pulse"
              onClick={handleRedeployFcomProcessor}
              disabled={redeployLoading || !hasEditPermission}
            >
              Redeploy FCOM Processor
            </button>
          )}
        </div>
      </Modal>
  ) : null;

  const comBrowserPanelProps = {
    hasEditPermission,
    setShowPathModal,
    breadcrumbs,
    handleCrumbClick,
    searchQuery,
    setSearchQuery,
    searchScope,
    setSearchScope,
    handleSearchSubmit,
    searchLoading,
    handleClearSearch: clearSearch,
    handleResetNavigation,
    favoritesFolders,
    favoritesFiles,
    favoritesLoading,
    favoritesError,
    handleOpenFolder,
    openFileFromUrl,
    handleOpenSearchResult,
    searchResults,
    searchError,
    getSearchResultName,
    browseError,
    browseLoading,
    entries,
    isFolder,
    handleOpenFile,
  };

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <h1>COM Curation &amp; Management</h1>
          {isAuthenticated && <AppTabs activeApp={activeApp} onChange={handleAppTabChange} />}
          {isAuthenticated && (
            <div className="header-actions">
              <button
                type="button"
                className={`microservice-indicator microservice-indicator-${microserviceIndicatorState}${
                  microserviceNeedsRedeploy ? ' microservice-pulse' : ''
                }`}
                title={microserviceIndicatorTitle}
                aria-label={microserviceIndicatorTitle}
                onClick={() => {
                  setRedeployError(null);
                  setRedeployModalOpen(true);
                }}
              >
                {microserviceIndicatorLabel ?? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M20 12a8 8 0 1 1-2.34-5.66"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M20 4v6h-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
              <button
                type="button"
                className="user-menu-button"
                onClick={() => {
                  flushSync(() => {
                    setCacheActionMessage(null);
                    setShowUserMenu(true);
                  });
                }}
              >
                Welcome, {session?.user}
              </button>
              <button type="button" className="search-button logout-button" onClick={handleLogout}>
                <span className="logout-icon" aria-hidden="true">
                  🚪
                </span>
                Logout
              </button>
            </div>
          )}
        </header>
        <main className="app-main">
          {isAuthenticated ? (
            <>
              {activeApp === 'overview' ? (
                <OverviewPage
                  overviewStatus={overviewStatus}
                  overviewTopN={overviewTopN}
                  setOverviewTopN={setOverviewTopN}
                  loadOverview={loadOverview}
                  overviewLoading={overviewLoading}
                  overviewVendorFilter={overviewVendorFilter}
                  setOverviewVendorFilter={setOverviewVendorFilter}
                  overviewError={overviewError}
                  overviewData={overviewData}
                  overviewProtocols={overviewProtocols}
                  formatRelativeAge={formatRelativeAge}
                  formatOverviewNumber={formatOverviewNumber}
                  handleOverviewFolderClick={handleOverviewFolderClick}
                  toggleOverviewSort={toggleOverviewSort}
                  getSortIndicator={getSortIndicator}
                  overviewVendorSort={overviewVendorSort}
                />
              ) : activeApp === 'fcom' ? (
                <div className="split-layout">
                  <FcomBrowserPanel {...comBrowserPanelProps} />
                  <div className="panel">
                    <div className="panel-scroll">
                      <div className="file-details">
                        {!selectedFile && (
                          <FcomFolderOverview
                            selectedFolder={selectedFolder}
                            folderLoading={folderLoading}
                            folderOverview={folderOverview}
                            folderTableFilter={folderTableFilter}
                            setFolderTableFilter={setFolderTableFilter}
                            toggleFolderSort={toggleFolderSort}
                            folderTableSort={folderTableSort}
                            folderTableRows={folderTableRows}
                            formatOverviewNumber={formatOverviewNumber}
                            formatDisplayPath={formatDisplayPath}
                            getSortIndicator={getSortIndicator}
                            hasEditPermission={hasEditPermission}
                            showTestControls={isTrapFolderContext}
                            onTestVendor={handleTestVendorFiles}
                            onTestFile={runFileTest}
                            isVendorTesting={vendorTestLoading}
                            isFileTesting={isFileTestLoading}
                          />
                        )}
                        <FcomFileHeader
                          selectedFile={selectedFile}
                          browseNode={browseNode}
                          isFavorite={isFavorite}
                          toggleFavorite={toggleFavorite}
                          formatDisplayPath={formatDisplayPath}
                          fileMethod={fileMethodInfo.method}
                          fileSubMethod={fileMethodInfo.subMethod}
                          overrideInfo={overrideInfo}
                          overrideError={overrideError}
                          hasLocalOverrides={hasLocalOverrides}
                          viewMode={viewMode}
                          setViewMode={setViewMode}
                          openAdvancedFlowModal={openAdvancedFlowModal}
                          hasEditPermission={hasEditPermission}
                          showTestControls={isTrapFileContext}
                          onTestFile={handleTestCurrentFile}
                          fileTestLoading={
                            selectedFile?.PathID ? isFileTestLoading(selectedFile.PathID) : false
                          }
                          fileTestLabel={
                            selectedFile?.PathID ? getVendorFromPath(selectedFile.PathID) : ''
                          }
                          reviewCtaPulse={reviewCtaPulse}
                          setReviewStep={setReviewStep}
                          setShowReviewModal={setShowReviewModal}
                          hasStagedChanges={hasStagedChanges}
                          stagedDiff={stagedDiff}
                          hasGlobalAdvancedFlow={hasGlobalAdvancedFlow}
                          fileError={fileError}
                          saveError={saveError}
                          saveSuccess={saveSuccess}
                          overrideSaveStatus={overrideSaveDisplayStatus}
                          saveLoading={saveLoading}
                          stagedToast={stagedToast}
                          highlightQuery={highlightQuery}
                          highlightFileName={highlightFileName}
                          fileNamePingActive={fileNamePingActive}
                        />
                        <FcomFilePreview
                          selectedFile={selectedFile}
                          fileLoading={fileLoading}
                          fileLoadStage={fileLoadStageDisplay}
                          viewMode={viewMode}
                          isAnyPanelEditing={isAnyPanelEditing}
                          friendlyViewRef={friendlyViewRef}
                          friendlyMainRef={friendlyMainRef}
                          handleFileScroll={handleFileScroll}
                          searchHighlightActive={searchHighlightActive}
                          highlightObjectKeys={highlightObjectKeys}
                          currentMatchIndex={currentMatchIndex}
                          matchObjectOptions={matchObjectOptions}
                          handleJumpToMatch={handleJumpToMatch}
                          handlePrevMatch={handlePrevMatch}
                          handleNextMatch={handleNextMatch}
                          overrideObjectKeys={overrideObjectKeys}
                          overrideMatchIndex={overrideMatchIndex}
                          overrideObjectOptions={overrideObjectOptions}
                          handlePrevOverride={handlePrevOverride}
                          handleNextOverride={handleNextOverride}
                          handleJumpToOverride={handleJumpToOverride}
                          matchPingKey={matchPingKey}
                          getFriendlyObjects={getFriendlyObjects}
                          fileData={fileData}
                          getOverrideFlags={getOverrideFlags}
                          getOverrideTargets={getOverrideTargets}
                          getProcessorTargets={getProcessorTargets}
                          getProcessorFieldSummary={getProcessorFieldSummary}
                          getOverrideValueMap={getOverrideValueMap}
                          getOverrideVersionInfo={getOverrideVersionInfo}
                          canConvertOverrideToV3={canConvertOverrideToV3}
                          convertOverrideToV3={convertOverrideToV3}
                          hasPendingOverrideConversion={hasPendingOverrideConversion}
                          openAdvancedFlowForObject={openAdvancedFlowForObject}
                          getOverrideFileInfoForObject={getOverrideFileInfoForObject}
                          getOverrideMetaForObject={getOverrideMetaForObject}
                          getOverrideRuleLinkForObject={getOverrideRuleLinkForObject}
                          getObjectKey={getObjectKey}
                          registerObjectRowRef={registerObjectRowRef}
                          getEventOverrideFields={getEventOverrideFields}
                          panelEditState={panelEditState}
                          getPanelDirtyFields={getPanelDirtyFields}
                          getBaseEventFields={getBaseEventFields}
                          hasEditPermission={hasEditPermission}
                          showTestControls={isTrapFileContext}
                          isTrapFileContext={isTrapFileContext}
                          openTrapComposerFromTest={openTrapComposerFromTest}
                          getObjectDescription={getObjectDescription}
                          isTestableObject={isTestableObject}
                          startEventEdit={startEventEdit}
                          openRemoveAllOverridesModal={openRemoveAllOverridesModal}
                          openAddFieldModal={openAddFieldModal}
                          builderTarget={builderTarget}
                          saveEventEdit={saveEventEdit}
                          requestCancelEventEdit={requestCancelEventEdit}
                          isFieldHighlighted={isFieldHighlighted}
                          renderFieldBadges={renderFieldBadges}
                          overrideTooltipHoverProps={overrideTooltipHoverProps}
                          openRemoveOverrideModal={openRemoveOverrideModal}
                          renderOverrideSummaryCard={renderOverrideSummaryCard}
                          isFieldDirty={isFieldDirty}
                          isFieldPendingRemoval={isFieldPendingRemoval}
                          isFieldNew={isFieldNew}
                          getStagedDirtyFields={getStagedDirtyFields}
                          isFieldStagedDirty={isFieldStagedDirty}
                          isFieldStagedRemoved={isFieldStagedRemoved}
                          openBuilderForField={openBuilderForField}
                          isFieldLockedByBuilder={isFieldLockedByBuilder}
                          getEffectiveEventValue={getEffectiveEventValue}
                          getEditableValue={getEditableValue}
                          panelDrafts={panelDrafts}
                          handleEventInputChange={handleEventInputChange}
                          renderSummary={renderSummary}
                          renderValue={renderValue}
                          getAdditionalEventFields={getAdditionalEventFields}
                          getEventFieldDescription={getEventFieldDescription}
                          formatEventFieldLabel={formatEventFieldLabel}
                          getBaseEventDisplay={getBaseEventDisplay}
                          renderTrapVariables={renderTrapVariables}
                          builderSidebar={builderSidebar}
                          rawMatchPositions={rawMatchPositions}
                          rawMatchIndex={rawMatchIndex}
                          handlePrevRawMatch={handlePrevRawMatch}
                          handleNextRawMatch={handleNextRawMatch}
                          rawPreviewText={rawPreviewText}
                          highlightQuery={highlightQuery}
                          renderRawHighlightedText={renderRawHighlightedText}
                        />
                        {showReviewModal && (
                          <Modal className="modal-wide" ariaLabel="Review staged changes">
                              {reviewStep === 'review' ? (
                                <>
                                  <div className="staged-review-header">
                                    <h3>Review staged changes</h3>
                                    <div className="staged-review-actions">
                                      <button
                                        type="button"
                                        className="builder-link"
                                        onClick={() => {
                                          const shouldExpand =
                                            Object.values(expandedOriginals).some(Boolean) ===
                                            false;
                                          if (!shouldExpand) {
                                            setExpandedOriginals({});
                                            return;
                                          }
                                          const next: Record<string, boolean> = {};
                                          stagedDiff.sections.forEach((section) => {
                                            section.fieldChanges.forEach((change) => {
                                              const changeKey = `${section.title}-${change.target}-${change.action}`;
                                              next[changeKey] = true;
                                            });
                                          });
                                          setExpandedOriginals(next);
                                        }}
                                        disabled={stagedDiff.totalChanges === 0}
                                      >
                                        {Object.values(expandedOriginals).some(Boolean)
                                          ? 'Collapse all originals'
                                          : 'Expand all originals'}
                                      </button>
                                    </div>
                                  </div>
                                  {stagedDiff.totalChanges === 0 ? (
                                    <div className="empty-state">No staged changes.</div>
                                  ) : (
                                    <div className="staged-changes">
                                      {stagedDiff.sections.map((section) => (
                                        <div key={section.title} className="staged-section">
                                          {(() => {
                                            const sectionKey = section.title;
                                            const isOpen = stagedSectionOpen[sectionKey] ?? false;
                                            const fieldCount = section.fieldChanges.length;
                                            const processorCount = section.processorChanges.length;
                                            return (
                                              <>
                                                <div className="staged-section-header">
                                                  <div className="staged-section-title">
                                                    {section.title}
                                                  </div>
                                                  <div className="staged-section-meta">
                                                    <span>
                                                      {fieldCount} field change
                                                      {fieldCount === 1 ? '' : 's'}
                                                    </span>
                                                    <span>
                                                      {processorCount} processor change
                                                      {processorCount === 1 ? '' : 's'}
                                                    </span>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    className="builder-link"
                                                    onClick={() =>
                                                      setStagedSectionOpen((prev) => ({
                                                        ...prev,
                                                        [sectionKey]: !isOpen,
                                                      }))
                                                    }
                                                  >
                                                    {isOpen ? 'Collapse' : 'Expand'}
                                                  </button>
                                                </div>
                                                {!isOpen && (
                                                  <div className="staged-section-summary">
                                                    <div className="staged-summary-list">
                                                      {section.fieldChanges
                                                        .slice(0, 4)
                                                        .map((change) => (
                                                          <div
                                                            key={`${sectionKey}-${change.target}-${change.action}`}
                                                            className="staged-summary-item"
                                                          >
                                                            <span
                                                              className={`pill change-pill change-pill-${change.action}`}
                                                            >
                                                              {getFieldChangeLabel(change)}
                                                            </span>
                                                            <span className="staged-summary-label">
                                                              {change.target}
                                                            </span>
                                                          </div>
                                                        ))}
                                                      {section.processorChanges
                                                        .slice(0, 2)
                                                        .map((change, idx) => (
                                                          <div
                                                            key={`${sectionKey}-proc-${idx}-${change.action}`}
                                                            className="staged-summary-item"
                                                          >
                                                            <span
                                                              className={`pill change-pill change-pill-${change.action}`}
                                                            >
                                                              {change.action}
                                                            </span>
                                                            <span className="staged-summary-label">
                                                              {getProcessorType(change.processor) ||
                                                                'processor'}
                                                            </span>
                                                          </div>
                                                        ))}
                                                      {fieldCount + processorCount > 6 && (
                                                        <div className="staged-summary-more">
                                                          +{fieldCount + processorCount - 6} more
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                                {isOpen && (
                                                  <>
                                                    {section.fieldChanges.length > 0 && (
                                                      <div className="staged-group">
                                                        <div className="staged-group-title">
                                                          Field changes
                                                        </div>
                                                        {section.fieldChanges.map((change) => {
                                                          const changeKey = `${section.title}-${change.target}-${change.action}`;
                                                          const hasOverrideOriginal =
                                                            change.before !== undefined;
                                                          const baseOriginal = getBaseObjectValue(
                                                            section.objectName,
                                                            change.target,
                                                          );
                                                          const originalValue = hasOverrideOriginal
                                                            ? change.before
                                                            : baseOriginal;
                                                          const hasOriginal =
                                                            hasOverrideOriginal ||
                                                            baseOriginal !== undefined;
                                                          const isExpanded = Boolean(
                                                            expandedOriginals[changeKey],
                                                          );
                                                          const originalLabel = hasOverrideOriginal
                                                            ? 'Original (override)'
                                                            : 'Original (base value)';
                                                          return (
                                                            <div
                                                              key={`${section.title}-${change.target}-${change.action}`}
                                                              className="staged-change"
                                                            >
                                                              <div className="staged-change-header">
                                                                <span className="staged-change-label">
                                                                  {change.target}
                                                                </span>
                                                                <span
                                                                  className={`pill change-pill change-pill-${change.action}`}
                                                                >
                                                                  {getFieldChangeLabel(change)}
                                                                </span>
                                                              </div>
                                                              <div className="staged-change-body">
                                                                {change.after !== undefined && (
                                                                  <div className="staged-change-column">
                                                                    <div className="staged-change-subtitle">
                                                                      After
                                                                    </div>
                                                                    <pre className="code-block diff-block">
                                                                      {renderInlineDiff(
                                                                        originalValue,
                                                                        change.after,
                                                                        'after',
                                                                      )}
                                                                    </pre>
                                                                  </div>
                                                                )}
                                                                {hasOriginal && (
                                                                  <div className="staged-change-column">
                                                                    <button
                                                                      type="button"
                                                                      className="staged-change-toggle"
                                                                      onClick={() => {
                                                                        setExpandedOriginals(
                                                                          (prev) => ({
                                                                            ...prev,
                                                                            [changeKey]:
                                                                              !prev[changeKey],
                                                                          }),
                                                                        );
                                                                      }}
                                                                    >
                                                                      {isExpanded
                                                                        ? 'Hide original'
                                                                        : 'Show original'}
                                                                    </button>
                                                                    {isExpanded && (
                                                                      <>
                                                                        <div className="staged-change-subtitle">
                                                                          {originalLabel}
                                                                        </div>
                                                                        {originalValue ===
                                                                        undefined ? (
                                                                          <div className="staged-change-empty">
                                                                            Not set
                                                                          </div>
                                                                        ) : (
                                                                          <pre className="code-block diff-block">
                                                                            {renderInlineDiff(
                                                                              originalValue,
                                                                              change.after,
                                                                              'original',
                                                                            )}
                                                                          </pre>
                                                                        )}
                                                                      </>
                                                                    )}
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </div>
                                                          );
                                                        })}
                                                      </div>
                                                    )}
                                                    {section.processorChanges.length > 0 && (
                                                      <div className="staged-group">
                                                        <div className="staged-group-title">
                                                          Processor flow changes
                                                        </div>
                                                        {section.processorChanges.map(
                                                          (change, idx) => (
                                                            <div
                                                              key={`${section.title}-proc-${idx}-${change.action}`}
                                                              className="staged-change"
                                                            >
                                                              <div className="staged-change-header">
                                                                <span className="staged-change-label">
                                                                  {getProcessorType(
                                                                    change.processor,
                                                                  ) || 'processor'}
                                                                </span>
                                                                <span
                                                                  className={`pill change-pill change-pill-${change.action}`}
                                                                >
                                                                  {change.action}
                                                                </span>
                                                              </div>
                                                              <div className="staged-change-body">
                                                                <div className="staged-change-column">
                                                                  <div className="staged-change-subtitle">
                                                                    Summary
                                                                  </div>
                                                                  <div className="builder-preview-lines">
                                                                    {getProcessorSummaryLines(
                                                                      change.processor,
                                                                    ).map((line, lineIdx) => (
                                                                      <span
                                                                        key={`${line}-${lineIdx}`}
                                                                      >
                                                                        {line}
                                                                      </span>
                                                                    ))}
                                                                  </div>
                                                                  <pre className="code-block">
                                                                    {JSON.stringify(
                                                                      change.processor,
                                                                      null,
                                                                      2,
                                                                    )}
                                                                  </pre>
                                                                </div>
                                                              </div>
                                                            </div>
                                                          ),
                                                        )}
                                                      </div>
                                                    )}
                                                  </>
                                                )}
                                              </>
                                            );
                                          })()}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="modal-actions">
                                    <button type="button" onClick={() => setShowReviewModal(false)}>
                                      Close
                                    </button>
                                    <button
                                      type="button"
                                      className="ghost-button"
                                      onClick={() => {
                                        setPendingReviewDiscard(true);
                                      }}
                                      disabled={saveLoading}
                                    >
                                      Discard changes
                                    </button>
                                    <button
                                      type="button"
                                      className="builder-card builder-card-primary"
                                      onClick={() => setReviewStep('commit')}
                                      disabled={stagedDiff.totalChanges === 0 || !hasEditPermission}
                                    >
                                      Continue to Commit
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <h3>Commit message</h3>
                                  <input
                                    type="text"
                                    placeholder="Enter commit message here"
                                    value={commitMessage}
                                    onChange={(e) => setCommitMessage(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key !== 'Enter') {
                                        return;
                                      }
                                      e.preventDefault();
                                      if (saveLoading || !hasEditPermission) {
                                        return;
                                      }
                                      handleSaveOverrides(commitMessage);
                                      setShowReviewModal(false);
                                      setReviewStep('review');
                                    }}
                                    disabled={!hasEditPermission}
                                  />
                                  <div className="modal-actions">
                                    <button type="button" onClick={() => setReviewStep('review')}>
                                      Back to Review
                                    </button>
                                    <button
                                      type="button"
                                      className="builder-card builder-card-primary"
                                      onClick={() => {
                                        handleSaveOverrides(commitMessage);
                                        setShowReviewModal(false);
                                        setReviewStep('review');
                                      }}
                                      disabled={saveLoading || !hasEditPermission}
                                    >
                                      {saveLoading ? 'Saving…' : 'Commit Changes'}
                                    </button>
                                  </div>
                                </>
                              )}
                          </Modal>
                        )}
                        {showBuilderHelpModal && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal modal-wide">
                              <h3>Builder Help</h3>
                              <div className="builder-help-section">
                                <h4>Processor Builder</h4>
                                <p>
                                  Use processors to transform or set event fields after a match.
                                  Select a processor, configure inputs, and review the generated
                                  JSON before applying.
                                </p>
                                <ul>
                                  <li>
                                    <strong>Set</strong>: assign a literal or copy from a field
                                    path.
                                  </li>
                                  <li>
                                    <strong>Regex</strong>: extract a value using a capture group.
                                  </li>
                                </ul>
                              </div>
                              <div className="builder-help-section">
                                <h4>Eval Builder</h4>
                                <p>
                                  Use Friendly for guided conditions or Regular for raw expressions.
                                  Click $v tokens to see trap variable details.
                                </p>
                              </div>
                              <div className="builder-help-section">
                                <h4>References</h4>
                                <p>Docs: architecture/FCOM_Curation_UI_Plan.md</p>
                                <p>UA REST/processor docs (internal UA documentation).</p>
                              </div>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => setShowBuilderHelpModal(false)}
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        <FcomAdvancedFlowModal
                          showAdvancedProcessorModal={showAdvancedProcessorModal}
                          pendingAdvancedFlowClose={pendingAdvancedFlowClose}
                          getModalOverlayStyle={getModalOverlayStyle}
                          advancedFlowModalRef={advancedFlowModalRef}
                          advancedProcessorScope={advancedProcessorScope}
                          requestCloseAdvancedFlowModal={requestCloseAdvancedFlowModal}
                          advancedFlowDirty={advancedFlowDirty}
                          flowErrorCount={flowErrorCount}
                          advancedFlowRemovedTargets={advancedFlowRemovedTargets}
                          formatFlowTargetLabel={formatFlowTargetLabel}
                          advancedProcessorSearch={advancedProcessorSearch}
                          onAdvancedProcessorSearchChange={setAdvancedProcessorSearch}
                          advancedFlowVersionInfo={
                            advancedFlowTarget?.objectName
                              ? getOverrideVersionInfo(advancedFlowTarget.objectName)
                              : null
                          }
                          advancedFlowNotice={advancedFlowNotice}
                          advancedFlowPatchPreview={advancedFlowPatchPreview}
                          canConvertToV3={
                            Boolean(
                              advancedFlowTarget?.objectName &&
                                canConvertOverrideToV3(advancedFlowTarget.objectName),
                            )
                          }
                          onConvertToV3={() => {
                            if (advancedFlowTarget?.objectName) {
                              convertOverrideToV3(advancedFlowTarget.objectName);
                              setAdvancedFlowNotice(
                                'Conversion ready. Save the object to stage the v3 patch.',
                              );
                            }
                          }}
                          advancedFlowFocusTarget={advancedFlowFocusTarget}
                          advancedFlowFocusIndex={advancedFlowFocusIndex}
                          advancedFlowFocusOnly={advancedFlowFocusOnly}
                          focusedFlowMatch={Boolean(focusedFlowMatch)}
                          focusedFlowMatches={focusedFlowMatches}
                          focusedLaneLabel={focusedLaneLabel}
                          setAdvancedFlowFocusTarget={setAdvancedFlowFocusTarget}
                          setAdvancedFlowFocusIndex={setAdvancedFlowFocusIndex}
                          setAdvancedFlowFocusOnly={setAdvancedFlowFocusOnly}
                          paletteSections={paletteSections}
                          renderProcessorHelp={renderProcessorHelp}
                          renderFlowList={renderFlowList}
                          globalPreFlow={globalPreFlow}
                          setGlobalPreFlow={setGlobalPreFlow}
                          globalPostFlow={globalPostFlow}
                          setGlobalPostFlow={setGlobalPostFlow}
                          advancedFlow={advancedFlow}
                          setAdvancedFlow={setAdvancedFlow}
                          flowValidation={flowValidation}
                          renderFlowJsonPreview={renderFlowJsonPreview}
                          buildFlowProcessors={(nodes, _normalizeSourcePath) =>
                            buildFlowProcessors(nodes)
                          }
                          normalizeSourcePath={normalizeSourcePath}
                          hasEditPermission={hasEditPermission}
                          triggerFlowErrorPulse={triggerFlowErrorPulse}
                          saveAdvancedFlow={saveAdvancedFlow}
                          onCancelAdvancedFlowClose={() => setPendingAdvancedFlowClose(false)}
                          onConfirmAdvancedFlowClose={() => {
                            setPendingAdvancedFlowClose(false);
                            setShowAdvancedProcessorModal(false);
                            setFlowEditor(null);
                            setFlowEditorDraft(null);
                            setAdvancedFlowDefaultTarget(null);
                          }}
                        />
                        <FcomFlowEditorModal
                          flowEditor={flowEditor}
                          flowEditorDraft={flowEditorDraft}
                          flowEditorModalRef={flowEditorModalRef}
                          getModalOverlayStyle={getModalOverlayStyle}
                          getFlowNodeLabel={getFlowNodeLabel}
                          onShowFieldReference={() => setShowFieldReferenceModal(true)}
                          applyFlowEditorExample={applyFlowEditorExample}
                          renderProcessorConfigFields={renderProcessorConfigFields}
                          flowEditorFieldErrors={flowEditorFieldErrors}
                          handleFlowEditorInputChange={handleFlowEditorInputChange}
                          setFlowEditorDraft={setFlowEditorDraft}
                          renderFlowList={renderFlowList}
                          validateFlowNodes={validateFlowNodes}
                          nextSwitchCaseId={nextSwitchCaseId}
                          flowEditorNodeErrors={flowEditorNodeErrors}
                          flowEditorHasErrors={flowEditorHasErrors}
                          triggerValidationPulse={triggerValidationPulse}
                          onCancelFlowEditor={handleCancelFlowEditor}
                          onSaveFlowEditor={handleSaveFlowEditor}
                        />
                        {showFieldReferenceModal && (
                          <div
                            className={`modal-overlay${
                              showAdvancedProcessorModal || flowEditor ? ' modal-overlay-top' : ''
                            }`}
                            style={getModalOverlayStyle('fieldReference', 2)}
                            role="dialog"
                            aria-modal="true"
                          >
                            <div className="modal modal-wide">
                              <h3>Field Reference</h3>
                              <div className="field-reference">
                                <div className="field-reference-section">
                                  <div className="field-reference-title">Common JSON paths</div>
                                  <ul>
                                    <li>$.event.* (post scope event fields)</li>
                                    <li>$.trap.*, $.syslog.* (method-specific inputs)</li>
                                    <li>$.localmem.* (per-event memory)</li>
                                    <li>$.globalmem.* (requires Coherence)</li>
                                    <li>$.lookups.&lt;lookup&gt;.&lt;key&gt;</li>
                                    <li>$.foreach.&lt;keyField|valField&gt;</li>
                                    <li>$.error.message</li>
                                  </ul>
                                </div>
                                <div className="field-reference-section">
                                  <div className="field-reference-title">
                                    Event fields (from this file)
                                  </div>
                                  {availableEventFields.length === 0 ? (
                                    <div className="field-reference-empty">
                                      No event fields found in this file.
                                    </div>
                                  ) : (
                                    <div className="field-reference-grid">
                                      {availableEventFields.map((field) => (
                                        <span
                                          key={field}
                                          className="field-reference-chip"
                                          title={getEventFieldDescription(field)}
                                        >
                                          $.event.{field}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => setShowFieldReferenceModal(false)}
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {builderSwitchModal.open && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>Switch builder type</h3>
                              <p>
                                Switch from {builderSwitchModal.from} to {builderSwitchModal.to}?
                                This will replace the current configuration.
                              </p>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => setBuilderSwitchModal({ open: false })}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (builderSwitchModal.to) {
                                      applyBuilderTypeSwitch(builderSwitchModal.to);
                                    }
                                    setBuilderSwitchModal({ open: false });
                                  }}
                                >
                                  Switch
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {removeOverrideModal.open && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>
                                {removeOverrideModal.isNewField
                                  ? 'Remove field'
                                  : 'Remove override'}
                              </h3>
                              <p>
                                {removeOverrideModal.isNewField
                                  ? 'Removing this field will discard it on save.'
                                  : 'Removing this override will default to original value:'}
                              </p>
                              {!removeOverrideModal.isNewField && (
                                <pre className="code-block">
                                  {removeOverrideModal.baseValue ?? '—'}
                                </pre>
                              )}
                              <p>Are you sure?</p>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => setRemoveOverrideModal({ open: false })}
                                >
                                  No
                                </button>
                                <button type="button" onClick={confirmRemoveOverride}>
                                  Yes
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {removeAllOverridesModal.open && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>Remove all overrides</h3>
                              {(removeAllOverridesModal.fields?.length || 0) > 0 ? (
                                <>
                                  <p>The below listed fields will be reset to original values:</p>
                                  <pre className="code-block">
                                    {JSON.stringify(
                                      removeAllOverridesModal.baseValues ?? {},
                                      null,
                                      2,
                                    )}
                                  </pre>
                                  <p>Are you sure?</p>
                                </>
                              ) : (
                                <p>No direct overrides can be removed here.</p>
                              )}
                              {removeAllOverridesModal.hasAdvancedFlow && (
                                <>
                                  <p className="modal-warning">
                                    Advanced Flow processors won’t be removed here.
                                  </p>
                                  <button
                                    type="button"
                                    className="link-button"
                                    onClick={() => {
                                      const objectName = removeAllOverridesModal.objectName;
                                      if (objectName) {
                                        openAdvancedFlowModal(
                                          'object',
                                          objectName,
                                          null,
                                        );
                                      }
                                    }}
                                  >
                                    Open Advanced Flow
                                  </button>
                                </>
                              )}
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => setRemoveAllOverridesModal({ open: false })}
                                >
                                  {(removeAllOverridesModal.fields?.length || 0) > 0
                                    ? 'No'
                                    : 'Close'}
                                </button>
                                {(removeAllOverridesModal.fields?.length || 0) > 0 && (
                                  <button type="button" onClick={confirmRemoveAllOverrides}>
                                    Yes
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {processorTooltip && (
                          <div
                            className="floating-help-tooltip"
                            style={{ left: processorTooltip.x, top: processorTooltip.y }}
                            role="tooltip"
                          >
                            <div className="floating-help-title">{processorTooltip.title}</div>
                            <div className="floating-help-text">{processorTooltip.description}</div>
                            <div className="floating-help-code">{processorTooltip.example}</div>
                          </div>
                        )}
                        {panelNavWarning.open && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>Unsaved panel edits</h3>
                              <p>Please save or cancel the panel edits before navigating away.</p>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanelNavWarning((prev) => ({ ...prev, open: false }))
                                  }
                                >
                                  OK
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {pendingNav && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>Unsaved changes</h3>
                              <p>You have unsaved changes. Discard and navigate away?</p>
                              <div className="modal-actions">
                                <button type="button" onClick={() => setPendingNav(null)}>
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const action = pendingNav;
                                    setPendingNav(null);
                                    discardAllEdits();
                                    if (action) {
                                      action();
                                    }
                                  }}
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {pendingCancel && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>Discard changes?</h3>
                              <p>You have unsaved changes. Discard them?</p>
                              <div className="modal-actions">
                                <button type="button" onClick={() => setPendingCancel(null)}>
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = pendingCancel;
                                    setPendingCancel(null);
                                    if (!next) {
                                      return;
                                    }
                                    if (next.type === 'builder') {
                                      closeBuilder();
                                      return;
                                    }
                                    if (next.type === 'panel' && next.panelKey) {
                                      discardEventEdit(next.panelKey);
                                    }
                                  }}
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {pendingReviewDiscard && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>Discard changes?</h3>
                              <p>Discard all staged changes?</p>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => setPendingReviewDiscard(false)}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPendingReviewDiscard(false);
                                    discardAllEdits();
                                    setShowReviewModal(false);
                                  }}
                                >
                                  Discard
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {saveLoading && (
                          <div className="save-overlay" aria-live="polite" aria-busy="true">
                            <div className="save-overlay-card">
                              <div className="save-overlay-main">
                                <div className="save-spinner" aria-hidden="true" />
                                <div>
                                  <div className="save-overlay-title">Saving changes…</div>
                                  <div className="save-overlay-subtitle">
                                    Please wait{saveElapsed ? ` • ${saveElapsed}s` : ''}
                                  </div>
                                </div>
                              </div>
                              {overrideSaveDisplayStatus.length > 0 && (
                                <div className="save-overlay-status">
                                  <div className="save-overlay-status-header">
                                    <span>Override files</span>
                                    <span>
                                      {
                                        overrideSaveDisplayStatus.filter(
                                          (entry) => entry.status === 'done',
                                        ).length
                                      }
                                      /{overrideSaveDisplayStatus.length} complete
                                    </span>
                                  </div>
                                  <div className="save-overlay-status-list">
                                    {overrideSaveDisplayStatus.map((entry) => {
                                      const label =
                                        entry.status === 'done'
                                          ? 'Done'
                                          : entry.status === 'failed'
                                            ? 'Failed'
                                            : entry.status === 'retrying'
                                              ? 'Retrying'
                                              : entry.status === 'saving'
                                                ? 'Saving'
                                                : 'Queued';
                                      return (
                                        <div
                                          key={`${entry.objectName}-${entry.fileName}`}
                                          className="save-overlay-status-item"
                                        >
                                          <span className="save-overlay-status-name">
                                            {entry.fileName}
                                          </span>
                                          <span
                                            className={`save-overlay-status-pill save-overlay-status-pill-${entry.status}`}
                                          >
                                            {label}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {redeployLoading && (
                          <div className="save-overlay" aria-live="polite" aria-busy="true">
                            <div className="save-overlay-card">
                              <div className="save-spinner" aria-hidden="true" />
                              <div>
                                <div className="save-overlay-title">
                                  {microserviceActionLabel || 'Updating microservices…'}
                                </div>
                                <div className="save-overlay-subtitle">
                                  Please wait{redeployElapsed ? ` • ${redeployElapsed}s` : ''}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {showAddFieldModal && addFieldContext && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal modal-wide">
                              <h3>Add Event Field</h3>
                              <p>Select a field from this file, or add a new one.</p>
                              <input
                                type="text"
                                placeholder="Search fields"
                                value={addFieldSearch}
                                onChange={(e) => setAddFieldSearch(e.target.value)}
                              />
                              <div className="add-field-list">
                                {availableEventFields
                                  .filter((field) =>
                                    field.toLowerCase().includes(addFieldSearch.toLowerCase()),
                                  )
                                  .map((field) => {
                                    const contextObj = isRecord(addFieldContext.obj)
                                      ? addFieldContext.obj
                                      : null;
                                    const contextEvent =
                                      contextObj && isRecord(contextObj.event) ? contextObj.event : {};
                                    const existingFields = new Set([
                                      ...Object.keys(contextEvent),
                                      ...(panelAddedFields[addFieldContext.panelKey] || []),
                                    ]);
                                    const isReserved = reservedEventFields.has(field);
                                    const isExisting = existingFields.has(field);
                                    const description = getEventFieldDescription(field);
                                    const titleParts = [
                                      ...(isReserved ? ['Reserved field'] : []),
                                      ...(isExisting ? ['Already present'] : []),
                                      ...(description ? [description] : []),
                                    ];
                                    return (
                                      <button
                                        key={field}
                                        type="button"
                                        className={
                                          isReserved || isExisting
                                            ? 'add-field-item add-field-item-disabled'
                                            : 'add-field-item'
                                        }
                                        onClick={() => {
                                          if (!isReserved && !isExisting) {
                                            addFieldToPanel(field);
                                          }
                                        }}
                                        disabled={isReserved || isExisting}
                                        title={titleParts.join(' • ')}
                                      >
                                        {field}
                                      </button>
                                    );
                                  })}
                                {availableEventFields.length === 0 && (
                                  <div className="empty-state">
                                    No event fields found in this file.
                                  </div>
                                )}
                                {addFieldSearch.trim() &&
                                  !availableEventFields.some(
                                    (field) =>
                                      field.toLowerCase() === addFieldSearch.trim().toLowerCase(),
                                  ) && (
                                    <button
                                      type="button"
                                      className="add-field-item"
                                      onClick={() => addFieldToPanel(addFieldSearch.trim())}
                                    >
                                      Add "{addFieldSearch.trim()}"
                                    </button>
                                  )}
                              </div>
                              <div className="modal-actions">
                                <button type="button" onClick={() => setShowAddFieldModal(false)}>
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {showPathModal && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal">
                              <h3>Tool Overview</h3>
                              <div className="help-section">
                                <h4>Current Path</h4>
                                <div className="path-row">
                                  <div className="path-value monospace">{getCurrentPath()}</div>
                                  <button
                                    type="button"
                                    className="copy-button"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(getCurrentPath());
                                      } catch {
                                        // ignore
                                      }
                                    }}
                                  >
                                    Copy
                                  </button>
                                </div>
                                <p className="path-note">
                                  UA internal paths use an{' '}
                                  <span className="code-pill">id-core</span> prefix. The UI displays
                                  the cleaned path for readability.
                                </p>
                              </div>
                              <div className="help-section">
                                <h4>Search modes</h4>
                                <ul>
                                  <li>
                                    <strong>Names</strong>: searches file and folder names (and
                                    paths).
                                  </li>
                                  <li>
                                    <strong>Content</strong>: searches inside file contents only.
                                  </li>
                                  <li>
                                    <strong>All</strong>: searches both names and contents.
                                  </li>
                                </ul>
                              </div>

                              <div className="modal-actions">
                                <button type="button" onClick={() => setShowPathModal(false)}>
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {varModalOpen && (
                          <div
                            className="modal-overlay"
                            style={getModalOverlayStyle('varModal', 2)}
                            role="dialog"
                            aria-modal="true"
                          >
                            <div className="modal modal-wide">
                              <h3>
                                Trap variables ({varModalVars.length})
                                {varModalToken ? ` for ${varModalToken}` : ''}
                              </h3>
                              {varModalMode === 'insert' && (
                                <p className="muted">Select a variable to insert.</p>
                              )}
                              {varModalVars.length === 0 ? (
                                <div className="empty-state">No trap variables available.</div>
                              ) : (
                                <div className="var-list" ref={varListRef}>
                                  {varModalVars.map((variable: any, index: number) => {
                                    const token = `$v${index + 1}`;
                                    const isSelected = token === varModalToken;
                                    return (
                                      <div
                                        className={`trap-var${isSelected ? ' trap-var-selected' : ''}${varModalMode === 'insert' ? ' trap-var-clickable' : ''}`}
                                        key={variable?.name || variable?.oid || index}
                                        ref={(el) => {
                                          varRowRefs.current[token] = el;
                                        }}
                                        role={varModalMode === 'insert' ? 'button' : undefined}
                                        tabIndex={varModalMode === 'insert' ? 0 : undefined}
                                        onClick={() => {
                                          if (varModalMode === 'insert') {
                                            handleVarInsertSelect(token);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (
                                            varModalMode === 'insert' &&
                                            (e.key === 'Enter' || e.key === ' ')
                                          ) {
                                            e.preventDefault();
                                            handleVarInsertSelect(token);
                                          }
                                        }}
                                      >
                                        <div className="trap-var-title">
                                          <span className="trap-var-name">
                                            {renderValue(variable?.name)}
                                          </span>
                                          <span
                                            className={`pill${isSelected ? ' pill-selected' : ''}`}
                                          >
                                            {token}
                                          </span>
                                          {variable?.valueType && (
                                            <span className="pill">{variable.valueType}</span>
                                          )}
                                        </div>
                                        <div className="trap-var-grid">
                                          <div className="trap-var-col">
                                            <div className="trap-var-row">
                                              <span className="label">OID</span>
                                              <span className="value monospace">
                                                {renderValue(variable?.oid)}
                                              </span>
                                            </div>
                                            <div className="trap-var-row">
                                              <span className="label">Description</span>
                                              <span className="value">
                                                {formatDescription(variable?.description)}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="trap-var-col">
                                            {renderEnums(variable?.enums) || (
                                              <span className="muted">No enums</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVarModalOpen(false);
                                    setVarModalMode('view');
                                    setVarInsertContext(null);
                                  }}
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {eventFieldPickerOpen && (
                          <div className="modal-overlay" role="dialog" aria-modal="true">
                            <div className="modal modal-wide">
                              <h3>Event Fields</h3>
                              <input
                                type="text"
                                placeholder="Search event fields"
                                value={eventFieldSearch}
                                onChange={(e) => setEventFieldSearch(e.target.value)}
                              />
                              <div className="add-field-list">
                                {availableEventFields
                                  .filter((field) =>
                                    field
                                      .toLowerCase()
                                      .includes(eventFieldSearch.trim().toLowerCase()),
                                  )
                                  .map((field) => (
                                    <button
                                      type="button"
                                      key={field}
                                      className="add-field-item"
                                      onClick={() => handleEventFieldInsertSelect(field)}
                                      title={getEventFieldDescription(field)}
                                    >
                                      $.event.{field}
                                    </button>
                                  ))}
                                {availableEventFields.length === 0 && (
                                  <div className="empty-state">
                                    No event fields found in this file.
                                  </div>
                                )}
                                {eventFieldSearch.trim() &&
                                  !availableEventFields.some(
                                    (field) =>
                                      field.toLowerCase() === eventFieldSearch.trim().toLowerCase(),
                                  ) && (
                                    <button
                                      type="button"
                                      className="add-field-item"
                                      onClick={() =>
                                        handleEventFieldInsertSelect(eventFieldSearch.trim())
                                      }
                                    >
                                      Add "{eventFieldSearch.trim()}"
                                    </button>
                                  )}
                              </div>
                              <div className="modal-actions">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEventFieldPickerOpen(false);
                                    setEventFieldInsertContext(null);
                                  }}
                                >
                                  Close
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeApp === 'pcom' ? (
                <div className="split-layout">
                  <FcomBrowserPanel {...comBrowserPanelProps} />
                  <div className="panel">
                    <div className="panel-scroll">
                      <div className="file-details">
                        <FileTitleRow
                          title={selectedFile?.PathName ? selectedFile.PathName : 'Select a PCOM file'}
                          path={selectedFile && selectedFile.PathID ? formatDisplayPath(selectedFile.PathID) : null}
                          favorite={
                            selectedFile
                              ? {
                                  active: isFavorite('file', String(selectedFile.PathID || '')),
                                  onToggle: () =>
                                    toggleFavorite({
                                      type: 'file',
                                      pathId: String(selectedFile.PathID || ''),
                                      label: String(selectedFile.PathName || selectedFile.PathID || ''),
                                      node: browseNode || undefined,
                                    }),
                                }
                              : null
                          }
                        />
                        <ActionRow>
                          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
                          <button
                            type="button"
                            className="action-link"
                            disabled
                            title="Stub only (no file creation yet)"
                          >
                            Create PCOM (Stub)
                          </button>
                        </ActionRow>
                        <ComFilePreview
                          selectedFile={selectedFile}
                          viewMode={viewMode}
                          emptyState={
                            <div className="empty-state">Select a file on the left to view it.</div>
                          }
                          friendlyView={
                            <div className="friendly-view pcom-friendly-view">
                              {!pcomParsed ? (
                                <div className="empty-state">No PCOM data loaded.</div>
                              ) : (
                                <>
                                  <div className="pcom-card pcom-summary-card">
                                    <div className="pcom-section-title">Vendor Summary</div>
                                    <div className="pcom-summary-grid">
                                      <div className="pcom-summary-item">
                                        <div className="pcom-summary-label">Vendor</div>
                                        <div className="pcom-summary-value">
                                          {formatPcomValue(pcomParsed['@vendor'])}
                                        </div>
                                      </div>
                                      <div className="pcom-summary-item">
                                        <div className="pcom-summary-label">MIBs</div>
                                        <div className="pcom-summary-value">
                                          {formatPcomValue(pcomParsed.mibs)}
                                        </div>
                                      </div>
                                      <div className="pcom-summary-item">
                                        <div className="pcom-summary-label">Enterprise OIDs</div>
                                        <div className="pcom-summary-value">
                                          {formatPcomValue(pcomParsed.enterpriseOids)}
                                        </div>
                                      </div>
                                      <div className="pcom-summary-item">
                                        <div className="pcom-summary-label">Aliases</div>
                                        <div className="pcom-summary-value">
                                          {formatPcomValue(pcomParsed.aliases)}
                                        </div>
                                      </div>
                                      <div className="pcom-summary-item">
                                        <div className="pcom-summary-label">Notes</div>
                                        <div className="pcom-summary-value">
                                          {formatPcomValue(pcomParsed.notes)}
                                        </div>
                                      </div>
                                      <div className="pcom-summary-item">
                                        <div className="pcom-summary-label">Objects</div>
                                        <div className="pcom-summary-value">
                                          {pcomObjectEntries.length}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="pcom-friendly-layout">
                                    <div className="pcom-friendly-column">
                                      <div className="pcom-card pcom-object-card">
                                        <div className="pcom-section-title">
                                          Objects ({pcomObjectEntries.length})
                                        </div>
                                        <div className="pcom-object-list">
                                          {pcomObjectEntries.length === 0 ? (
                                            <div className="empty-state">No objects found.</div>
                                          ) : (
                                            pcomObjectEntries.map((entry) => (
                                              <button
                                                key={entry.key}
                                                type="button"
                                                className={`pcom-object-row${
                                                  entry.key === pcomSelectedObject?.key
                                                    ? ' pcom-object-row-active'
                                                    : ''
                                                }`}
                                                onClick={() => setPcomSelectedObjectKey(entry.key)}
                                              >
                                                <div className="pcom-object-row-title">
                                                  {entry.name}
                                                </div>
                                                <div className="pcom-object-row-meta">
                                                  {entry.obj?.class && (
                                                    <span className="pill">{entry.obj.class}</span>
                                                  )}
                                                  {entry.obj?.subClass && (
                                                    <span className="pill">{entry.obj.subClass}</span>
                                                  )}
                                                  {entry.obj?.certification && (
                                                    <span className="pill">
                                                      {entry.obj.certification}
                                                    </span>
                                                  )}
                                                </div>
                                              </button>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="pcom-friendly-column">
                                      <div className="pcom-card pcom-detail-card">
                                        <div className="pcom-section-title">Object Details</div>
                                        {!pcomSelectedObject ? (
                                          <div className="empty-state">
                                            Select an object to view details.
                                          </div>
                                        ) : (
                                          (() => {
                                            const obj = pcomSelectedObject.obj || {};
                                            const snmp = obj.snmp || {};
                                            const values = Array.isArray(snmp.values)
                                              ? snmp.values
                                              : [];
                                            const discovery = snmp.discovery || {};
                                            const filterLabel = Array.isArray(snmp.filter)
                                              ? `${snmp.filter.length} filter(s)`
                                              : formatPcomValue(snmp.filter);
                                            return (
                                              <>
                                                <div className="pcom-detail-title">
                                                  {pcomSelectedObject.name}
                                                </div>
                                                <div className="pcom-detail-grid">
                                                  <div className="pcom-detail-label">Class</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(obj.class)}
                                                  </div>
                                                  <div className="pcom-detail-label">SubClass</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(obj.subClass)}
                                                  </div>
                                                  <div className="pcom-detail-label">Certification</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(obj.certification)}
                                                  </div>
                                                  <div className="pcom-detail-label">Weight</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(obj.weight)}
                                                  </div>
                                                  <div className="pcom-detail-label">Domain</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(obj.domain)}
                                                  </div>
                                                  <div className="pcom-detail-label">Method</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(obj.method)}
                                                  </div>
                                                  <div className="pcom-detail-label">Description</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(obj.description)}
                                                  </div>
                                                </div>
                                                <div className="pcom-section-subtitle">SNMP</div>
                                                <div className="pcom-detail-grid">
                                                  <div className="pcom-detail-label">Discovery Name</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(discovery.name)}
                                                  </div>
                                                  <div className="pcom-detail-label">Discovery OID</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(discovery.oid)}
                                                  </div>
                                                  <div className="pcom-detail-label">Instance</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(snmp.instance)}
                                                  </div>
                                                  <div className="pcom-detail-label">Factor</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(snmp.factor)}
                                                  </div>
                                                  <div className="pcom-detail-label">Maximum</div>
                                                  <div className="pcom-detail-value">
                                                    {formatPcomValue(snmp.maximum)}
                                                  </div>
                                                  <div className="pcom-detail-label">Filter</div>
                                                  <div className="pcom-detail-value">{filterLabel}</div>
                                                  <div className="pcom-detail-label">Values</div>
                                                  <div className="pcom-detail-value">
                                                    {values.length}
                                                  </div>
                                                </div>
                                                <div className="pcom-section-subtitle">Values</div>
                                                <div className="pcom-values-list">
                                                  {values.length === 0 ? (
                                                    <div className="empty-state">No values defined.</div>
                                                  ) : (
                                                    values.map((value: any, index: number) => {
                                                      const title =
                                                        value?.name ||
                                                        value?.metricType ||
                                                        `Value ${index + 1}`;
                                                      return (
                                                        <div key={`${title}-${index}`} className="pcom-value-row">
                                                          <div className="pcom-value-title">{title}</div>
                                                          <div className="pcom-value-meta">
                                                            <span>
                                                              Metric: {formatPcomValue(value?.metricType)}
                                                            </span>
                                                            <span>
                                                              Type: {formatPcomValue(value?.valueType)}
                                                            </span>
                                                            {value?.oid && (
                                                              <span>OID: {formatPcomValue(value?.oid)}</span>
                                                            )}
                                                            {value?.eval && <span>Eval</span>}
                                                          </div>
                                                        </div>
                                                      );
                                                    })
                                                  )}
                                                </div>
                                              </>
                                            );
                                          })()
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          }
                          rawView={
                            <FcomRawPreview
                              searchHighlightActive={searchHighlightActive}
                              highlightQuery={highlightQuery}
                              rawMatchPositions={rawMatchPositions}
                              rawMatchIndex={rawMatchIndex}
                              handlePrevRawMatch={handlePrevRawMatch}
                              handleNextRawMatch={handleNextRawMatch}
                              rawPreviewText={editorText}
                              renderRawHighlightedText={renderRawHighlightedText}
                            />
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeApp === 'legacy' ? (
                <LegacyWorkspace />
              ) : (
                <MibWorkspace
                  isCompactPanel={isCompactPanel}
                  mibPath={mibPath}
                  mibSearch={mibSearch}
                  mibSearchScope={mibSearchScope}
                  mibSearchMode={mibSearchMode}
                  mibLoading={mibLoading}
                  mibShowLoadingTimer={mibShowLoadingTimer}
                  mibLoadingElapsed={mibLoadingElapsed}
                  mibError={mibError}
                  mibEntries={mibEntries}
                  mibTotal={mibTotal}
                  mibFilteredTotal={mibFilteredTotal}
                  mibHasMore={mibHasMore}
                  mibSelectedFile={mibSelectedFile}
                  mibSelectedSupport={mibSelectedSupport}
                  mibDefinitionCounts={mibDefinitionCounts}
                  mib2FcomLoading={mib2FcomLoading}
                  mibUseParent={mibUseParent}
                  mib2FcomError={mib2FcomError}
                  mibOutput={mibOutput}
                  mibOutputName={mibOutputName}
                  mibDefinitionSearch={mibDefinitionSearch}
                  mibObjectFilter={mibObjectFilter}
                  mibDetailsLoading={mibDetailsLoading}
                  mibSelectedDefinition={mibSelectedDefinition}
                  filteredMibDefinitions={filteredMibDefinitions}
                  mibSupportByPath={mibSupportByPath}
                  pcomAdvancedActive={pcomAdvancedActive}
                  pcomAdvancedSummary={pcomAdvancedSummary}
                  pcomSnmpProfileLoading={pcomSnmpProfileLoading}
                  pcomSnmpProfileError={pcomSnmpProfileError}
                  pcomSnmpProfile={pcomSnmpProfile}
                  pcomDeviceIp={pcomDeviceIp}
                  pcomDevicesLoading={pcomDevicesLoading}
                  pcomDeviceOptions={pcomDeviceOptions}
                  pcomDeviceOptionsWithManual={pcomDeviceOptionsWithManual}
                  pcomActiveTarget={pcomActiveTarget}
                  pcomPollLoading={pcomPollLoading}
                  pcomPollError={pcomPollError}
                  pcomPollOutput={pcomPollOutput}
                  pcomDevicesError={pcomDevicesError}
                  favoritesFolders={favoritesFolders}
                  favoritesFiles={favoritesFiles}
                  favoritesLoading={favoritesLoading}
                  favoritesError={favoritesError}
                  hasEditPermission={hasEditPermission}
                  buildBreadcrumbsFromPath={buildBreadcrumbsFromPath}
                  handleMibSearchSubmit={handleMibSearchSubmit}
                  handleMibClearSearch={handleMibClearSearch}
                  loadMibPath={loadMibPath}
                  loadMibSearch={loadMibSearch}
                  handleOpenMibEntry={handleOpenMibEntry}
                  openMibFavorite={openMibFavorite}
                  getMibSupportStatus={getMibSupportStatus}
                  getSupportedCountLabel={getSupportedCountLabel}
                  getMibBaseName={getMibBaseName}
                  runMib2Fcom={runMib2Fcom}
                  setMibUseParent={setMibUseParent}
                  setMibOutput={setMibOutput}
                  setMibDefinitionSearch={setMibDefinitionSearch}
                  setMibObjectFilter={setMibObjectFilter}
                  setMibSelectedDefinition={setMibSelectedDefinition}
                  formatSnmpVersionLabel={formatSnmpVersionLabel}
                  formatSnmpProfileTooltip={formatSnmpProfileTooltip}
                  openPcomAdvancedModal={openPcomAdvancedModal}
                  disablePcomAdvanced={disablePcomAdvanced}
                  runPcomPoll={runPcomPoll}
                  setPcomDeviceIp={setPcomDeviceIp}
                  openTrapComposer={openTrapComposer}
                  isFavorite={isFavorite}
                  toggleFavorite={toggleFavorite}
                  setMibSearch={setMibSearch}
                  setMibSearchScope={setMibSearchScope}
                />
              )}
              {trapModalOpen && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                  <div className="modal modal-wide" ref={trapModalRef}>
                    <h3>
                      {bulkTrapContext
                        ? `Sending ${bulkTrapContext.total} SNMP traps — ${bulkTrapContext.label}`
                        : 'Send SNMP Trap'}
                    </h3>
                    {bulkTrapContext ? (
                      <div className="muted">Using test commands from FCOM objects.</div>
                    ) : (
                      trapSource === 'fcom' && (
                        <div className="muted">Prefilled from FCOM test command.</div>
                      )
                    )}
                    {bulkTrapContext && (
                      <div className="panel-section">
                        <div className="panel-section-title">Progress</div>
                        {!trapSending && !bulkTrapSummary ? (
                          <div className="trap-progress-meta">
                            <span>Ready to send {bulkTrapContext.total} SNMP traps.</span>
                            {!trapHost && (
                              <span className="trap-progress-failed">
                                Select a destination to continue.
                              </span>
                            )}
                          </div>
                        ) : bulkTrapSummary ? (
                          <div className="trap-progress-meta">
                            <span>
                              Completed: {bulkTrapSummary.passed}/{bulkTrapSummary.total} sent,{' '}
                              {bulkTrapSummary.failed} failed.
                            </span>
                          </div>
                        ) : (
                          <>
                            <div className="trap-progress">
                              <div
                                className="trap-progress-bar"
                                style={{
                                  width:
                                    bulkTrapProgress.total > 0
                                      ? `${Math.round((bulkTrapProgress.current / bulkTrapProgress.total) * 100)}%`
                                      : '0%',
                                }}
                              />
                            </div>
                            <div className="trap-progress-meta">
                              <span>
                                Sending {bulkTrapProgress.current} / {bulkTrapProgress.total}
                              </span>
                              {bulkTrapProgress.currentLabel && (
                                <span className="trap-progress-current">
                                  Now: {bulkTrapProgress.currentLabel}
                                </span>
                              )}
                              {bulkTrapProgress.failed > 0 && (
                                <span className="trap-progress-failed">
                                  Failed: {bulkTrapProgress.failed}
                                </span>
                              )}
                            </div>
                          </>
                        )}
                        {bulkTrapFailures.length > 0 && (
                          <div className="trap-progress-failures">
                            <div className="trap-progress-failure-header">
                              <span>{bulkTrapFailures.length} failures</span>
                              {bulkTrapFailures.length > 3 && (
                                <button
                                  type="button"
                                  className="builder-link"
                                  onClick={() => setBulkTrapShowAllFailures((prev) => !prev)}
                                >
                                  {bulkTrapShowAllFailures ? 'Hide failures' : 'View failures'}
                                </button>
                              )}
                              <button
                                type="button"
                                className="builder-link"
                                onClick={retryFailedTraps}
                                disabled={trapSending}
                              >
                                Retry failed
                              </button>
                            </div>
                            {bulkTrapShowAllFailures || bulkTrapFailures.length <= 3 ? (
                              <div className="trap-progress-failure-list">
                                {bulkTrapFailures.map((failure) => (
                                  <details key={`${failure.objectName}-failure`}>
                                    <summary className="trap-progress-failure-summary">
                                      {failure.objectName} — failed to send
                                    </summary>
                                    <div className="trap-progress-failure-detail">
                                      {failure.message}
                                    </div>
                                  </details>
                                ))}
                              </div>
                            ) : (
                              <div className="trap-progress-failure-collapsed">
                                Too many failures to display. Click “View failures” to inspect.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="panel-section">
                      <div className="panel-section-title">Destination</div>
                      {trapServerError && <div className="error">{trapServerError}</div>}
                      {trapServerList.length > 0 && (
                        <label className="mib-field">
                          Server list
                          <select
                            value={trapHost}
                            onChange={(e) => {
                              setTrapHost(e.target.value);
                              if (e.target.value) {
                                setTrapManualOpen(false);
                              }
                            }}
                            data-error={!trapHost ? 'true' : undefined}
                            aria-invalid={!trapHost}
                          >
                            <option value="">Select a server</option>
                            {trapServerList.map((server) => (
                              <option
                                key={server.ServerID || server.ServerName}
                                value={server.ServerHostFQDN || server.ServerName}
                              >
                                {server.ServerName || server.ServerHostFQDN}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setTrapManualOpen((prev) => !prev)}
                      >
                        {trapManualOpen ? 'Hide manual entry' : 'Manual destination'}
                      </button>
                      {trapManualOpen && (
                        <div className="mib-manual-entry">
                          <label className="mib-field">
                            Host or IP
                            <input
                              type="text"
                              placeholder="10.0.0.10"
                              value={trapHost}
                              onChange={(e) => setTrapHost(e.target.value)}
                              data-error={!trapHost ? 'true' : undefined}
                              aria-invalid={!trapHost}
                            />
                          </label>
                          <label className="mib-field">
                            Port
                            <input
                              type="number"
                              value={trapPort}
                              onChange={(e) => setTrapPort(Number(e.target.value))}
                            />
                          </label>
                        </div>
                      )}
                      {recentTargets.length > 0 && (
                        <label className="mib-field">
                          Recent destinations
                          <select value="" onChange={(e) => setTrapHost(e.target.value)}>
                            <option value="">Select recent</option>
                            {recentTargets.map((target) => (
                              <option key={target} value={target}>
                                {target}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                    {!bulkTrapContext && (
                      <div className="panel-section">
                        <div className="panel-section-title">Trap</div>
                        <div className="mib-trap-grid">
                          <label className="mib-field">
                            Version
                            <select
                              value={trapVersion}
                              onChange={(e) => setTrapVersion(e.target.value)}
                            >
                              <option value="2c">v2c</option>
                            </select>
                          </label>
                          <label className="mib-field">
                            Community
                            <input
                              type="text"
                              value={trapCommunity}
                              onChange={(e) => setTrapCommunity(e.target.value)}
                            />
                          </label>
                          <label className="mib-field mib-field-wide">
                            Trap OID
                            <input
                              type="text"
                              value={trapOid}
                              onChange={(e) => setTrapOid(e.target.value)}
                              data-error={!trapOid ? 'true' : undefined}
                              aria-invalid={!trapOid}
                            />
                          </label>
                        </div>
                        <div className="panel-section-title">Varbinds</div>
                        <div className="mib-varbinds">
                          {trapVarbinds.length === 0 && (
                            <div className="empty-state">No varbinds yet.</div>
                          )}
                          {trapVarbinds.map((binding, index) => (
                            <div key={`${binding.oid}-${index}`} className="mib-varbind-row">
                              <input
                                type="text"
                                placeholder="OID"
                                value={binding.oid}
                                onChange={(e) =>
                                  setTrapVarbinds((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, oid: e.target.value } : item,
                                    ),
                                  )
                                }
                              />
                              <select
                                value={binding.type}
                                onChange={(e) =>
                                  setTrapVarbinds((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, type: e.target.value } : item,
                                    ),
                                  )
                                }
                              >
                                <option value="s">string</option>
                                <option value="i">integer</option>
                                <option value="u">unsigned</option>
                                <option value="t">timeticks</option>
                                <option value="o">oid</option>
                              </select>
                              <input
                                type="text"
                                placeholder="Value"
                                value={binding.value}
                                onChange={(e) =>
                                  setTrapVarbinds((prev) =>
                                    prev.map((item, idx) =>
                                      idx === index ? { ...item, value: e.target.value } : item,
                                    ),
                                  )
                                }
                              />
                              <button
                                type="button"
                                className="builder-link"
                                onClick={() =>
                                  setTrapVarbinds((prev) =>
                                    prev.filter((_item, idx) => idx !== index),
                                  )
                                }
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="builder-link"
                            onClick={() =>
                              setTrapVarbinds((prev) => [
                                ...prev,
                                { oid: '', type: 's', value: '' },
                              ])
                            }
                          >
                            Add varbind
                          </button>
                        </div>
                      </div>
                    )}
                    {trapError && <div className="error">{trapError}</div>}
                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setTrapModalOpen(false);
                          setBulkTrapContext(null);
                          setBulkTrapProgress({
                            current: 0,
                            total: 0,
                            failed: 0,
                            currentLabel: '',
                          });
                          setBulkTrapFailures([]);
                          setBulkTrapSummary(null);
                          setBulkTrapShowAllFailures(false);
                        }}
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        aria-disabled={
                          trapSending ||
                          (bulkTrapContext
                            ? !trapHost || Boolean(bulkTrapSummary)
                            : !trapHost || !trapOid)
                        }
                        className={`builder-card builder-card-primary${
                          trapSending ||
                          (bulkTrapContext
                            ? !trapHost || Boolean(bulkTrapSummary)
                            : !trapHost || !trapOid)
                            ? ' button-disabled'
                            : ''
                        }`}
                        onClick={() => {
                          const disabled =
                            trapSending ||
                            (bulkTrapContext
                              ? !trapHost || Boolean(bulkTrapSummary)
                              : !trapHost || !trapOid);
                          if (disabled) {
                            triggerValidationPulse(trapModalRef.current);
                            return;
                          }
                          if (bulkTrapContext) {
                            sendBulkTraps();
                            return;
                          }
                          sendTrap();
                        }}
                      >
                        {trapSending ? 'Sending…' : bulkTrapContext ? 'Send Traps' : 'Send Trap'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {pcomAdvancedOpen && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                  <div className="modal modal-wide">
                    <h3>SNMP Advanced Settings</h3>
                    <div className="panel-section">
                      <div className="panel-section-title">Target</div>
                      <div className="mib-trap-grid">
                        <label className="mib-field">
                          Target mode
                          <select
                            value={pcomAdvancedTargetMode}
                            onChange={(e) =>
                              setPcomAdvancedTargetMode(e.target.value as 'device' | 'manual')
                            }
                          >
                            <option value="device">Device list</option>
                            <option value="manual">Manual IP</option>
                          </select>
                        </label>
                        {pcomAdvancedTargetMode === 'device' ? (
                          <label className="mib-field">
                            Device
                            <select
                              value={pcomAdvancedDeviceIp}
                              onChange={(e) => setPcomAdvancedDeviceIp(e.target.value)}
                              disabled={pcomDevicesLoading}
                            >
                              <option value="">Select a device</option>
                              {pcomDevicesLoading ? (
                                <option value="" disabled>
                                  Loading devices...
                                </option>
                              ) : pcomDeviceOptions.length === 0 ? (
                                <option value="" disabled>
                                  No devices available
                                </option>
                              ) : (
                                pcomDeviceOptions.map((device) => (
                                  <option key={device.value} value={device.value}>
                                    {device.label}
                                  </option>
                                ))
                              )}
                            </select>
                          </label>
                        ) : (
                          <label className="mib-field">
                            IP address
                            <input
                              type="text"
                              placeholder="10.0.0.10"
                              value={pcomAdvancedManualIp}
                              onChange={(e) => setPcomAdvancedManualIp(e.target.value)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                    <div className="panel-section">
                      <div className="panel-section-title">SNMP</div>
                      <div className="mib-trap-grid">
                        <label className="mib-field">
                          Version
                          <select
                            value={pcomAdvancedSnmpVersion}
                            onChange={(e) =>
                              setPcomAdvancedSnmpVersion(e.target.value as '1' | '2c' | '3')
                            }
                          >
                            <option value="1">v1</option>
                            <option value="2c">v2c</option>
                            <option value="3">v3</option>
                          </select>
                        </label>
                        {(pcomAdvancedSnmpVersion === '1' || pcomAdvancedSnmpVersion === '2c') && (
                          <label className="mib-field">
                            Community string
                            <input
                              type="password"
                              value={pcomAdvancedCommunity}
                              onChange={(e) => setPcomAdvancedCommunity(e.target.value)}
                            />
                          </label>
                        )}
                      </div>
                      <details className="mib-advanced-oid" open={pcomAdvancedOidEnabled}>
                        <summary
                          onClick={(e) => {
                            e.preventDefault();
                            setPcomAdvancedOidEnabled((prev) => !prev);
                          }}
                        >
                          Customize OID (optional)
                        </summary>
                        {pcomAdvancedOidEnabled && (
                          <div className="mib-advanced-oid-body">
                            <label className="mib-field">
                              OID override
                              <input
                                type="text"
                                placeholder="1.3.6.1.4.1.x.y"
                                value={pcomAdvancedOidValue}
                                onChange={(e) => setPcomAdvancedOidValue(e.target.value)}
                              />
                            </label>
                            <div className="muted">
                              Defaults to the selected MIB OID. Append .x.y to target an instance.
                            </div>
                          </div>
                        )}
                      </details>
                      {pcomAdvancedSnmpVersion === '3' && (
                        <div className="mib-trap-grid">
                          <label className="mib-field">
                            Security level
                            <select
                              value={pcomAdvancedSecurityLevel}
                              onChange={(e) =>
                                setPcomAdvancedSecurityLevel(
                                  e.target.value as 'noAuthNoPriv' | 'authNoPriv' | 'authPriv',
                                )
                              }
                            >
                              <option value="noAuthNoPriv">noAuthNoPriv</option>
                              <option value="authNoPriv">authNoPriv</option>
                              <option value="authPriv">authPriv</option>
                            </select>
                          </label>
                          <label className="mib-field">
                            Username
                            <input
                              type="text"
                              value={pcomAdvancedUsername}
                              onChange={(e) => setPcomAdvancedUsername(e.target.value)}
                            />
                          </label>
                          {pcomAdvancedSecurityLevel !== 'noAuthNoPriv' && (
                            <>
                              <label className="mib-field">
                                Authentication protocol
                                <select
                                  value={pcomAdvancedAuthProtocol}
                                  onChange={(e) => setPcomAdvancedAuthProtocol(e.target.value)}
                                >
                                  <option value="">Select protocol</option>
                                  <option value="MD5">MD5</option>
                                  <option value="SHA">SHA</option>
                                  <option value="SHA-224">SHA (224)</option>
                                  <option value="SHA-256">SHA (256)</option>
                                  <option value="SHA-384">SHA (384)</option>
                                  <option value="SHA-512">SHA (512)</option>
                                </select>
                              </label>
                              <label className="mib-field">
                                Authentication password
                                <input
                                  type="password"
                                  value={pcomAdvancedAuthPassword}
                                  onChange={(e) => setPcomAdvancedAuthPassword(e.target.value)}
                                />
                              </label>
                            </>
                          )}
                          {pcomAdvancedSecurityLevel === 'authPriv' && (
                            <>
                              <label className="mib-field">
                                Privacy protocol
                                <select
                                  value={pcomAdvancedPrivProtocol}
                                  onChange={(e) => setPcomAdvancedPrivProtocol(e.target.value)}
                                >
                                  <option value="">Select protocol</option>
                                  <option value="DES">DES</option>
                                  <option value="3DES">3DES</option>
                                  <option value="AES-128">AES (128)</option>
                                  <option value="AES-192">AES (192)</option>
                                  <option value="AES-192-Cisco">AES (192) Cisco</option>
                                  <option value="AES-256">AES (256)</option>
                                  <option value="AES-256-Cisco">AES (256) Cisco</option>
                                </select>
                              </label>
                              <label className="mib-field">
                                Privacy password
                                <input
                                  type="password"
                                  value={pcomAdvancedPrivPassword}
                                  onChange={(e) => setPcomAdvancedPrivPassword(e.target.value)}
                                />
                              </label>
                            </>
                          )}
                          <label className="mib-field">
                            Engine ID
                            <input
                              type="text"
                              value={pcomAdvancedEngineId}
                              onChange={(e) => setPcomAdvancedEngineId(e.target.value)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                    <div className="modal-actions">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setPcomAdvancedOpen(false)}
                      >
                        Close
                      </button>
                      <button type="button" className="modal-primary" onClick={applyPcomAdvanced}>
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="auth-screen">
              <div className="login-card">
                <h2>Sign in</h2>
                <form onSubmit={handleLogin} className="login-form">
                  <label>
                    Server
                    <select value={serverId} onChange={(e) => setServerId(e.target.value)}>
                      <option value="" disabled>
                        Select a server
                      </option>
                      {serverOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <input type="hidden" name="authType" value="basic" />

                  <label>
                    Username
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>

                  {error && <div className="error">{error}</div>}
                  <button type="submit" disabled={loading || !serverId}>
                    {loading ? 'Signing in…' : 'Sign in'}
                  </button>
                </form>
              </div>
            </div>
          )}
          {showUserMenu && (
            <div className="modal-overlay" role="dialog" aria-modal="true">
              <div className="modal">
                <h3>User Preferences & Configuration</h3>
                <div className="cache-section">
                  <div className="cache-section-header">Overview Cache</div>
                  {overviewRebuildPending || overviewStatus?.isBuilding ? (
                    <>
                      <span className="muted">
                        {overviewProgress?.phase || 'Cache refreshing…'}
                        {overviewStatus?.buildId ? ` · Build ${overviewStatus.buildId}` : ''}
                        {overviewProgress?.total
                          ? ` · ${overviewProgress.processed} / ${overviewProgress.total} ${overviewProgress.unit || 'items'}`
                          : ''}
                      </span>
                      <div className="trap-progress" aria-hidden="true">
                        <div
                          className={`trap-progress-bar${
                            overviewProgress?.total ? '' : ' indeterminate'
                          }`}
                          style={{
                            width: overviewProgress?.total
                              ? `${overviewProgressPercent}%`
                              : '35%',
                          }}
                        />
                      </div>
                    </>
                  ) : overviewStatus?.lastBuiltAt ? (
                    <span className="muted">
                      {overviewStatus.isStale ? 'Stale · ' : ''}
                      Last refresh {formatTime(overviewStatus.lastBuiltAt)}
                      {overviewCacheLabel ? ` · Cache ${overviewCacheLabel}` : ''}
                      {overviewStatus.nextRefreshAt
                        ? ` · Next refresh ${formatTime(overviewStatus.nextRefreshAt)}`
                        : ''}
                    </span>
                  ) : (
                    <span className="muted">Cache not loaded yet.</span>
                  )}
                  <div className="cache-action-row">
                    <button
                      type="button"
                      className="link-button"
                      onClick={handleRefreshOverviewCache}
                    >
                      Refresh Cache
                    </button>
                  </div>
                </div>
                <div className="cache-section">
                  <div className="cache-section-header">Search Index Cache</div>
                  {searchRebuildPending || searchStatus?.isBuilding ? (
                    <>
                      <span className="muted">
                        {searchProgress?.phase || 'Cache refreshing…'}
                        {searchStatus?.buildId ? ` · Build ${searchStatus.buildId}` : ''}
                        {searchProgress?.total
                          ? ` · ${searchProgress.processed} / ${searchProgress.total} ${searchProgress.unit || 'items'}`
                          : ''}
                      </span>
                      <div className="trap-progress" aria-hidden="true">
                        <div
                          className={`trap-progress-bar${
                            searchProgress?.total ? '' : ' indeterminate'
                          }`}
                          style={{
                            width: searchProgress?.total
                              ? `${searchProgressPercent}%`
                              : '35%',
                          }}
                        />
                      </div>
                    </>
                  ) : searchStatus?.lastBuiltAt ? (
                    <span className="muted">
                      {searchStatus.isStale ? 'Stale · ' : ''}
                      Indexed {searchStatus.counts?.files || 0} files · Last refresh{' '}
                      {formatTime(searchStatus.lastBuiltAt)}
                      {searchCacheLabel ? ` · Cache ${searchCacheLabel}` : ''}
                      {searchStatus.nextRefreshAt
                        ? ` · Next refresh ${formatTime(searchStatus.nextRefreshAt)}`
                        : ''}
                    </span>
                  ) : (
                    <span className="muted">Cache not loaded yet.</span>
                  )}
                  <div className="cache-action-row">
                    <button
                      type="button"
                      className="link-button"
                      onClick={handleRefreshSearchCache}
                    >
                      Refresh Cache
                    </button>
                  </div>
                </div>
                <div className="cache-section">
                  <div className="cache-section-header">Folder Cache</div>
                  {folderRebuildPending || folderOverviewStatus?.isBuilding ? (
                    <>
                      <span className="muted">
                        {folderProgress?.phase || 'Cache refreshing…'}
                        {folderOverviewStatus?.buildId
                          ? ` · Build ${folderOverviewStatus.buildId}`
                          : ''}
                        {folderProgress?.total
                          ? ` · ${folderProgress.processed} / ${folderProgress.total} ${folderProgress.unit || 'items'}`
                          : ''}
                      </span>
                      <div className="trap-progress" aria-hidden="true">
                        <div
                          className={`trap-progress-bar${
                            folderProgress?.total ? '' : ' indeterminate'
                          }`}
                          style={{
                            width: folderProgress?.total
                              ? `${folderProgressPercent}%`
                              : '35%',
                          }}
                        />
                      </div>
                    </>
                  ) : folderOverviewStatus?.lastBuiltAt ? (
                    <span className="muted">
                      {folderOverviewStatus.isStale ? 'Stale · ' : ''}
                      {folderCacheLabel
                        ? `Cache ${folderCacheLabel} · `
                        : `${folderOverviewStatus.entryCount || 0} entries · `}
                      Last refresh {formatTime(folderOverviewStatus.lastBuiltAt)}
                      {folderOverviewStatus.nextRefreshAt
                        ? ` · Next refresh ${formatTime(folderOverviewStatus.nextRefreshAt)}`
                        : ''}
                    </span>
                  ) : folderOverviewStatus?.lastClearedAt ? (
                    <span className="muted">
                      Cleared · Last refresh {formatTime(folderOverviewStatus.lastClearedAt)}
                    </span>
                  ) : (
                    <span className="muted">Cache not loaded yet.</span>
                  )}
                  <div className="cache-action-row">
                    <button
                      type="button"
                      className="link-button"
                      onClick={handleRefreshFolderCache}
                    >
                      Refresh Cache
                    </button>
                  </div>
                </div>
                <div className="cache-section">
                  <div className="cache-section-header">MIB Translate Cache</div>
                  {mibTranslateCacheLabel ? (
                    <span className="muted">Cache {mibTranslateCacheLabel}</span>
                  ) : (
                    <span className="muted">Cache not loaded yet.</span>
                  )}
                  <div className="cache-action-row">
                    <button
                      type="button"
                      className="link-button"
                      onClick={refreshMibTranslateStatus}
                    >
                      Refresh Stats
                    </button>
                  </div>
                </div>
                {cacheActionMessage && (
                  <div className="success" style={{ marginTop: '1rem' }}>
                    {cacheActionMessage}
                  </div>
                )}
                <p className="muted" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
                  Rebuilds run on the server and can take a few minutes.
                </p>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowUserMenu(false)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
        {microserviceModal}
      </div>
    </ErrorBoundary>
  );
}
