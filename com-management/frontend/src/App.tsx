import React, { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useSessionStore } from './stores';
import api from './services/api';
import AppTabs from './app/AppTabs';
import OverviewPage from './features/overview/OverviewPage';
import PcomPage from './features/pcom/PcomPage';
import MibBrowserPage from './features/mib/MibBrowserPage';
import FcomBrowserPanel from './features/fcom/FcomBrowserPanel';
import FcomFileHeader from './features/fcom/FcomFileHeader';
import FcomFolderOverview from './features/fcom/FcomFolderOverview';
import FcomFilePreview from './features/fcom/FcomFilePreview';
import FcomBuilderSidebar from './features/fcom/FcomBuilderSidebar';
import './App.css';

const COMS_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
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

type AppTab = 'overview' | 'fcom' | 'pcom' | 'mib';

export default function App() {
  const {
    session,
    servers,
    isAuthenticated,
    setSession,
    clearSession,
    setServers,
  } = useSessionStore();
  const [activeApp, setActiveApp] = useState<AppTab>('overview');
  const [serverId, setServerId] = useState('');
  const [authType, setAuthType] = useState<'basic' | 'certificate'>('basic');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [certPath, setCertPath] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [caPath, setCaPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'name' | 'content'>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<any>(null);
  const [searchRebuildPending, setSearchRebuildPending] = useState(false);
  const searchRebuildStartRef = useRef<number | null>(null);
  const searchStatusPollRef = useRef<number | null>(null);
  const [folderRebuildPending, setFolderRebuildPending] = useState(false);
  const folderRebuildStartRef = useRef<number | null>(null);
  const folderStatusPollRef = useRef<number | null>(null);
  const [searchHighlightActive, setSearchHighlightActive] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const [highlightPathId, setHighlightPathId] = useState<string | null>(null);
  const [highlightMatchSource, setHighlightMatchSource] = useState<'name' | 'content' | 'both' | null>(null);
  const [highlightObjectKeys, setHighlightObjectKeys] = useState<string[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [matchObjectOptions, setMatchObjectOptions] = useState<Array<{ key: string; label: string }>>([]);
  const [matchPingKey, setMatchPingKey] = useState<string | null>(null);
  const [fileNamePingActive, setFileNamePingActive] = useState(false);
  const matchPingTimeoutRef = useRef<number | null>(null);
  const fileNamePingTimeoutRef = useRef<number | null>(null);
  const matchPingSequenceRef = useRef<number[]>([]);
  const fileNamePingSequenceRef = useRef<number[]>([]);
  const lastLoadPingRef = useRef<{ fileId?: string; key?: string; mode?: 'match' | 'file' }>({});
  const [overrideObjectKeys, setOverrideObjectKeys] = useState<string[]>([]);
  const [overrideMatchIndex, setOverrideMatchIndex] = useState(0);
  const [overrideObjectOptions, setOverrideObjectOptions] = useState<Array<{ key: string; label: string }>>([]);
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
  const [browsePath] = useState('/');
  const [overviewStatus, setOverviewStatus] = useState<any | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [overviewRebuildPending, setOverviewRebuildPending] = useState(false);
  const overviewRebuildStartRef = useRef<number | null>(null);
  const overviewStatusPollRef = useRef<number | null>(null);
  const [overviewTopN, setOverviewTopN] = useState(10);
  const [overviewVendorFilter, setOverviewVendorFilter] = useState('');
  const [overviewVendorSort, setOverviewVendorSort] = useState<{
    key: 'vendor' | 'files' | 'overrides' | 'objects';
    direction: 'asc' | 'desc';
  }>({ key: 'files', direction: 'desc' });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [cacheActionMessage, setCacheActionMessage] = useState<string | null>(null);
  const [showPathModal, setShowPathModal] = useState(false);
  const [mibPath, setMibPath] = useState('/');
  const [mibEntries, setMibEntries] = useState<any[]>([]);
  const [mibLoading, setMibLoading] = useState(false);
  const [mibError, setMibError] = useState<string | null>(null);
  const [mibSearch, setMibSearch] = useState('');
  const [mibSearchScope, setMibSearchScope] = useState<'folder' | 'all'>('folder');
  const [mibSearchMode, setMibSearchMode] = useState<'browse' | 'search'>('browse');
  const [mibLimit] = useState(30);
  const [mibOffset, setMibOffset] = useState(0);
  const [mibHasMore, setMibHasMore] = useState(false);
  const [mibTotal, setMibTotal] = useState<number | null>(null);
  const [mibFilteredTotal, setMibFilteredTotal] = useState<number | null>(null);
  const [mibSelectedFile, setMibSelectedFile] = useState<string | null>(null);
  const [mibDefinitions, setMibDefinitions] = useState<any[]>([]);
  const [mibDefinitionSearch, setMibDefinitionSearch] = useState('');
  const [mibSelectedDefinition, setMibSelectedDefinition] = useState<any | null>(null);
  const [mibOutput, setMibOutput] = useState('');
  const [mibOutputName, setMibOutputName] = useState('');
  const [mib2FcomLoading, setMib2FcomLoading] = useState(false);
  const [mib2FcomError, setMib2FcomError] = useState<string | null>(null);
  const [mibUseParent, setMibUseParent] = useState(true);
  const [trapModalOpen, setTrapModalOpen] = useState(false);
  const [trapSource, setTrapSource] = useState<'mib' | 'fcom'>('mib');
  const [trapObjectName, setTrapObjectName] = useState('');
  const [trapHost, setTrapHost] = useState('');
  const [trapPort, setTrapPort] = useState(162);
  const [trapCommunity, setTrapCommunity] = useState('public');
  const [trapVersion, setTrapVersion] = useState('2c');
  const [trapOid, setTrapOid] = useState('');
  const [trapMibModule, setTrapMibModule] = useState('');
  const [trapVarbinds, setTrapVarbinds] = useState<Array<{ oid: string; type: string; value: string }>>([]);
  const [trapServerList, setTrapServerList] = useState<any[]>([]);
  const [trapServerError, setTrapServerError] = useState<string | null>(null);
  const [trapManualOpen, setTrapManualOpen] = useState(false);
  const [trapSending, setTrapSending] = useState(false);
  const [trapError, setTrapError] = useState<string | null>(null);
  const [recentTargets, setRecentTargets] = useState<string[]>([]);
  const [folderOverviewStatus, setFolderOverviewStatus] = useState<any | null>(null);
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
  const [bulkTrapFailures, setBulkTrapFailures] = useState<Array<{
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
  }>>([]);
  const [bulkTrapSummary, setBulkTrapSummary] = useState<null | {
    passed: number;
    failed: number;
    total: number;
  }>(null);
  const [bulkTrapShowAllFailures, setBulkTrapShowAllFailures] = useState(false);

  useEffect(() => {
    const savedQuery = sessionStorage.getItem('fcom.search.query');
    const savedScope = sessionStorage.getItem('fcom.search.scope');
    if (savedQuery && !searchQuery) {
      setSearchQuery(savedQuery);
    }
    if (savedScope === 'all' || savedScope === 'name' || savedScope === 'content') {
      setSearchScope(savedScope);
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('fcom.search.query', searchQuery);
    sessionStorage.setItem('fcom.search.scope', searchScope);
  }, [searchQuery, searchScope]);

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

  const formatOverviewNumber = (value: number) => new Intl.NumberFormat().format(value);

  const loadOverview = async (options?: { forceRebuild?: boolean }) => {
    if (!isAuthenticated) {
      return;
    }
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      if (options?.forceRebuild) {
        setOverviewRebuildPending(true);
        overviewRebuildStartRef.current = Date.now();
        startOverviewStatusPolling();
        await api.rebuildOverviewIndex();
      }
      const [statusRes, dataRes] = await Promise.all([
        api.getOverviewStatus(),
        api.getOverview(),
      ]);
      setOverviewStatus(statusRes.data);
      setOverviewData(dataRes.data?.data ?? null);
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load overview';
      setOverviewError(message);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || activeApp !== 'overview') {
      return;
    }
    void loadOverview();
  }, [isAuthenticated, activeApp]);

  const overviewProtocols = useMemo(() => {
    if (!overviewData?.protocols) {
      return [] as Array<{ name: string; counts: any; vendors: any[] }>;
    }
    const filterText = overviewVendorFilter.trim().toLowerCase();
    return overviewData.protocols.map((protocol: any) => {
      const vendors = Array.isArray(protocol.vendors) ? protocol.vendors : [];
      const filteredVendors = filterText
        ? vendors.filter((vendor: any) => String(vendor?.name || '').toLowerCase().includes(filterText))
        : vendors;
      const sortedVendors = [...filteredVendors].sort((a: any, b: any) => {
        if (overviewVendorSort.key === 'vendor') {
          const aName = String(a?.name || '');
          const bName = String(b?.name || '');
          return overviewVendorSort.direction === 'asc'
            ? aName.localeCompare(bName)
            : bName.localeCompare(aName);
        }
        const aValue = Number(a?.counts?.[overviewVendorSort.key] ?? 0);
        const bValue = Number(b?.counts?.[overviewVendorSort.key] ?? 0);
        return overviewVendorSort.direction === 'asc' ? aValue - bValue : bValue - aValue;
      });
      const limit = overviewTopN === 0 ? sortedVendors.length : overviewTopN;
      return {
        ...protocol,
        vendors: sortedVendors.slice(0, limit),
      };
    });
  }, [overviewData, overviewTopN, overviewVendorFilter, overviewVendorSort]);

  const overviewProgress = overviewStatus?.progress;
  const searchProgress = searchStatus?.progress;
  const folderProgress = folderOverviewStatus?.progress;
  const overviewProgressPercent = overviewProgress?.total
    ? Math.min(100, Math.round((overviewProgress.processed / overviewProgress.total) * 100))
    : 0;
  const searchProgressPercent = searchProgress?.total
    ? Math.min(100, Math.round((searchProgress.processed / searchProgress.total) * 100))
    : 0;
  const folderProgressPercent = folderProgress?.total
    ? Math.min(100, Math.round((folderProgress.processed / folderProgress.total) * 100))
    : 0;

  const toggleOverviewSort = (key: 'vendor' | 'files' | 'overrides' | 'objects') => {
    setOverviewVendorSort((prev) => (
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' }
    ));
  };

  const handleOverviewFolderClick = (protocol: string, vendor?: string) => {
    const path = [COMS_PATH_PREFIX, protocol, vendor].filter(Boolean).join('/');
    const entryLabel = vendor || protocol;
    confirmDiscardIfDirty(() => {
      setActiveApp('fcom');
      void handleOpenFolderInternal({ PathID: path, PathName: entryLabel });
    });
  };

  const getRawPath = () => {
    if (selectedFile?.PathID) {
      return `/${selectedFile.PathID}`;
    }
    if (browseNode) {
      return `/${browseNode}`;
    }
    return '/';
  };

  const getCurrentPath = () => {
    const rawPath = getRawPath();
    if (rawPath === '/') {
      return '/';
    }
    return formatDisplayPath(rawPath);
  };

  const getParentLabel = (node?: string) => {
    if (!node) {
      return '';
    }
    const cleaned = node.replace(/^\/+/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length === 0) {
      return '';
    }
    const last = parts[parts.length - 1];
    return last.startsWith('id-') ? last.replace(/^id-/, '') : last;
  };

  const getParentPath = (node?: string) => {
    if (!node) {
      return '';
    }
    const cleaned = node.replace(/^\/+/, '');
    const parts = cleaned.split('/').filter(Boolean);
    if (parts.length <= 1) {
      return '';
    }
    return parts.slice(0, -1).join('/');
  };

  const formatRelativeAge = (timestamp?: string | null) => {
    if (!timestamp) {
      return '—';
    }
    const ms = Date.now() - new Date(timestamp).getTime();
    if (!Number.isFinite(ms) || ms < 0) {
      return '—';
    }
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const formatDisplayPath = (pathId?: string | null) => {
    if (!pathId) {
      return '/';
    }
    const cleaned = pathId.replace(/^\/+/, '');
    if (!cleaned) {
      return '/';
    }
    const segments = cleaned.split('/');
    if (segments[0]?.startsWith('id-')) {
      segments[0] = segments[0].replace(/^id-/, '');
    }
    return `/${segments.join('/')}`;
  };

  const getVendorFromPath = (pathId?: string | null) => {
    if (!pathId) {
      return '';
    }
    const parts = pathId.replace(/^\/+/, '').split('/').filter(Boolean);
    const fcomIndex = parts.lastIndexOf('fcom');
    if (fcomIndex === -1) {
      return '';
    }
    const methodIndex = parts.findIndex((segment, idx) => idx > fcomIndex && (segment === 'trap' || segment === 'syslog'));
    const vendorIndex = methodIndex !== -1 ? methodIndex + 1 : fcomIndex + 1;
    return parts[vendorIndex] || '';
  };

  const getSortIndicator = (activeKey: string, key: string, direction: 'asc' | 'desc') => {
    if (activeKey !== key) {
      return null;
    }
    return direction === 'asc' ? '↑' : '↓';
  };

  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseData, setBrowseData] = useState<any>(null);
  const [browseNode, setBrowseNode] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const browseSnapshotRef = useRef<{
    browseData: any;
    browseNode: string | null;
    entries: any[];
    breadcrumbs: Array<{ label: string; node: string | null }>;
  } | null>(null);
  const [favorites, setFavorites] = useState<Array<{ type: 'file' | 'folder'; pathId: string; label: string; node?: string }>>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [folderOverview, setFolderOverview] = useState<any>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderTableFilter, setFolderTableFilter] = useState('');
  const [folderTableSort, setFolderTableSort] = useState<{
    key: 'file' | 'objects' | 'schemaErrors' | 'unknownFields';
    direction: 'asc' | 'desc';
  }>({ key: 'schemaErrors', direction: 'desc' });
  const folderTableRows = useMemo(() => {
    const rows = Array.isArray(folderOverview?.topFiles) ? folderOverview.topFiles : [];
    const filterText = folderTableFilter.trim().toLowerCase();
    const filteredRows = filterText
      ? rows.filter((row: any) => String(row?.file || '').toLowerCase().includes(filterText))
      : rows;
    const sortedRows = [...filteredRows].sort((a: any, b: any) => {
      if (folderTableSort.key === 'file') {
        const aName = String(a?.file || '');
        const bName = String(b?.file || '');
        return folderTableSort.direction === 'asc'
          ? aName.localeCompare(bName)
          : bName.localeCompare(aName);
      }
      const aValue = Number(a?.[folderTableSort.key] ?? 0);
      const bValue = Number(b?.[folderTableSort.key] ?? 0);
      return folderTableSort.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
    return sortedRows;
  }, [folderOverview, folderTableFilter, folderTableSort]);

  const toggleFolderSort = (key: 'file' | 'objects' | 'schemaErrors' | 'unknownFields') => {
    setFolderTableSort((prev) => (
      prev.key === key
        ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'desc' }
    ));
  };
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ label: string; node: string | null }>>([
    { label: '/', node: null },
  ]);
  const breadcrumbsRef = useRef(breadcrumbs);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [fileData, setFileData] = useState<any>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [editorText, setEditorText] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'friendly' | 'preview'>('preview');
  const [originalText, setOriginalText] = useState('');
  const [showCommitModal, setShowCommitModal] = useState(false);
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
  const [saveElapsed, setSaveElapsed] = useState(0);
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [panelEditState, setPanelEditState] = useState<Record<string, boolean>>({});
  const [panelDrafts, setPanelDrafts] = useState<Record<string, any>>({});
  const [panelEvalModes, setPanelEvalModes] = useState<Record<string, Record<string, boolean>>>({});
  const [overrideInfo, setOverrideInfo] = useState<any | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [pendingOverrideSave, setPendingOverrideSave] = useState<any[] | null>(null);
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
  }>({ open: false });
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [addFieldSearch, setAddFieldSearch] = useState('');
  const [addFieldContext, setAddFieldContext] = useState<{ panelKey: string; obj: any } | null>(null);
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
  } | null>(null);
  const [builderOpen, setBuilderOpen] = useState(true);
  const [builderTarget, setBuilderTarget] = useState<{ panelKey: string; field: string } | null>(null);
  const [builderFocus, setBuilderFocus] = useState<'eval' | 'processor' | 'literal' | null>(null);
  const [builderTypeLocked, setBuilderTypeLocked] = useState<'eval' | 'processor' | 'literal' | null>(null);
  const [builderMode, setBuilderMode] = useState<'friendly' | 'regular'>('friendly');
  const [builderUndoStack, setBuilderUndoStack] = useState<BuilderSnapshot[]>([]);
  const [builderRedoStack, setBuilderRedoStack] = useState<BuilderSnapshot[]>([]);
  const builderHistoryBusyRef = useRef(false);
  const builderHistorySigRef = useRef<string | null>(null);
  const builderHistoryInitRef = useRef(false);
  const [showBuilderHelpModal, setShowBuilderHelpModal] = useState(false);
  const [pendingCancel, setPendingCancel] = useState<null | { type: 'panel' | 'builder'; panelKey?: string }>(null);
  const [pendingAdvancedFlowClose, setPendingAdvancedFlowClose] = useState(false);
  const [processorStep, setProcessorStep] = useState<'select' | 'configure' | 'review'>('select');
  const [processorType, setProcessorType] = useState<string | null>(null);
  const [showProcessorJson, setShowProcessorJson] = useState(true);
  const [showAdvancedProcessorModal, setShowAdvancedProcessorModal] = useState(false);
  const [advancedFlowDefaultTarget, setAdvancedFlowDefaultTarget] = useState<string | null>(null);
  const [modalStack, setModalStack] = useState<string[]>([]);
  const flowEditorModalRef = useRef<HTMLDivElement | null>(null);
  const advancedFlowModalRef = useRef<HTMLDivElement | null>(null);
  const trapModalRef = useRef<HTMLDivElement | null>(null);
  const [advancedProcessorSearch, setAdvancedProcessorSearch] = useState('');
  const [advancedProcessorScope, setAdvancedProcessorScope] = useState<'object' | 'global'>('object');
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
    builderProcessorConfig: Record<string, any>;
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
    config?: Record<string, any>;
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
  const [builderProcessorConfig, setBuilderProcessorConfig] = useState<Record<string, any>>({
    sourceType: 'literal',
    source: '',
    pattern: '',
    targetField: '',
  });
  const [builderNestedAddType, setBuilderNestedAddType] = useState('set');
  const [builderSwitchCaseAddType, setBuilderSwitchCaseAddType] = useState<Record<string, string>>({});
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
  const createFlowNode = (payload: { nodeKind: 'processor' | 'if'; processorType?: string }): FlowNode => {
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
  const updateBranchInFlow = (
    nodes: FlowNode[],
    path: FlowBranchPath,
    updater: (items: FlowNode[]) => FlowNode[],
  ): FlowNode[] => {
    if (path.kind === 'root') {
      return updater(nodes);
    }
    return nodes.map((node) => {
      if (node.kind === 'if') {
        if (node.id === path.id) {
          const branchItems = path.branch === 'then' ? node.then : node.else;
          const updatedBranch = updater(branchItems);
          return {
            ...node,
            [path.branch]: updatedBranch,
          } as FlowIfNode;
        }
        return {
          ...node,
          then: updateBranchInFlow(node.then, path, updater),
          else: updateBranchInFlow(node.else, path, updater),
        } as FlowIfNode;
      }
      if (node.kind === 'processor' && node.processorType === 'foreach') {
        const processors = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
        if (node.id === path.id) {
          const updatedBranch = updater(processors);
          return {
            ...node,
            config: {
              ...(node.config || {}),
              processors: updatedBranch,
            },
          } as FlowProcessorNode;
        }
        return {
          ...node,
          config: {
            ...(node.config || {}),
            processors: updateBranchInFlow(processors, path, updater),
          },
        } as FlowProcessorNode;
      }
      if (node.kind === 'processor' && node.processorType === 'switch') {
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        const defaultProcessors = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
        if (node.id === path.id) {
          if (path.branch === 'default') {
            const updatedBranch = updater(defaultProcessors);
            return {
              ...node,
              config: {
                ...(node.config || {}),
                defaultProcessors: updatedBranch,
              },
            } as FlowProcessorNode;
          }
          if (path.branch === 'case' && path.caseId) {
            const updatedCases = cases.map((item: any) => (
              item.id === path.caseId
                ? { ...item, processors: updater(Array.isArray(item.processors) ? item.processors : []) }
                : {
                  ...item,
                  processors: updateBranchInFlow(
                    Array.isArray(item.processors) ? item.processors : [],
                    path,
                    updater,
                  ),
                }
            ));
            return {
              ...node,
              config: {
                ...(node.config || {}),
                cases: updatedCases,
              },
            } as FlowProcessorNode;
          }
        }
        const updatedCases = cases.map((item: any) => ({
          ...item,
          processors: updateBranchInFlow(
            Array.isArray(item.processors) ? item.processors : [],
            path,
            updater,
          ),
        }));
        return {
          ...node,
          config: {
            ...(node.config || {}),
            cases: updatedCases,
            defaultProcessors: updateBranchInFlow(defaultProcessors, path, updater),
          },
        } as FlowProcessorNode;
      }
      return node;
    });
  };
  const appendNodeAtPath = (nodes: FlowNode[], path: FlowBranchPath, node: FlowNode): FlowNode[] => (
    updateBranchInFlow(nodes, path, (items) => [...items, node])
  );
  const removeNodeById = (nodes: FlowNode[], nodeId: string): { nodes: FlowNode[]; removed: FlowNode | null } => {
    let removed: FlowNode | null = null;
    const updated = nodes.reduce<FlowNode[]>((acc, node) => {
      if (node.id === nodeId) {
        removed = node;
        return acc;
      }
      if (node.kind === 'if') {
        const thenResult = removeNodeById(node.then, nodeId);
        const elseResult = removeNodeById(node.else, nodeId);
        if (thenResult.removed) {
          removed = thenResult.removed;
        }
        if (elseResult.removed) {
          removed = elseResult.removed;
        }
        acc.push({
          ...node,
          then: thenResult.nodes,
          else: elseResult.nodes,
        });
        return acc;
      }
      if (node.kind === 'processor' && node.processorType === 'foreach') {
        const nested = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
        const nestedResult = removeNodeById(nested, nodeId);
        if (nestedResult.removed) {
          removed = nestedResult.removed;
        }
        acc.push({
          ...node,
          config: {
            ...(node.config || {}),
            processors: nestedResult.nodes,
          },
        } as FlowProcessorNode);
        return acc;
      }
      if (node.kind === 'processor' && node.processorType === 'switch') {
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        const updatedCases = cases.map((item: any) => {
          const result = removeNodeById(Array.isArray(item.processors) ? item.processors : [], nodeId);
          if (result.removed) {
            removed = result.removed;
          }
          return {
            ...item,
            processors: result.nodes,
          };
        });
        const defaults = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
        const defaultResult = removeNodeById(defaults, nodeId);
        if (defaultResult.removed) {
          removed = defaultResult.removed;
        }
        acc.push({
          ...node,
          config: {
            ...(node.config || {}),
            cases: updatedCases,
            defaultProcessors: defaultResult.nodes,
          },
        } as FlowProcessorNode);
        return acc;
      }
      acc.push(node);
      return acc;
    }, []);
    return { nodes: updated, removed };
  };
  const findNodeById = (nodes: FlowNode[], nodeId: string): FlowNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId) {
        return node;
      }
      if (node.kind === 'if') {
        const foundThen = findNodeById(node.then, nodeId);
        if (foundThen) {
          return foundThen;
        }
        const foundElse = findNodeById(node.else, nodeId);
        if (foundElse) {
          return foundElse;
        }
      }
      if (node.kind === 'processor' && node.processorType === 'foreach') {
        const nested = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
        const foundNested = findNodeById(nested, nodeId);
        if (foundNested) {
          return foundNested;
        }
      }
      if (node.kind === 'processor' && node.processorType === 'switch') {
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        for (const item of cases) {
          const foundCase = findNodeById(Array.isArray(item.processors) ? item.processors : [], nodeId);
          if (foundCase) {
            return foundCase;
          }
        }
        const defaults = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
        const foundDefault = findNodeById(defaults, nodeId);
        if (foundDefault) {
          return foundDefault;
        }
      }
    }
    return null;
  };
  const replaceNodeById = (nodes: FlowNode[], nodeId: string, nextNode: FlowNode): FlowNode[] => (
    nodes.map((node) => {
      if (node.id === nodeId) {
        return nextNode;
      }
      if (node.kind === 'if') {
        return {
          ...node,
          then: replaceNodeById(node.then, nodeId, nextNode),
          else: replaceNodeById(node.else, nodeId, nextNode),
        } as FlowIfNode;
      }
      if (node.kind === 'processor' && node.processorType === 'foreach') {
        const nested = Array.isArray(node.config?.processors)
          ? node.config.processors
          : [];
        return {
          ...node,
          config: {
            ...(node.config || {}),
            processors: replaceNodeById(nested, nodeId, nextNode),
          },
        } as FlowProcessorNode;
      }
      if (node.kind === 'processor' && node.processorType === 'switch') {
        const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
        const updatedCases = cases.map((item: any) => ({
          ...item,
          processors: replaceNodeById(
            Array.isArray(item.processors) ? item.processors : [],
            nodeId,
            nextNode,
          ),
        }));
        const defaults = Array.isArray(node.config?.defaultProcessors)
          ? node.config.defaultProcessors
          : [];
        return {
          ...node,
          config: {
            ...(node.config || {}),
            cases: updatedCases,
            defaultProcessors: replaceNodeById(defaults, nodeId, nextNode),
          },
        } as FlowProcessorNode;
      }
      return node;
    })
  );
  const getFlowStateByLane = (scope: 'object' | 'global', lane: 'object' | 'pre' | 'post') => {
    if (scope === 'global') {
      if (lane === 'pre') {
        return { nodes: globalPreFlow, setNodes: setGlobalPreFlow };
      }
      return { nodes: globalPostFlow, setNodes: setGlobalPostFlow };
    }
    return { nodes: advancedFlow, setNodes: setAdvancedFlow };
  };
  const openFlowEditor = (
    nodeId: string,
    scope: 'object' | 'global',
    lane: 'object' | 'pre' | 'post',
    nodesOverride?: FlowNode[],
    setNodesOverride?: React.Dispatch<React.SetStateAction<FlowNode[]>>,
  ) => {
    const nodes = nodesOverride || getFlowStateByLane(scope, lane).nodes;
    const node = findNodeById(nodes, nodeId);
    if (!node) {
      return;
    }
    setFlowEditor({ scope, lane, nodeId, setNodesOverride });
    setFlowEditorDraft(JSON.parse(JSON.stringify(node)) as FlowNode);
  };
  const parseJsonValue = <T,>(value: string | undefined, fallback: T): T => {
    if (!value || !value.trim()) {
      return fallback;
    }
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };

  const buildProcessorPayloadFromConfig = (
    processorType: string,
    config: Record<string, any>,
    buildNested?: (nodes: FlowNode[]) => any[],
  ): any => {
    if (processorType === 'set') {
      const sourceValue = config.sourceType === 'path'
        ? normalizeSourcePath(String(config.source || ''))
        : config.source;
      let argsValue: any[] | undefined;
      if (typeof config.argsText === 'string' && config.argsText.trim()) {
        try {
          const parsed = JSON.parse(config.argsText);
          if (Array.isArray(parsed)) {
            argsValue = parsed;
          }
        } catch {
          argsValue = undefined;
        }
      }
      return {
        set: {
          source: sourceValue,
          ...(argsValue ? { args: argsValue } : {}),
          targetField: config.targetField || '',
        },
      };
    }
    if (processorType === 'regex') {
      const sourceValue = config.sourceType === 'literal'
        ? String(config.source || '')
        : normalizeSourcePath(String(config.source || ''));
      const groupNumber = Number(config.group);
      const hasGroup = Number.isFinite(groupNumber) && String(config.group).trim() !== '';
      return {
        regex: {
          source: sourceValue,
          pattern: config.pattern || '',
          ...(hasGroup ? { group: groupNumber } : {}),
          targetField: config.targetField || '',
        },
      };
    }
    if (processorType === 'append') {
      return {
        append: {
          source: config.source ?? '',
          array: parseJsonValue(config.arrayText, [] as any[]),
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'appendToOutputStream') {
      return {
        appendToOutputStream: {
          source: config.source ?? '',
          output: config.output ?? '',
        },
      };
    }
    if (processorType === 'break') {
      return { break: {} };
    }
    if (processorType === 'convert') {
      return {
        convert: {
          source: config.source ?? '',
          type: config.type ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'copy') {
      return {
        copy: {
          source: config.source ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'discard') {
      return { discard: {} };
    }
    if (processorType === 'eval') {
      return {
        eval: {
          source: config.source ?? '',
          ...(config.targetField ? { targetField: config.targetField } : {}),
        },
      };
    }
    if (processorType === 'foreach') {
      const nestedNodes = Array.isArray(config.processors)
        ? config.processors
        : [];
      return {
        foreach: {
          source: config.source ?? '',
          ...(config.keyVal ? { keyVal: config.keyVal } : {}),
          ...(config.valField ? { valField: config.valField } : {}),
          processors: buildNested ? buildNested(nestedNodes) : nestedNodes,
        },
      };
    }
    if (processorType === 'grok') {
      return {
        grok: {
          source: config.source ?? '',
          pattern: config.pattern ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'json') {
      return {
        json: {
          source: config.source ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'log') {
      return {
        log: {
          type: config.type ?? '',
          source: config.source ?? '',
        },
      };
    }
    if (processorType === 'lookup') {
      return {
        lookup: {
          source: config.source ?? '',
          properties: parseJsonValue(config.propertiesText, {}),
          fallback: parseJsonValue(config.fallbackText, {}),
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'math') {
      return {
        math: {
          source: config.source ?? '',
          operation: config.operation ?? '',
          value: config.value ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'remove') {
      return {
        remove: {
          source: config.source ?? '',
        },
      };
    }
    if (processorType === 'rename') {
      return {
        rename: {
          source: config.source ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'replace') {
      return {
        replace: {
          source: config.source ?? '',
          pattern: config.pattern ?? '',
          replacement: config.replacement ?? '',
          ...(typeof config.regex === 'boolean' ? { regex: config.regex } : {}),
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'setOutputStream') {
      return {
        setOutputStream: {
          output: config.output ?? '',
        },
      };
    }
    if (processorType === 'sort') {
      return {
        sort: {
          source: config.source ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'split') {
      return {
        split: {
          source: config.source ?? '',
          delimiter: config.delimiter ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'strcase') {
      return {
        strcase: {
          source: config.source ?? '',
          type: config.type ?? '',
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'substr') {
      const startValue = config.start ?? '';
      const endValue = config.end ?? '';
      return {
        substr: {
          source: config.source ?? '',
          ...(String(startValue).trim() ? { start: Number(startValue) } : {}),
          ...(String(endValue).trim() ? { end: Number(endValue) } : {}),
          targetField: config.targetField ?? '',
        },
      };
    }
    if (processorType === 'switch') {
      const cases = Array.isArray(config.cases) ? config.cases : [];
      const defaultProcessors = Array.isArray(config.defaultProcessors)
        ? config.defaultProcessors
        : [];
      return {
        switch: {
          source: config.source ?? '',
          operator: config.operator ?? '',
          case: cases.map((item: any) => ({
            match: item.match ?? '',
            ...(item.operator ? { operator: item.operator } : {}),
            then: buildNested ? buildNested(Array.isArray(item.processors) ? item.processors : []) : [],
          })),
          default: buildNested ? buildNested(defaultProcessors) : [],
        },
      };
    }
    if (processorType === 'trim') {
      return {
        trim: {
          source: config.source ?? '',
          ...(config.cutset ? { cutset: config.cutset } : {}),
          targetField: config.targetField ?? '',
        },
      };
    }
    return {
      [processorType]: config || {},
    };
  };

  const buildFlowProcessor = (node: FlowNode): any => {
    if (node.kind === 'if') {
      return {
        if: {
          source: node.condition.property,
          operator: node.condition.operator,
          value: node.condition.value,
          processors: buildFlowProcessors(node.then),
          else: buildFlowProcessors(node.else),
        },
      };
    }
    return buildProcessorPayloadFromConfig(
      node.processorType,
      node.config || {},
      buildFlowProcessors,
    );
  };
  const [advancedFlowFocusTarget, setAdvancedFlowFocusTarget] = useState<string | null>(null);
  const [advancedFlowFocusIndex, setAdvancedFlowFocusIndex] = useState(0);
  const [advancedFlowFocusOnly, setAdvancedFlowFocusOnly] = useState(false);
  const advancedFlowHighlightRef = useRef<HTMLSpanElement | null>(null);
  const buildFlowProcessors = (nodes: FlowNode[]) => nodes.map(buildFlowProcessor);
  type FlowValidationResult = {
    fieldErrors: Record<string, string[]>;
    nodeErrors: string[];
  };
  type FlowNodeErrorMap = Record<string, string[]>;
  const hasEventPath = (value: any): boolean => {
    if (value == null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.includes('$.event');
    }
    if (Array.isArray(value)) {
      return value.some((entry) => hasEventPath(entry));
    }
    if (typeof value === 'object') {
      return Object.values(value).some((entry) => hasEventPath(entry));
    }
    return false;
  };
  const isFieldOptional = (label?: string) => Boolean(label && /optional/i.test(label));
  const processorRequiredFields: Record<string, string[]> = {
    set: ['sourceType', 'source', 'targetField'],
    regex: ['sourceType', 'source', 'pattern', 'targetField'],
    append: ['source', 'array', 'targetField'],
    appendToOutputStream: ['source', 'output'],
    convert: ['source', 'type', 'targetField'],
    copy: ['source', 'targetField'],
    eval: ['source'],
    foreach: ['source', 'keyVal', 'valField'],
    grok: ['source', 'pattern', 'targetField'],
    json: ['source', 'targetField'],
    log: ['type', 'source'],
    lookup: ['source', 'properties', 'targetField'],
    math: ['source', 'operation', 'value', 'targetField'],
    remove: ['source'],
    rename: ['source', 'targetField'],
    replace: ['source', 'pattern', 'replacement', 'targetField'],
    setOutputStream: ['output'],
    sort: ['source', 'targetField'],
    split: ['source', 'delimiter', 'targetField'],
    strcase: ['source', 'type', 'targetField'],
    substr: ['source', 'targetField'],
    switch: ['source', 'operator'],
    trim: ['source', 'targetField'],
  };
  const getProcessorRequiredFields = (processorType: string) => {
    if (processorRequiredFields[processorType]) {
      return processorRequiredFields[processorType];
    }
    const specs = processorConfigSpecs[processorType] || [];
    return specs
      .filter((spec) => !isFieldOptional(spec.label))
      .map((spec) => spec.key);
  };
  const validateProcessorConfig = (
    processorType: string,
    config: Record<string, any>,
    lane: 'object' | 'pre' | 'post',
  ): FlowValidationResult => {
    const requiredKeys = new Set(getProcessorRequiredFields(processorType));
    const fieldErrors: Record<string, string[]> = {};
    const nodeErrors: string[] = [];
    (processorConfigSpecs[processorType] || []).forEach((spec) => {
      const isJsonField = spec.type === 'json';
      const valueKey = isJsonField ? `${spec.key}Text` : spec.key;
      const rawValue = config?.[valueKey];
      const stringValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      const isRequired = requiredKeys.has(spec.key);
      if (isRequired) {
        if (stringValue === '' || stringValue === undefined || stringValue === null) {
          fieldErrors[spec.key] = [...(fieldErrors[spec.key] || []), `${spec.label} is required.`];
        }
      }
      if (isJsonField && typeof rawValue === 'string' && rawValue.trim()) {
        try {
          const parsed = JSON.parse(rawValue);
          if (lane === 'pre' && hasEventPath(parsed)) {
            fieldErrors[spec.key] = [...(fieldErrors[spec.key] || []), 'Pre scope cannot reference $.event.*.'];
          }
        } catch {
          fieldErrors[spec.key] = [...(fieldErrors[spec.key] || []), `${spec.label} must be valid JSON.`];
        }
      }
      if (lane === 'pre' && !isJsonField && typeof rawValue === 'string' && rawValue.includes('$.event')) {
        fieldErrors[spec.key] = [...(fieldErrors[spec.key] || []), 'Pre scope cannot reference $.event.*.'];
      }
    });
    if (processorType === 'switch') {
      const cases = Array.isArray(config.cases) ? config.cases : [];
      if (cases.length === 0) {
        nodeErrors.push('Switch must include at least one case.');
      }
      if (cases.some((entry: any) => !String(entry.match ?? '').trim())) {
        nodeErrors.push('All switch cases must include a match value.');
      }
    }
    if (processorType === 'foreach' && !String(config.source ?? '').trim()) {
      fieldErrors.source = [...(fieldErrors.source || []), 'Source is required.'];
    }
    if (processorType === 'if') {
      if (!String(config.source ?? '').trim()) {
        fieldErrors.source = [...(fieldErrors.source || []), 'Source is required.'];
      }
      if (!String(config.value ?? '').trim()) {
        fieldErrors.value = [...(fieldErrors.value || []), 'Value is required.'];
      }
    }
    return { fieldErrors, nodeErrors };
  };
  const validateFlowNode = (
    node: FlowNode,
    lane: 'object' | 'pre' | 'post',
    map: FlowNodeErrorMap,
  ) => {
    if (node.kind === 'if') {
      const errors: string[] = [];
      if (!String(node.condition.property || '').trim()) {
        errors.push('Condition property is required.');
      }
      if (!String(node.condition.value || '').trim()) {
        errors.push('Condition value is required.');
      }
      if (node.then.length === 0 && node.else.length === 0) {
        errors.push('If must include at least one processor in Then or Else.');
      }
      if (lane === 'pre' && (node.condition.property || '').includes('$.event')) {
        errors.push('Pre scope cannot reference $.event.* in condition property.');
      }
      if (lane === 'pre' && (node.condition.value || '').includes('$.event')) {
        errors.push('Pre scope cannot reference $.event.* in condition value.');
      }
      if (errors.length > 0) {
        map[node.id] = errors;
      }
      node.then.forEach((child) => validateFlowNode(child, lane, map));
      node.else.forEach((child) => validateFlowNode(child, lane, map));
      return;
    }
    const { fieldErrors, nodeErrors } = validateProcessorConfig(node.processorType, node.config || {}, lane);
    const flatErrors = [
      ...Object.values(fieldErrors).flat(),
      ...nodeErrors,
    ];
    if (flatErrors.length > 0) {
      map[node.id] = flatErrors;
    }
    if (node.processorType === 'foreach') {
      const processors = Array.isArray(node.config?.processors) ? node.config.processors : [];
      processors.forEach((child: FlowNode) => validateFlowNode(child, lane, map));
    }
    if (node.processorType === 'switch') {
      const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
      cases.forEach((entry: any) => {
        const processors = Array.isArray(entry.processors) ? entry.processors : [];
        processors.forEach((child: FlowNode) => validateFlowNode(child, lane, map));
      });
      const defaults = Array.isArray(node.config?.defaultProcessors) ? node.config.defaultProcessors : [];
      defaults.forEach((child: FlowNode) => validateFlowNode(child, lane, map));
    }
  };
  const validateFlowNodes = (
    nodes: FlowNode[],
    lane: 'object' | 'pre' | 'post',
  ): FlowNodeErrorMap => {
    const map: FlowNodeErrorMap = {};
    nodes.forEach((node) => validateFlowNode(node, lane, map));
    return map;
  };
    type FocusMatch = { lane: 'object' | 'pre' | 'post'; processor: any };
    const collectFocusMatches = (
      payloads: any[],
      targetField: string,
      lane: FocusMatch['lane'],
    ) => {
      const matches: FocusMatch[] = [];
      const walk = (items: any[]) => {
        (items || []).forEach((item) => {
          if (!item || typeof item !== 'object') {
            return;
          }
          if (item.if) {
            walk(Array.isArray(item.if.processors) ? item.if.processors : []);
            walk(Array.isArray(item.if.else) ? item.if.else : []);
            return;
          }
          if (item.foreach?.processors) {
            walk(Array.isArray(item.foreach.processors) ? item.foreach.processors : []);
          }
          if (Array.isArray(item.switch?.case)) {
            item.switch.case.forEach((entry: any) => (
              walk(Array.isArray(entry.then) ? entry.then : [])
            ));
          }
          if (Array.isArray(item.switch?.default)) {
            walk(item.switch.default);
          }
          if (getProcessorTargetField(item) === targetField) {
            matches.push({ lane, processor: item });
          }
        });
      };
      walk(payloads);
      return matches;
    };
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
          <span ref={advancedFlowHighlightRef} className="code-highlight">{focusJson}</span>
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
  const [flowEditor, setFlowEditor] = useState<{
    scope: 'object' | 'global';
    lane: 'object' | 'pre' | 'post';
    nodeId: string;
    setNodesOverride?: React.Dispatch<React.SetStateAction<FlowNode[]>>;
  } | null>(null);
  const [flowEditorDraft, setFlowEditorDraft] = useState<FlowNode | null>(null);
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
  const isPreScopeEventPath = (value: string | undefined | null) => (
    isPreGlobalFlow && typeof value === 'string' && value.includes('$.event')
  );
  const hasPreScopeEventUsage = (draft: FlowNode | null) => {
    if (!draft || !isPreGlobalFlow) {
      return false;
    }
    if (draft.kind === 'if') {
      return isPreScopeEventPath(draft.condition.property)
        || isPreScopeEventPath(draft.condition.value);
    }
    return isPreScopeEventPath(draft.config?.source)
      || isPreScopeEventPath(draft.config?.targetField)
      || isPreScopeEventPath(draft.config?.pattern);
  };

  const getNestedValue = (source: any, path: string) => (
    path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), source)
  );
  const parsePermissionFlag = (value: any) => {
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
  const parseAccessValue = (value: any) => {
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (/(write|update|edit|modify|rw|readwrite)/.test(normalized)) {
        return true;
      }
      if (/(read|ro|view|readonly|read-only)/.test(normalized)) {
        return false;
      }
    }
    return null;
  };
  const findRulePermissionValues = (source: any) => {
    const matches: any[] = [];
    const walk = (node: any, pathKeys: string[]) => {
      if (!node) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, index) => walk(item, [...pathKeys, String(index)]));
        return;
      }
      if (typeof node !== 'object') {
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

  const processorConfigSpecs: Record<string, Array<{
    key: string;
    label: string;
    type: 'text' | 'json' | 'boolean' | 'select';
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
  }>> = {
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
      { key: 'output', label: 'Output', type: 'text', placeholder: 'pulsar+ssl:///assure1/event/sink' },
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
      { key: 'targetField', label: 'Target (optional)', type: 'text', placeholder: '$.localmem.evalResult' },
    ],
    foreach: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Details.trap.variables' },
      { key: 'keyVal', label: 'Key', type: 'text', placeholder: 'i' },
      { key: 'valField', label: 'Value', type: 'text', placeholder: 'v' },
    ],
    grok: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.syslog.datagram' },
      { key: 'pattern', label: 'Pattern', type: 'text', placeholder: '%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}' },
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
      { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.CountTimesTwo' },
    ],
    remove: [
      { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap.timeTicks' },
    ],
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
      { key: 'output', label: 'Output', type: 'text', placeholder: 'pulsar+ssl:///assure1/event/sink' },
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

  const getFlowEditorJsonErrors = (draft: FlowNode | null) => {
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
    const key = flowEditorDraft.kind === 'if'
      ? 'if'
      : flowEditorDraft.processorType;
    const help = processorHelp[key];
    if (!help?.example) {
      return;
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(help.example);
    } catch {
      return;
    }
    const processorKey = Object.keys(parsed || {})[0];
    const payload = parsed?.[processorKey];
    if (!processorKey || !payload) {
      return;
    }
    if (flowEditorDraft.kind === 'if' && processorKey === 'if') {
      setFlowEditorDraft((prev) => (prev && prev.kind === 'if'
        ? {
          ...prev,
          condition: {
            property: String(payload.source ?? ''),
            operator: String(payload.operator ?? '=='),
            value: String(payload.value ?? ''),
          },
        }
        : prev));
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
      if (field === 'processors' || field === 'then' || field === 'else' || field === 'case' || field === 'default') {
        return;
      }
      nextConfig[field] = value;
    });
    setFlowEditorDraft((prev) => (prev && prev.kind === 'processor'
      ? {
        ...prev,
        config: nextConfig,
      }
      : prev));
  };
  const explicitFlags = permissionPaths
    .map((path) => getNestedValue(session?.ua_login, path))
    .filter((value) => value !== undefined);
  const recursiveFlags = findRulePermissionValues(session?.ua_login);
  const accessFlags = [...explicitFlags, ...recursiveFlags]
    .map((value) => parseAccessValue(value))
    .filter((value) => value !== null) as boolean[];
  const derivedEditRules = explicitFlags.some((value) => parsePermissionFlag(value))
    || recursiveFlags.some((value) => parsePermissionFlag(value))
    || accessFlags.some((value) => value);
  const canEditRules = typeof session?.can_edit_rules === 'boolean'
    ? session.can_edit_rules
    : derivedEditRules;
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
    void loadMibPath('/');
  }, [activeApp, isAuthenticated, mibEntries.length, mibLoading]);

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
  const isAnyPanelEditing = Object.values(panelEditState).some(Boolean);

  const triggerToast = (message: string, pulse = false) => {
    setStagedToast(message);
    setToastPulseAfter(pulse);
  };

  const togglePanelEdit = (key: string) => {
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
    const varMatch = getVarInsertMatch(value, cursorIndex);
    if (varMatch) {
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      const trapVars = obj?.trap?.variables || [];
      setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
      setVarInsertContext({
        panelKey: builderTarget.panelKey,
        field: 'processorSource',
        value,
        replaceStart: varMatch.replaceStart,
        replaceEnd: varMatch.replaceEnd,
      });
      setVarModalMode('insert');
      setVarModalOpen(true);
      setVarModalToken(varMatch.token);
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
    const varMatch = getVarInsertMatch(value, cursorIndex);
    if (varMatch) {
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      setVarModalToken(varMatch.token);
      setVarModalVars(Array.isArray(obj?.trap?.variables) ? obj.trap.variables : []);
      setVarInsertContext({
        panelKey: builderTarget.panelKey,
        field: 'builderRegular',
        value,
        replaceStart: varMatch.replaceStart,
        replaceEnd: varMatch.replaceEnd,
      });
      setVarModalMode('insert');
      setVarModalOpen(true);
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
    () => servers.map((srv) => ({
      value: srv.server_id,
      label: srv.server_name,
    })),
    [servers],
  );

  const authOptions = useMemo(
    () => ([
      { value: 'basic', label: 'Basic (username/password)' },
      { value: 'certificate', label: 'Certificate' },
    ]),
    [],
  );

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
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const storedApp = sessionStorage.getItem('com.activeApp');
    if (storedApp === 'overview' || storedApp === 'fcom' || storedApp === 'pcom' || storedApp === 'mib') {
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
    if (isAuthenticated && entries.length === 0 && !browseLoading && !urlHydrated.current) {
      loadNode(null, '/');
    }
  }, [isAuthenticated, entries.length, browseLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const loadFavorites = async () => {
      setFavoritesError(null);
      setFavoritesLoading(true);
      try {
        const resp = await api.getFavorites();
        setFavorites(resp.data?.favorites || []);
      } catch (err: any) {
        setFavoritesError(err?.response?.data?.error || 'Failed to load favorites');
      } finally {
        setFavoritesLoading(false);
      }
    };
    loadFavorites();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || urlHydrated.current) {
      return;
    }
    urlHydrated.current = true;
    const params = new URLSearchParams(window.location.search);
    const nodeParam = params.get('node');
    const fileParam = params.get('file');
    const viewParam = params.get('view');

    if (viewParam === 'friendly' || viewParam === 'preview') {
      setViewMode(viewParam);
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
    params.set('view', viewMode);
    if (session?.server_id) {
      params.set('server', session.server_id);
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [browseNode, selectedFile, viewMode, isAuthenticated, session?.server_id]);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const credentials = authType === 'basic'
        ? { username, password }
        : { cert_path: certPath, key_path: keyPath, ca_cert_path: caPath || undefined };

      const resp = await api.login(serverId, authType, credentials);
      // Debug: log login response payload (omit credentials)
      // eslint-disable-next-line no-console
      console.info('Login response:', resp?.data);
      setSession(resp.data);
      setActiveApp('overview');
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('Login error:', err?.response?.data || err);
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore logout errors
    } finally {
      clearSession();
      urlHydrated.current = false;
      setActiveApp('overview');
      setSelectedFile(null);
      setFileData(null);
      setOverrideInfo(null);
      setOverrideError(null);
      setFileError(null);
      setSaveError(null);
      setSaveSuccess(null);
      setStagedToast(null);
      setSelectedFolder(null);
      setFolderOverview(null);
      setEntries([]);
      setBrowseData(null);
      setBrowseNode(null);
      setBreadcrumbs([{ label: '/', node: null }]);
      setViewMode('preview');
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

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

  const isFavorite = (pathId: string, type: 'file' | 'folder') => (
    favorites.some((fav) => fav.pathId === pathId && fav.type === type)
  );

  const toggleFavorite = async (favorite: { type: 'file' | 'folder'; pathId: string; label: string; node?: string }) => {
    try {
      if (isFavorite(favorite.pathId, favorite.type)) {
        const resp = await api.removeFavorite({ type: favorite.type, pathId: favorite.pathId });
        setFavorites(resp.data?.favorites || []);
      } else {
        const resp = await api.addFavorite(favorite);
        setFavorites(resp.data?.favorites || []);
      }
    } catch (err: any) {
      setFavoritesError(err?.response?.data?.error || 'Failed to update favorites');
    }
  };

  const refreshSearchStatus = async () => {
    try {
      const resp = await api.getSearchStatus();
      setSearchStatus(resp.data);
    } catch {
      // ignore
    }
  };

  const refreshOverviewStatus = async () => {
    try {
      const resp = await api.getOverviewStatus();
      setOverviewStatus(resp.data);
    } catch {
      // ignore
    }
  };

  const refreshFolderOverviewStatus = async () => {
    try {
      const resp = await api.getFolderOverviewStatus();
      setFolderOverviewStatus(resp.data);
    } catch {
      // ignore
    }
  };

  const handleRefreshOverviewCache = async (): Promise<boolean> => {
    setCacheActionMessage('Refreshing overview cache…');
    setOverviewRebuildPending(true);
    overviewRebuildStartRef.current = Date.now();
    startOverviewStatusPolling();
    try {
      await api.rebuildOverviewIndex();
      await loadOverview();
      setCacheActionMessage('Overview cache refresh triggered.');
      return true;
    } catch (err: any) {
      setCacheActionMessage(err?.response?.data?.error || 'Failed to refresh overview cache');
      setOverviewRebuildPending(false);
      stopOverviewStatusPolling();
      return false;
    }
  };

  const handleRefreshSearchCache = async (): Promise<boolean> => {
    setCacheActionMessage('Refreshing search cache…');
    try {
      await api.rebuildSearchIndex();
      startSearchStatusPolling();
      setCacheActionMessage('Search cache rebuild started.');
      return true;
    } catch (err: any) {
      setCacheActionMessage(err?.response?.data?.error || 'Failed to refresh search cache');
      return false;
    }
  };

  const handleRefreshFolderCache = async (): Promise<boolean> => {
    setCacheActionMessage('Refreshing folder cache…');
    setFolderRebuildPending(true);
    folderRebuildStartRef.current = Date.now();
    startFolderStatusPolling();
    try {
      await api.rebuildFolderOverviewCache(undefined, 25);
      await refreshFolderOverviewStatus();
      if (selectedFolder?.PathID) {
        try {
          const resp = await api.getFolderOverview(selectedFolder.PathID, 25);
          setFolderOverview(resp.data);
        } catch {
          // ignore folder reload errors
        }
      }
      setCacheActionMessage('Folder overview cache refreshed.');
      return true;
    } catch (err: any) {
      setCacheActionMessage(err?.response?.data?.error || 'Failed to refresh folder overview cache');
      setFolderRebuildPending(false);
      stopFolderStatusPolling();
      return false;
    }
  };

  const handleRefreshAllCaches = async () => {
    setCacheActionMessage('Refreshing all caches…');
    const results = await Promise.allSettled([
      handleRefreshOverviewCache(),
      handleRefreshSearchCache(),
      handleRefreshFolderCache(),
    ]);
    const folderSkipped = results[2]?.status === 'fulfilled' && results[2].value === false;
    setCacheActionMessage(folderSkipped
      ? 'All cache refresh actions triggered (folder cache skipped — select a folder).'
      : 'All cache refresh actions triggered.');
  };

  const stopSearchStatusPolling = () => {
    if (searchStatusPollRef.current !== null) {
      window.clearInterval(searchStatusPollRef.current);
      searchStatusPollRef.current = null;
    }
  };

  const stopOverviewStatusPolling = () => {
    if (overviewStatusPollRef.current !== null) {
      window.clearInterval(overviewStatusPollRef.current);
      overviewStatusPollRef.current = null;
    }
  };

  const stopFolderStatusPolling = () => {
    if (folderStatusPollRef.current !== null) {
      window.clearInterval(folderStatusPollRef.current);
      folderStatusPollRef.current = null;
    }
  };

  const startSearchStatusPolling = () => {
    stopSearchStatusPolling();
    searchStatusPollRef.current = window.setInterval(async () => {
      try {
        const resp = await api.getSearchStatus();
        setSearchStatus(resp.data);
        const lastBuilt = resp.data?.lastBuiltAt ? new Date(resp.data.lastBuiltAt).getTime() : null;
        const startedAt = searchRebuildStartRef.current;
        if (!resp.data?.isBuilding && lastBuilt && startedAt && lastBuilt >= startedAt - 1000) {
          setSearchRebuildPending(false);
          searchRebuildStartRef.current = null;
          stopSearchStatusPolling();
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  };

  const startOverviewStatusPolling = () => {
    stopOverviewStatusPolling();
    overviewStatusPollRef.current = window.setInterval(async () => {
      try {
        const resp = await api.getOverviewStatus();
        setOverviewStatus(resp.data);
        const lastBuilt = resp.data?.lastBuiltAt ? new Date(resp.data.lastBuiltAt).getTime() : null;
        const startedAt = overviewRebuildStartRef.current;
        if (!resp.data?.isBuilding && lastBuilt && startedAt && lastBuilt >= startedAt - 1000) {
          setOverviewRebuildPending(false);
          overviewRebuildStartRef.current = null;
          stopOverviewStatusPolling();
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  };

  const startFolderStatusPolling = () => {
    stopFolderStatusPolling();
    folderStatusPollRef.current = window.setInterval(async () => {
      try {
        const resp = await api.getFolderOverviewStatus();
        setFolderOverviewStatus(resp.data);
        const lastBuilt = resp.data?.lastBuiltAt ? new Date(resp.data.lastBuiltAt).getTime() : null;
        const startedAt = folderRebuildStartRef.current;
        if (!resp.data?.isBuilding && lastBuilt && startedAt && lastBuilt >= startedAt - 1000) {
          setFolderRebuildPending(false);
          folderRebuildStartRef.current = null;
          stopFolderStatusPolling();
        }
      } catch {
        // ignore polling errors
      }
    }, 2000);
  };

  const runSearch = async (query: string) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const resp = await api.searchComs(query, searchScope, 200);
      setSearchResults(resp.data?.results || []);
      if (resp.data?.status) {
        setSearchStatus(resp.data.status);
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Search failed';
      setSearchError(message);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    void runSearch(query);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    sessionStorage.removeItem('fcom.search.query');
  };

  const handleResetNavigation = async () => {
    handleClearSearch();
    setSearchScope('all');
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
    setViewMode('preview');
    setHighlightQuery(null);
    setHighlightPathId(null);
    setHighlightObjectKeys([]);
    setCurrentMatchIndex(0);
    setMatchObjectOptions([]);
    setSearchHighlightActive(false);
    await loadNodeInternal(null, '/');
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    const handle = window.setTimeout(() => {
      void runSearch(query);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [searchQuery, searchScope, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void refreshSearchStatus();
    return () => {
      stopSearchStatusPolling();
      stopFolderStatusPolling();
      stopOverviewStatusPolling();
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !showUserMenu) {
      return;
    }
    startOverviewStatusPolling();
    startSearchStatusPolling();
    startFolderStatusPolling();
    void refreshOverviewStatus();
    void refreshSearchStatus();
    void refreshFolderOverviewStatus();
  }, [isAuthenticated, showUserMenu]);

  useEffect(() => {
    if (showUserMenu) {
      return;
    }
    stopOverviewStatusPolling();
    stopSearchStatusPolling();
    stopFolderStatusPolling();
  }, [showUserMenu]);

  useEffect(() => {
    if (!isAuthenticated || !showPathModal) {
      return;
    }
    void refreshSearchStatus();
    void refreshFolderOverviewStatus();
  }, [isAuthenticated, showPathModal]);

  const handleRebuildIndex = async () => {
    setSearchError(null);
    setSearchLoading(true);
    try {
      searchRebuildStartRef.current = Date.now();
      setSearchRebuildPending(true);
      const resp = await api.rebuildSearchIndex();
      setSearchStatus(resp.data);
      startSearchStatusPolling();
      const query = searchQuery.trim();
      if (query) {
        await runSearch(query);
      }
    } catch (err: any) {
      setSearchError(err?.response?.data?.error || 'Failed to rebuild index');
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

  const getSearchResultName = (result: any) => result?.name || result?.pathId?.split('/').pop() || result?.pathId;

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
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to load files');
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

  const buildBreadcrumbsFromNode = (node: string | null) => {
    if (!node) {
      return [{ label: '/', node: null }];
    }
    const segments = node.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; node: string | null }> = [{ label: '/', node: null }];
    let acc = '';
    segments.forEach((segment, index) => {
      acc = acc ? `${acc}/${segment}` : segment;
      const label = index === 0 && segment.startsWith('id-') ? segment.replace(/^id-/, '') : segment;
      crumbs.push({ label, node: acc });
    });
    return crumbs;
  };

  const buildBreadcrumbsFromPath = (pathId: string) => {
    if (!pathId) {
      return [{ label: '/', node: null }];
    }
    const segments = pathId.split('/').filter(Boolean);
    const crumbs: Array<{ label: string; node: string | null }> = [{ label: '/', node: null }];
    let acc = '';
    segments.forEach((segment, index) => {
      acc = acc ? `${acc}/${segment}` : segment;
      const label = index === 0 && segment.startsWith('id-') ? segment.replace(/^id-/, '') : segment;
      crumbs.push({ label, node: acc });
    });
    return crumbs;
  };

  const isFolder = (entry: any) => {
    const icon = String(entry?.icon || '').toLowerCase();
    const name = String(entry?.PathName || '').toLowerCase();
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

  const handleOpenFileInternal = async (entry: any) => {
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
    if (entry?.PathID) {
      scrollStateByFileRef.current[entry.PathID] = 0;
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
    setFileLoading(true);
    if (entry?.PathID) {
      setBreadcrumbs(buildBreadcrumbsFromPath(entry.PathID));
    }
    try {
      const resp = await api.readFile(entry.PathID);
      setFileData(resp.data);
      setOverrideLoading(true);
      try {
        const overridesResp = await api.getOverrides(entry.PathID);
        setOverrideInfo(overridesResp.data);
      } catch (err: any) {
        setOverrideError(err?.response?.data?.error || 'Failed to load overrides');
        setOverrideInfo(null);
      } finally {
        setOverrideLoading(false);
      }
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
      setCommitMessage('');
      setViewMode('friendly');
    } catch (err: any) {
      setFileError(err?.response?.data?.error || 'Failed to load file');
    } finally {
      setFileLoading(false);
      highlightNextOpenRef.current = false;
    }
  };

  const handleOpenFile = async (entry: any) => {
    if (!confirmDiscardIfDirty(() => handleOpenFileInternal(entry))) {
      return;
    }
  };

  const handleOpenFolder = async (entry: any) => {
    if (!confirmDiscardIfDirty(() => handleOpenFolderInternal(entry))) {
      return;
    }
  };

  const handleOpenFolderInternal = async (entry: any) => {
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
      setBreadcrumbs(buildBreadcrumbsFromPath(entry.PathID));
      await loadNodeInternal(entry.PathID);
      const resp = await api.getFolderOverview(entry.PathID, 25);
      setFolderOverview(resp.data);
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to load folder overview');
    } finally {
      setFolderLoading(false);
    }
  };

  const openFileFromUrl = async (fileId: string, nodeParam?: string | null) => {
    const fileName = fileId.split('/').pop() || fileId;
    const derivedParent = fileId.split('/').slice(0, -1).join('/');
    const parentNode = nodeParam || derivedParent;
    try {
      await handleOpenFileInternal({ PathID: fileId, PathName: fileName });
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
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to restore file from URL');
    }
  };

  const handleOpenSearchResult = async (result: any) => {
    const pathId = result?.pathId || result?.path || '';
    if (!pathId) {
      return;
    }
    const query = searchQuery.trim();
    if (query) {
      setHighlightQuery(query);
      setHighlightPathId(pathId);
      const source = result?.source === 'both' ? 'both' : result?.source === 'name' ? 'name' : 'content';
      setHighlightMatchSource(source);
      setSearchHighlightActive(source === 'content' || source === 'both');
      highlightNextOpenRef.current = true;
    }
    await openFileFromUrl(pathId);
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
      if (char === '\'' && !inDouble) {
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

  const openTrapComposerFromTest = async (obj: any) => {
    const testCommand = obj?.test;
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
    setTrapObjectName(String(obj?.['@objectName'] || obj?.name || ''));
    setTrapHost('');
    setTrapPort(162);
    if (parsed.version) {
      setTrapVersion(parsed.version);
    }
    if (parsed.community) {
      setTrapCommunity(parsed.community);
    }
    if (parsed.host) {
      const [hostValue, portValue] = parsed.host.split(':');
      setTrapHost(hostValue || parsed.host);
      if (portValue && Number(portValue)) {
        setTrapPort(Number(portValue));
      }
    }
    setTrapOid(parsed.trapOid ? String(parsed.trapOid) : '');
    setTrapMibModule(parsed.mibModule || '');
    setTrapVarbinds(parsed.varbinds.length > 0 ? parsed.varbinds : [{ oid: '', type: 's', value: '' }]);
    setTrapManualOpen(false);
    setTrapModalOpen(true);
    await loadBrokerServers();
  };

  const buildTrapTestItems = (objects: any[], sourceLabel: string) => {
    const items: Array<{
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
    }> = [];
    let missing = 0;
    let invalid = 0;
    objects.forEach((obj) => {
      const testCommand = obj?.test;
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
        objectName: String(obj?.['@objectName'] || obj?.name || 'Object'),
        sourceLabel,
        parsed,
      });
    });
    // eslint-disable-next-line no-console
    console.info(`[TrapTest] ${sourceLabel}: objects=${objects.length}, tests=${items.length}, missing=${missing}, invalid=${invalid}`);
    return { items, missing, invalid };
  };

  const openBulkTrapModal = async (items: Array<{
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
  }>, label: string) => {
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
    await loadBrokerServers();
  };

  const isFileTestLoading = (fileId?: string) => (fileId ? Boolean(fileTestLoading[fileId]) : false);

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
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load file for testing';
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
      .map((entry) => entry.PathID);
    if (listed.length > 0) {
      return listed;
    }
    const fallbackRows = Array.isArray(folderOverview?.topFiles) ? folderOverview.topFiles : [];
    return fallbackRows
      .map((row: any) => row?.pathId)
      .filter(Boolean);
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
    const allItems: Array<{
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
    }> = [];
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
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Failed to load folder files for testing';
      triggerToast(message, false);
    } finally {
      setVendorTestLoading(false);
    }
  };

  const loadMibPath = async (nextPath?: string, options?: { append?: boolean }) => {
    const append = options?.append ?? false;
    const targetPath = (nextPath ?? mibPath ?? '/') || '/';
    const offset = append ? mibOffset : 0;
    const searchParam = mibSearchScope === 'folder' && mibSearch.trim()
      ? mibSearch.trim()
      : undefined;

    setMibLoading(true);
    setMibError(null);
    try {
      const resp = await api.browseMibs(targetPath !== '/' ? targetPath : undefined, {
        search: searchParam,
        limit: mibLimit,
        offset,
      });
      const entries = Array.isArray(resp.data?.entries) ? resp.data.entries : [];
      setMibEntries((prev) => (append ? [...prev, ...entries] : entries));
      setMibOffset(offset + entries.length);
      setMibHasMore(Boolean(resp.data?.hasMore));
      setMibTotal(typeof resp.data?.total === 'number' ? resp.data.total : null);
      setMibFilteredTotal(typeof resp.data?.filtered_total === 'number' ? resp.data.filtered_total : null);
      setMibPath(resp.data?.path || '/');
      setMibSearchMode('browse');
    } catch (err: any) {
      setMibError(err?.response?.data?.error || 'Failed to load MIB folder');
    } finally {
      setMibLoading(false);
    }
  };

  const loadMibSearch = async (options?: { append?: boolean }) => {
    const query = mibSearch.trim();
    if (!query) {
      await loadMibPath(mibPath, { append: false });
      return;
    }
    const append = options?.append ?? false;
    const offset = append ? mibOffset : 0;
    setMibLoading(true);
    setMibError(null);
    try {
      const resp = await api.searchMibs(query, { limit: mibLimit, offset });
      const entries = Array.isArray(resp.data?.entries) ? resp.data.entries : [];
      setMibEntries((prev) => (append ? [...prev, ...entries] : entries));
      setMibOffset(offset + entries.length);
      setMibHasMore(Boolean(resp.data?.hasMore));
      setMibTotal(typeof resp.data?.matches === 'number' ? resp.data.matches : null);
      setMibFilteredTotal(null);
      setMibPath('/');
      setMibSearchMode('search');
    } catch (err: any) {
      setMibError(err?.response?.data?.error || 'Failed to search MIBs');
    } finally {
      setMibLoading(false);
    }
  };

  const handleMibSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMibSelectedFile(null);
    setMibDefinitions([]);
    setMibSelectedDefinition(null);
    setMibOffset(0);
    if (mibSearchScope === 'all') {
      await loadMibSearch({ append: false });
      return;
    }
    await loadMibPath(mibPath, { append: false });
  };

  const handleMibClearSearch = async () => {
    setMibSearch('');
    setMibOffset(0);
    await loadMibPath(mibPath, { append: false });
  };

  const loadMibDefinitions = async (filePath: string) => {
    setMibLoading(true);
    setMibError(null);
    try {
      const resp = await api.parseMib(filePath);
      const defs = Array.isArray(resp.data?.definitions) ? resp.data.definitions : [];
      setMibDefinitions(defs);
      setMibSelectedDefinition(null);
    } catch (err: any) {
      setMibError(err?.response?.data?.error || 'Failed to parse MIB');
    } finally {
      setMibLoading(false);
    }
  };

  const handleOpenMibEntry = async (entry: any) => {
    if (entry?.isDir) {
      setMibSelectedFile(null);
      setMibDefinitions([]);
      setMibSelectedDefinition(null);
      setMibOffset(0);
      await loadMibPath(entry.path, { append: false });
      return;
    }
    if (!entry?.path) {
      return;
    }
    setMibSelectedFile(entry.path);
    setMibDefinitionSearch('');
    setMibOutput('');
    setMibOutputName('');
    setMib2FcomError(null);
    await loadMibDefinitions(entry.path);
  };

  const runMib2Fcom = async () => {
    if (!mibSelectedFile || !hasEditPermission) {
      return;
    }
    setMib2FcomLoading(true);
    setMib2FcomError(null);
    try {
      const resp = await api.runMib2Fcom(mibSelectedFile, undefined, mibUseParent);
      setMibOutput(resp.data?.content || '');
      setMibOutputName(resp.data?.outputName || '');
    } catch (err: any) {
      setMib2FcomError(err?.response?.data?.error || 'Failed to run MIB2FCOM');
    } finally {
      setMib2FcomLoading(false);
    }
  };

  const loadBrokerServers = async () => {
    setTrapServerError(null);
    try {
      const resp = await api.getBrokerServers();
      const data = Array.isArray(resp.data?.data) ? resp.data.data : [];
      setTrapServerList(data);
      if (data.length === 0) {
        setTrapManualOpen(true);
      }
    } catch (err: any) {
      setTrapServerError(err?.response?.data?.error || 'Failed to load servers');
      setTrapManualOpen(true);
    }
  };

  const openTrapComposer = async (definition: any, sourcePath?: string | null) => {
    setTrapError(null);
    setTrapSource('mib');
    setTrapObjectName('');
    setTrapOid(definition?.oid ? String(definition.oid) : '');
    setTrapVarbinds([{ oid: '', type: 's', value: '' }]);
    setTrapHost('');
    setTrapManualOpen(false);
    if (sourcePath) {
      const base = sourcePath.split('/').pop() || '';
      setTrapMibModule(base.replace(/\.(mib|txt)$/i, ''));
    } else {
      setTrapMibModule('');
    }
    setTrapModalOpen(true);
    await loadBrokerServers();
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
        const server = trapServerList.find((item) => (
          item?.ServerHostFQDN === trapHost
          || item?.ServerName === trapHost
        ));
        const destination = server?.ServerName || server?.ServerHostFQDN || trapHost;
        const label = trapObjectName || 'Object';
        triggerToast(`Test Trap: ${label} sent to ${destination}`, true);
      }
      setTrapModalOpen(false);
    } catch (err: any) {
      const message = err?.response?.data?.error || 'Failed to send trap';
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
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn('[TrapTest] send failed', {
          objectName: item.objectName,
          sourceLabel: item.sourceLabel,
          message: err?.response?.data?.error || err?.message,
        });
        failed += 1;
        setBulkTrapProgress((prev) => ({
          ...prev,
          failed: prev.failed + 1,
        }));
        setBulkTrapFailures((prev) => ([
          ...prev,
          {
            objectName: item.objectName,
            message: err?.response?.data?.error || err?.message || 'Failed to send trap',
            item,
          },
        ]));
      }
      if (bulkTrapContext.items.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    addRecentTarget(trapHost);
    triggerToast(`Sent ${passed}/${bulkTrapContext.items.length} SNMP traps (${failed} failed).`, failed === 0);
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

  const favoritesFiles = favorites.filter((fav) => fav.type === 'file');
  const favoritesFolders = favorites.filter((fav) => fav.type === 'folder');
  const filteredMibDefinitions = useMemo(() => (
    mibDefinitions.filter((entry) => (
      String(entry?.name || '').toLowerCase().includes(mibDefinitionSearch.trim().toLowerCase())
    ))
  ), [mibDefinitions, mibDefinitionSearch]);
  const saveWithContent = async (content: any, message: string) => {
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
      const etag = fileData?.etag || '';
      const commit = message.trim();
      const resp = await api.saveFile(selectedFile.PathID, content, etag, commit);
      setSaveSuccess('Saved successfully');
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
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || 'Failed to save file');
      return null;
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveFile = async (message: string) => {
    const content = editorText.trim().startsWith('{') || editorText.trim().startsWith('[')
      ? JSON.parse(editorText)
      : editorText;
    await saveWithContent(content, message);
  };

  const handleSaveOverrides = async (message: string) => {
    if (!selectedFile || !pendingOverrideSave) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    setSaveError(null);
    setSaveSuccess(null);
    setSaveLoading(true);
    try {
      const resp = await api.saveOverrides(selectedFile.PathID, pendingOverrideSave, message.trim());
      setOverrideInfo(resp.data);
      setSaveSuccess('Overrides saved. Restart FCOM Processor required.');
      triggerToast(`Overrides committed for ${formatDisplayPath(selectedFile.PathID)} (restart required)`);
      setPanelEditState({});
      setPanelDrafts({});
      setPanelOverrideRemovals({});
      setPanelNavWarning({ open: false, fields: {} });
    } catch (err: any) {
      setSaveError(err?.response?.data?.error || 'Failed to save overrides');
    } finally {
      setSaveLoading(false);
      setPendingOverrideSave(null);
    }
  };

  const getPreviewContent = (data: any) => {
    const ruleText = data?.content?.data?.[0]?.RuleText;
    if (typeof ruleText === 'string') {
      try {
        return JSON.parse(ruleText);
      } catch {
        return ruleText;
      }
    }
    return data?.content?.data?.[0] ?? data?.content ?? data ?? {};
  };

  const getFriendlyObjects = (data: any) => {
    const content = getPreviewContent(data);
    if (Array.isArray(content?.objects)) {
      return content.objects;
    }
    if (Array.isArray(content)) {
      return content;
    }
    return [];
  };

  const isTestableObject = (obj: any) => {
    const testCommand = obj?.test;
    if (!testCommand || typeof testCommand !== 'string') {
      return false;
    }
    const parsed = parseTrapTestCommand(testCommand);
    return Boolean(parsed?.trapOid);
  };

  const getBaseOverrides = () => (
    Array.isArray(overrideInfo?.overrides) ? overrideInfo.overrides : []
  );

  const getWorkingOverrides = () => (
    pendingOverrideSave || getBaseOverrides()
  );

  const availableEventFields = useMemo(() => {
    const fields = new Set<string>();
    getFriendlyObjects(fileData).forEach((obj: any) => {
      Object.keys(obj?.event || {}).forEach((field) => fields.add(field));
    });
    getWorkingOverrides().forEach((entry: any) => {
      Object.keys(entry?.event || {}).forEach((field) => fields.add(field));
    });
    Object.values(panelAddedFields).forEach((list) => {
      (list || []).forEach((field) => fields.add(field));
    });
    return Array.from(fields).sort((a, b) => a.localeCompare(b));
  }, [fileData, overrideInfo, pendingOverrideSave, panelAddedFields]);

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
        .map((obj: any) => obj?.['@objectName'])
        .filter(Boolean),
    );
    if (objectNames.size === 0) {
      return false;
    }
    return overrides.some((entry: any) => {
      const name = entry?.['@objectName'];
      return name && objectNames.has(name);
    });
  }, [selectedFile, fileData, overrideInfo, pendingOverrideSave]);

  const overrideIndex = useMemo(() => {
    const entries = getWorkingOverrides();
    const map = new Map<string, any[]>();
    entries.forEach((overrideEntry: any) => {
      const name = overrideEntry?.['@objectName'];
      if (!name) {
        return;
      }
      const list = map.get(name) || [];
      list.push(overrideEntry);
      map.set(name, list);
    });
    return map;
  }, [overrideInfo, pendingOverrideSave]);

  const getOverrideMethod = () => (
    overrideInfo?.method
    || (String(selectedFile?.PathID || '').includes('/syslog/') ? 'syslog' : 'trap')
  );

  const getOverrideEntries = () => getWorkingOverrides();

  const getOverrideEntry = (params: { objectName?: string; scope: 'pre' | 'post'; method: string }) => (
    getOverrideEntries().find((entry: any) => (
      entry?.scope === params.scope
      && entry?.method === params.method
      && (params.objectName
        ? entry?.['@objectName'] === params.objectName
        : !entry?.['@objectName'])
    ))
  );

  const buildFlowNodesFromProcessors = (processors: any[]): FlowNode[] => {
    const parseProcessor = (processor: any): FlowNode | null => {
      if (!processor || typeof processor !== 'object') {
        return null;
      }
      const type = Object.keys(processor || {})[0];
      const payload = (processor as any)[type] || {};
      if (type === 'if') {
        return {
          id: nextFlowId(),
          kind: 'if',
          condition: {
            property: String(payload.source ?? ''),
            operator: String(payload.operator ?? '=='),
            value: String(payload.value ?? ''),
          },
          then: buildFlowNodesFromProcessors(Array.isArray(payload.processors) ? payload.processors : []),
          else: buildFlowNodesFromProcessors(Array.isArray(payload.else) ? payload.else : []),
        } as FlowIfNode;
      }
      if (type === 'foreach') {
        return {
          id: nextFlowId(),
          kind: 'processor',
          processorType: 'foreach',
          config: {
            source: payload.source ?? '',
            keyVal: payload.key ?? '',
            valField: payload.value ?? '',
            processors: buildFlowNodesFromProcessors(Array.isArray(payload.processors) ? payload.processors : []),
          },
        } as FlowProcessorNode;
      }
      if (type === 'switch') {
        const cases = Array.isArray(payload.case) ? payload.case : [];
        return {
          id: nextFlowId(),
          kind: 'processor',
          processorType: 'switch',
          config: {
            source: payload.source ?? '',
            operator: payload.operator ?? '',
            cases: cases.map((item: any) => ({
              id: nextSwitchCaseId(),
              match: item.match ?? '',
              operator: item.operator ?? '',
              processors: buildFlowNodesFromProcessors(Array.isArray(item.then) ? item.then : []),
            })),
            defaultProcessors: buildFlowNodesFromProcessors(
              Array.isArray(payload.default) ? payload.default : [],
            ),
          },
        } as FlowProcessorNode;
      }
      const config: Record<string, any> = { ...(payload || {}) };
      if (type === 'set') {
        const sourceValue = payload.source;
        config.sourceType = typeof sourceValue === 'string' && sourceValue.startsWith('$.')
          ? 'path'
          : 'literal';
        if (Array.isArray(payload.args)) {
          config.argsText = JSON.stringify(payload.args, null, 2);
        }
      }
      if (type === 'append' && Array.isArray(payload.array)) {
        config.arrayText = JSON.stringify(payload.array, null, 2);
      }
      if (type === 'lookup' && payload.properties && typeof payload.properties === 'object') {
        config.propertiesText = JSON.stringify(payload.properties, null, 2);
      }
      if (type === 'lookup' && payload.fallback && typeof payload.fallback === 'object') {
        config.fallbackText = JSON.stringify(payload.fallback, null, 2);
      }
      return {
        id: nextFlowId(),
        kind: 'processor',
        processorType: type,
        config,
      } as FlowProcessorNode;
    };
    return (processors || [])
      .map(parseProcessor)
      .filter((node): node is FlowNode => Boolean(node));
  };

  const getProcessorTargetField = (processor: any) => {
    if (!processor || typeof processor !== 'object') {
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
      const target = processor?.[key]?.targetField;
      if (target) {
        return target;
      }
    }
    return null;
  };

  const getProcessorType = (processor: any) => (
    processor && typeof processor === 'object'
      ? Object.keys(processor || {})[0]
      : null
  );

  const getProcessorSummaryLines = (processor: any) => {
    const type = getProcessorType(processor);
    if (!type) {
      return [] as string[];
    }
    const payload = processor[type] || {};
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

  const formatOverrideValue = (value: any) => {
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

  const getProcessorDisplayValue = (processor: any) => {
    if (processor?.set) {
      return formatOverrideValue(processor.set.source);
    }
    const summary = getProcessorSummaryLines(processor);
    if (summary.length > 0) {
      return summary.join(' | ');
    }
    return 'override';
  };

  const buildIfConditionLabel = (payload: any) => {
    if (!payload || typeof payload !== 'object') {
      return 'condition';
    }
    const source = payload.source ?? 'value';
    const operator = payload.operator ?? '';
    const value = payload.value ?? '';
    return `${source} ${operator} ${value}`.trim();
  };

  const getOverrideTargetMap = (processors: any[]) => {
    const map = new Map<string, any>();
    const visit = (list: any[]) => {
      (list || []).forEach((processor: any) => {
        if (processor?.if) {
          const payload = processor.if;
          const condition = buildIfConditionLabel(payload);
          const thenMap = getOverrideTargetMap(payload.processors || []);
          const elseMap = getOverrideTargetMap(payload.else || []);
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
          if (processor?.set) {
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

  const stringifyProcessor = (processor: any) => {
    try {
      return JSON.stringify(processor || {});
    } catch {
      return '';
    }
  };

  const diffOverrides = (baseOverrides: any[], stagedOverrides: any[]) => {
    const indexOverrides = (overrides: any[]) => {
      const map = new Map<string, { entry: any; objectName?: string; scope?: string; method?: string }>();
      overrides.forEach((entry: any) => {
        const objectName = entry?.['@objectName'];
        const scope = entry?.scope || 'post';
        const method = entry?.method || '';
        const key = `${method}:${scope}:${objectName || '__global__'}`;
        map.set(key, { entry, objectName, scope, method });
      });
      return map;
    };

    const splitProcessors = (processors: any[]) => {
      const targeted = new Map<string, any>();
      const untargeted = new Map<string, any>();
      processors.forEach((proc: any, index: number) => {
        const target = getProcessorTargetField(proc);
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
        before?: any;
        after?: any;
        origin: 'event' | 'processor';
      }>;
      processorChanges: Array<{ action: 'added' | 'removed'; processor: any }>;
    }> = [];

    allKeys.forEach((key) => {
      const baseEntry = baseMap.get(key);
      const stagedEntry = stagedMap.get(key);
      const objectName = stagedEntry?.objectName || baseEntry?.objectName;
      const scope = stagedEntry?.scope || baseEntry?.scope;
      const baseProcessors = Array.isArray(baseEntry?.entry?.processors) ? baseEntry?.entry?.processors : [];
      const stagedProcessors = Array.isArray(stagedEntry?.entry?.processors) ? stagedEntry?.entry?.processors : [];
      const baseEventOverrides = baseEntry?.entry?.event && typeof baseEntry.entry.event === 'object'
        ? baseEntry.entry.event
        : {};
      const stagedEventOverrides = stagedEntry?.entry?.event && typeof stagedEntry.entry.event === 'object'
        ? stagedEntry.entry.event
        : {};
      const { targeted: baseTargeted, untargeted: baseUntargeted } = splitProcessors(baseProcessors);
      const { targeted: stagedTargeted, untargeted: stagedUntargeted } = splitProcessors(stagedProcessors);
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
        before?: any;
        after?: any;
        origin: 'event' | 'processor';
      }> = [];
      targets.forEach((target) => {
        const fieldName = target.replace('$.event.', '');
        const hasBaseEvent = Object.prototype.hasOwnProperty.call(baseEventOverrides, fieldName);
        const hasStagedEvent = Object.prototype.hasOwnProperty.call(stagedEventOverrides, fieldName);
        const baseValue = objectName && target.startsWith('$.event.')
          ? getBaseObjectValue(objectName, target)
          : undefined;
        const before = Object.prototype.hasOwnProperty.call(baseEventOverrides, fieldName)
          ? baseEventOverrides[fieldName]
          : baseTargeted.get(target) ?? baseTargetMap.get(target);
        const after = Object.prototype.hasOwnProperty.call(stagedEventOverrides, fieldName)
          ? stagedEventOverrides[fieldName]
          : stagedTargeted.get(target) ?? stagedTargetMap.get(target);
        const origin: 'event' | 'processor' = (hasBaseEvent || hasStagedEvent) ? 'event' : 'processor';
        if (before !== undefined && after !== undefined) {
          if (stringifyProcessor(before) !== stringifyProcessor(after)) {
            fieldChanges.push({ target, action: 'updated', before, after, origin });
          }
          return;
        }
        if (before !== undefined) {
          fieldChanges.push({ target, action: 'removed', before, origin });
        } else if (after !== undefined) {
          const action: 'added' | 'updated' = origin === 'event' && baseValue !== undefined
            ? 'updated'
            : 'added';
          fieldChanges.push({ target, action, after, origin });
        }
      });

      const procKeys = new Set<string>([...baseUntargeted.keys(), ...stagedUntargeted.keys()]);
      const processorChanges: Array<{ action: 'added' | 'removed'; processor: any }> = [];
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

    const totalChanges = sections.reduce((count, section) => (
      count + section.fieldChanges.length + section.processorChanges.length
    ), 0);
    const editedObjects = sections
      .filter((section) => Boolean(section.objectName))
      .map((section) => section.objectName as string);

    return { sections, totalChanges, editedObjects };
  };

  const getOverrideFlags = (obj: any) => {
    const objectName = obj?.['@objectName'];
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
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const targets = processors.map(getProcessorTargetField).filter(Boolean) as string[];
    const hasEventOverrides = overrides.some((entry: any) => (
      entry?.event && typeof entry.event === 'object' && Object.keys(entry.event).length > 0
    ));
    const event = hasEventOverrides || targets.some((target) => target.startsWith('$.event.'));
    const trap = targets.some((target) => target.startsWith('$.trap.') || target.includes('trap.variables'));
    const pre = targets.some((target) => target.startsWith('$.preProcessors'));
    const hasProcessors = processors.length > 0;
    const hasUntargeted = processors.some((proc: any) => !getProcessorTargetField(proc));
    return {
      event,
      trap,
      pre,
      any: event || trap || pre || hasProcessors,
      advancedFlow: hasProcessors && (hasUntargeted || (!event && !trap && !pre)),
    };
  };

  const getOverrideTargets = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return new Set<string>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const targetMap = getOverrideTargetMap(processors);
    overrides.forEach((entry: any) => {
      const eventOverrides = entry?.event && typeof entry.event === 'object' ? entry.event : {};
      Object.keys(eventOverrides).forEach((field) => {
        targetMap.set(`$.event.${field}`, eventOverrides[field]);
      });
    });
    return new Set<string>(Array.from(targetMap.keys()));
  };

  const getProcessorTargets = (obj: any) => getDirectOverrideTargets(obj);

  const getProcessorFieldSummary = (obj: any, field: string) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return '';
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (
      Array.isArray(entry?.processors) ? entry.processors : []
    ));
    const target = `$.event.${field}`;
    const processor = processors.find((proc: any) => getProcessorTargetField(proc) === target);
    if (!processor) {
      return '';
    }
    const summary = getProcessorSummaryLines(processor);
    if (summary.length > 0) {
      return summary.join(' • ');
    }
    return getProcessorDisplayValue(processor);
  };

  const getOverrideValueMap = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return new Map<string, any>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const targetMap = getOverrideTargetMap(processors);
    overrides.forEach((entry: any) => {
      const eventOverrides = entry?.event && typeof entry.event === 'object' ? entry.event : {};
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
    const obj = getFriendlyObjects(fileData).find((item: any) => item?.['@objectName'] === objectName);
    if (!obj) {
      return undefined;
    }
    const cleanedPath = target.replace(/^\$\./, '');
    return getNestedValue(obj, cleanedPath);
  };

  const getEffectiveEventValue = (obj: any, field: string) => {
    const overrides = getOverrideValueMap(obj);
    const target = `$.event.${field}`;
    if (overrides.has(target)) {
      return overrides.get(target);
    }
    return obj?.event?.[field];
  };

  const getPanelDirtyFields = (obj: any, panelKey: string) => {
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

  const getEventOverrideFields = (obj: any) => {
    const overrideValueMap = getOverrideValueMap(obj);
    const fields: string[] = [];
    overrideValueMap.forEach((_value, target) => {
      if (target.startsWith('$.event.')) {
        fields.push(target.replace('$.event.', ''));
      }
    });
    return fields;
  };

  const getDirectOverrideTargets = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return new Set<string>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const targets = new Set<string>();
    overrides.forEach((entry: any) => {
      const processors = Array.isArray(entry?.processors) ? entry.processors : [];
      processors.forEach((proc: any) => {
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
    const objects = getFriendlyObjects(fileData);
    objects.forEach((obj: any, idx: number) => {
      const baseKey = getObjectKey(obj, idx);
      const panelKey = `${baseKey}:event`;
      if (!panelEditState[panelKey]) {
        return;
      }
      const dirty = getPanelDirtyFields(obj, panelKey);
      if (dirty.length > 0) {
        map[panelKey] = dirty;
      }
    });
    return map;
  };

  const isFieldHighlighted = (panelKey: string, field: string) => (
    panelNavWarning.fields?.[panelKey]?.includes(field)
  );

  const isEvalMode = (panelKey: string, field: string) => (
    panelEvalModes?.[panelKey]?.[field] ?? false
  );

  const isEvalValue = (value: any) => (
    value && typeof value === 'object' && typeof value.eval === 'string'
  );

  const shouldShowEvalToggle = (panelKey: string, field: string, obj: any) => (
    isEvalMode(panelKey, field) || isEvalValue(getEffectiveEventValue(obj, field))
  );

  const renderFieldBadges = (
    panelKey: string,
    field: string,
    obj: any,
    overrideTargets: Set<string>,
  ) => {
    const evalFlag = shouldShowEvalToggle(panelKey, field, obj);
    const hasOverride = overrideTargets.has(`$.event.${field}`);
    const processorTargets = hasOverride ? getDirectOverrideTargets(obj) : new Set<string>();
    const processorFlag = hasOverride && processorTargets.has(`$.event.${field}`);
    if (!evalFlag && !processorFlag) {
      return null;
    }
    const objectName = obj?.['@objectName'];
    const processors = objectName
      ? (overrideIndex.get(objectName) || []).flatMap((entry: any) => (
        Array.isArray(entry?.processors) ? entry.processors : []
      ))
      : [];
    const processor = processors.find((proc: any) => (
      getProcessorTargetField(proc) === `$.event.${field}`
    ));
    const processorSummary = processor ? getProcessorSummaryLines(processor) : [];
    const overrideHoverProps = {
      onMouseEnter: () => {
        setSuppressVarTooltip(true);
        setSuppressEvalTooltip(true);
      },
      onMouseLeave: () => {
        setSuppressVarTooltip(false);
        setSuppressEvalTooltip(false);
      },
      onFocus: () => {
        setSuppressVarTooltip(true);
        setSuppressEvalTooltip(true);
      },
      onBlur: () => {
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
                {objectName && (
                  hasEditPermission && (
                    <button
                      type="button"
                      className="builder-link"
                      onClick={() => openAdvancedFlowModal(
                        'object',
                        objectName,
                        `$.event.${field}`,
                      )}
                    >
                      View in Advanced Flow
                    </button>
                  )
                )}
              </div>
            )}
          </span>
        )}
      </span>
    );
  };

  const overrideTooltipHoverProps = {
    onMouseEnter: () => {
      setSuppressVarTooltip(true);
      setSuppressEvalTooltip(true);
    },
    onMouseLeave: () => {
      setSuppressVarTooltip(false);
      setSuppressEvalTooltip(false);
    },
    onFocus: () => {
      setSuppressVarTooltip(true);
      setSuppressEvalTooltip(true);
    },
    onBlur: () => {
      setSuppressVarTooltip(false);
      setSuppressEvalTooltip(false);
    },
  };

  const renderOverrideSummaryCard = (
    obj: any,
    overrideValueMap: Map<string, any>,
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
      .filter(Boolean) as Array<{ field: string; value: any }>;

    if (rows.length === 0) {
      return null;
    }

    return (
      <div className="override-summary-card" role="tooltip">
        <div className="override-summary-title">{title}</div>
        <ul className="override-summary-list">
          {rows.map((row) => {
            const target = row.field.startsWith('$.') ? row.field : `$.event.${row.field}`;
            const baseValue = getBaseObjectValue(obj?.['@objectName'], target);
            const originalDisplay = baseValue === undefined
              ? 'New'
              : renderValue(baseValue, obj?.trap?.variables, { suppressEvalTooltip: true });
            return (
              <li key={`${row.field}-${String(row.value)}`} className="override-summary-item">
                <span className="override-summary-field">{row.field}</span>
                <span className="override-summary-value">
                  <span className="override-summary-label">Original is:</span>{' '}
                  {originalDisplay}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const reservedEventFields = new Set<string>();
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
    objects.forEach((obj: any) => {
      const method = obj?.method ?? obj?.event?.Method;
      const subMethod = obj?.event?.SubMethod ?? obj?.subMethod;
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

  const isTrapMethod = (value?: string | null) => (
    typeof value === 'string' && value.toLowerCase().includes('trap')
  );

  const isTrapFileContext = useMemo(() => {
    if (isTrapMethod(fileMethodInfo.method)) {
      return true;
    }
    if (selectedFile?.PathID && String(selectedFile.PathID).toLowerCase().includes('/trap/')) {
      return true;
    }
    const objects = getFriendlyObjects(fileData);
    const methods = objects
      .map((obj: any) => obj?.method ?? obj?.event?.Method)
      .filter(Boolean)
      .map((value: any) => String(value));
    if (methods.length === 0) {
      return false;
    }
    return methods.every((value) => isTrapMethod(value));
  }, [fileMethodInfo.method, selectedFile?.PathID, fileData]);

  const isTrapFolderContext = useMemo(() => {
    const pathId = selectedFolder?.PathID || '';
    return String(pathId).toLowerCase().includes('/trap/');
  }, [selectedFolder?.PathID]);

  const getExistingEventFields = (obj: any, panelKey: string) => {
    const fields = new Set<string>();
    Object.keys(obj?.event || {}).forEach((field) => fields.add(field));
    getEventOverrideFields(obj).forEach((field) => fields.add(field));
    (panelAddedFields[panelKey] || []).forEach((field) => fields.add(field));
    getStagedDirtyFields(obj).forEach((field) => fields.add(field));
    return fields;
  };

  const getBaseEventFields = (obj: any, panelKey: string) => {
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

  const getAdditionalEventFields = (obj: any, panelKey: string) => {
    const existing = Array.from(getExistingEventFields(obj, panelKey));
    const baseFields = new Set(getBaseEventFields(obj, panelKey));
    return existing.filter((field) => !baseFields.has(field) && !reservedEventFields.has(field));
  };

  const getEventFieldList = (obj: any, panelKey: string) => (
    [...getBaseEventFields(obj, panelKey), ...getAdditionalEventFields(obj, panelKey)]
  );

  const formatEventFieldLabel = (field: string) => (
    field.replace(/([a-z])([A-Z])/g, '$1 $2')
  );
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

  const isFieldDirty = (obj: any, panelKey: string, field: string) => {
    const removals = new Set(panelOverrideRemovals[panelKey] || []);
    if (removals.has(field)) {
      return true;
    }
    const draftValue = panelDrafts?.[panelKey]?.event?.[field];
    const original = getEffectiveEventValue(obj, field);
    const { display } = getEditableValue(original);
    return String(draftValue ?? '') !== String(display ?? '');
  };

  const isFieldPendingRemoval = (panelKey: string, field: string) => (
    (panelOverrideRemovals[panelKey] || []).includes(field)
  );

  const isFieldNew = (obj: any, field: string) => (
    getBaseObjectValue(obj?.['@objectName'], `$.event.${field}`) === undefined
  );

  const getEditableValue = (value: any) => {
    if (value === null || value === undefined) {
      return { editable: true, display: '', isEval: false };
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return { editable: true, display: String(value), isEval: false };
    }
    if (typeof value === 'object' && typeof value.eval === 'string') {
      return { editable: true, display: value.eval, isEval: true };
    }
    return { editable: true, display: JSON.stringify(value), isEval: false };
  };

  const getBaseEventDisplay = (obj: any, field: string) => {
    const objectName = obj?.['@objectName'];
    const baseValue = getBaseObjectValue(objectName, `$.event.${field}`);
    if (baseValue === undefined) {
      return 'New';
    }
    const { display } = getEditableValue(baseValue);
    return display || '—';
  };

  const startEventEdit = (obj: any, key: string) => {
    if (!hasEditPermission) {
      return;
    }
    const baseKey = key.includes(':') ? key.slice(0, key.lastIndexOf(':')) : key;
    const draft: Record<string, any> = {};
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

  const requestCancelEventEdit = (obj: any, key: string) => {
    if (getPanelDirtyFields(obj, key).length > 0) {
      setPendingCancel({ type: 'panel', panelKey: key });
      return;
    }
    cancelEventEdit(key);
  };

  const buildOverrideSetProcessor = (field: string, value: any) => ({
    set: {
      source: value,
      targetField: `$.event.${field}`,
    },
  });

  const saveEventEdit = async (obj: any, key: string) => {
    if (!selectedFile) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return;
    }
    const draft = panelDrafts?.[key]?.event || {};
    const removalFields = new Set(panelOverrideRemovals[key] || []);
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
    const updates: { field: string; value: any }[] = [];
    getEventFieldList(obj, key).forEach((field) => {
      if (stagedRemovedFields.has(field)) {
        return;
      }
      const original = getEffectiveEventValue(obj, field);
      const draftValue = draft[field];
      const { display } = getEditableValue(original);
      if (String(draftValue ?? '') !== String(display ?? '')) {
        let value: any = draftValue;
        if (!isEvalMode(key, field) && draftValue !== '' && !Number.isNaN(Number(draftValue)) && field !== 'Summary') {
          value = Number(draftValue);
        }
        if (isEvalMode(key, field)) {
          value = { eval: String(draftValue ?? '') };
        }
        updates.push({ field, value });
      }
    });

    if (updates.length === 0 && removalFields.size === 0) {
      setSaveError(null);
      setSaveSuccess('No changes made.');
      return;
    }

    const existingOverrides = Array.isArray(overrideInfo?.overrides) ? [...overrideInfo.overrides] : [];
    const baseOverrides = pendingOverrideSave
      ? [...pendingOverrideSave]
      : existingOverrides;
    const method = overrideInfo?.method || (String(selectedFile.PathID || '').includes('/syslog/') ? 'syslog' : 'trap');
    const scope = 'post';
    const matchIndex = baseOverrides.findIndex((entry: any) => (
      entry?.['@objectName'] === objectName && entry?.method === method && entry?.scope === scope
    ));

    const overrideEntry = matchIndex >= 0
      ? { ...baseOverrides[matchIndex] }
      : {
        name: `${objectName} Override`,
        description: `Overrides for ${objectName}`,
        domain: 'fault',
        method,
        scope,
        '@objectName': objectName,
        _type: 'override',
        processors: [],
      };

    let processors = Array.isArray(overrideEntry.processors) ? [...overrideEntry.processors] : [];
    const eventOverrides: Record<string, any> = overrideEntry.event && typeof overrideEntry.event === 'object'
      ? { ...overrideEntry.event }
      : {};

    if (removalFields.size > 0) {
      processors = processors.filter((proc: any) => {
        const target = getProcessorTargetField(proc);
        if (!target) {
          return true;
        }
        const field = target.replace('$.event.', '');
        return !removalFields.has(field);
      });
      removalFields.forEach((field) => {
        delete eventOverrides[field];
      });
    }

    updates.forEach(({ field, value }) => {
      if (removalFields.has(field)) {
        return;
      }
      eventOverrides[field] = value;
      const targetField = `$.event.${field}`;
      processors = processors.filter((proc: any) => getProcessorTargetField(proc) !== targetField);
    });

    const hasEventOverrides = Object.keys(eventOverrides).length > 0;
    if (processors.length === 0 && !hasEventOverrides) {
      if (matchIndex >= 0) {
        baseOverrides.splice(matchIndex, 1);
      }
    } else {
      overrideEntry.processors = processors;
      if (hasEventOverrides) {
        overrideEntry.event = eventOverrides;
      } else {
        delete overrideEntry.event;
      }
      if (matchIndex >= 0) {
        baseOverrides[matchIndex] = overrideEntry;
      } else {
        baseOverrides.push(overrideEntry);
      }
    }

    const stagedCount = updates.length + removalFields.size;
    setPendingOverrideSave(baseOverrides);
    triggerToast(`Staged ${stagedCount} event override change(s) for ${objectName}`, true);
    if (removalFields.size > 0) {
      const removedNewFields = Array.from(removalFields).filter((field) => (
        getBaseObjectValue(objectName, `$.event.${field}`) === undefined
      ));
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

  const openRemoveOverrideModal = (obj: any, field: string, panelKey: string) => {
    if (!hasEditPermission || !panelEditState[panelKey]) {
      return;
    }
    const baseDisplay = getBaseEventDisplay(obj, field);
    const isNewField = baseDisplay === 'New';
    setRemoveOverrideModal({
      open: true,
      objectName: obj?.['@objectName'],
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
    if (!removeOverrideModal.objectName || !removeOverrideModal.field || !removeOverrideModal.panelKey) {
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

  const openRemoveAllOverridesModal = (obj: any, panelKey: string) => {
    if (!hasEditPermission || !panelEditState[panelKey]) {
      return;
    }
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return;
    }
    const overrides = overrideIndex.get(objectName) || [];
    const eventOverrideFields = new Set<string>();
    overrides.forEach((entry: any) => {
      const eventOverrides = entry?.event && typeof entry.event === 'object' ? entry.event : {};
      Object.keys(eventOverrides).forEach((field) => eventOverrideFields.add(field));
    });
    const processorTargets = getDirectOverrideTargets(obj);
    const baseValues: Record<string, string> = {};
    const newFields: string[] = [];
    const removableFields: string[] = [];
    const processorFields: string[] = [];
    eventOverrideFields.forEach((field) => {
      removableFields.push(field);
      const baseValue = getBaseEventDisplay(obj, field) || '—';
      if (baseValue === 'New') {
        newFields.push(field);
        baseValues[field] = 'Added field (will be removed)';
      } else {
        baseValues[field] = baseValue;
      }
    });
    processorTargets.forEach((target) => {
      if (target?.startsWith('$.event.')) {
        processorFields.push(target.replace('$.event.', ''));
      }
    });
    if (removableFields.length === 0 && processorFields.length === 0) {
      return;
    }
    setRemoveAllOverridesModal({
      open: true,
      panelKey,
      fields: removableFields,
      baseValues,
      newFields,
      processorFields,
      objectName,
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

  const getObjectKey = (obj: any, index: number) => {
    const name = obj?.['@objectName'];
    return name ? `name:${name}` : `idx:${index}`;
  };

  const scrollToRef = (target?: HTMLDivElement | null) => {
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getActiveScrollContainer = () => (
    isAnyPanelEditing ? friendlyMainRef.current : friendlyViewRef.current
  );

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
    scrollToRef(objectRowRefs.current[key]);
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
    highlightQuery
    && highlightMatchSource
    && (highlightMatchSource === 'name' || highlightMatchSource === 'both')
    && selectedFile?.PathID
    && selectedFile.PathID === highlightPathId
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
      matchPingSequenceRef.current.push(window.setTimeout(() => {
        setMatchPingKey(null);
        runCount += 1;
        if (runCount < count) {
          matchPingSequenceRef.current.push(window.setTimeout(trigger, 260));
        }
      }, 520));
    };
    trigger();
  };

  const startFileNamePingSequence = (count = 3) => {
    clearPingSequence(fileNamePingSequenceRef);
    let runCount = 0;
    const trigger = () => {
      setFileNamePingActive(true);
      fileNamePingSequenceRef.current.push(window.setTimeout(() => {
        setFileNamePingActive(false);
        runCount += 1;
        if (runCount < count) {
          fileNamePingSequenceRef.current.push(window.setTimeout(trigger, 260));
        }
      }, 520));
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

  const getEvalText = (value: any) => {
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

  const handleVarInsertSelect = (token: string) => {
    if (!varInsertContext) {
      return;
    }
    const { panelKey, field, value, replaceStart, replaceEnd } = varInsertContext;
    const nextValue = `${value.slice(0, replaceStart)}${token}${value.slice(replaceEnd)}`;
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

  const createFlowNodeFromPaletteValue = (value: string) => (
    createFlowNode(
      value === 'if'
        ? { nodeKind: 'if' }
        : { nodeKind: 'processor', processorType: value },
    )
  );

  const renderProcessorConfigFields = (
    processorType: string,
    config: Record<string, any>,
    onConfigChange: (key: string, value: string | boolean) => void,
    context: 'flow' | 'builder',
    fieldErrors?: Record<string, string[]>,
  ) => (
    (processorConfigSpecs[processorType] || []).map((field) => {
      const isJsonField = field.type === 'json';
      const valueKey = isJsonField ? `${field.key}Text` : field.key;
      const value = (config?.[valueKey] ?? '') as string | boolean;
      const jsonError = isJsonField && String(value).trim()
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
                    className={`builder-toggle${String(value || (processorType === 'regex' ? 'path' : 'literal')) === option.value
                      ? ' builder-toggle-active'
                      : ''}`}
                    onClick={() => onConfigChange(field.key, option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="builder-hint">
                Auto-detects from $. prefix. Toggle to override.
              </div>
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
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          ) : isJsonField ? (
            <textarea
              className="builder-textarea"
              placeholder={field.placeholder}
              value={value as string}
              onChange={(e) => handleTextChange(
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )}
              data-error={errors.length > 0 ? 'true' : undefined}
              aria-invalid={errors.length > 0}
            />
          ) : (
            <input
              className="builder-input"
              placeholder={field.placeholder}
              value={value as string}
              onChange={(e) => handleTextChange(
                e.target.value,
                e.target.selectionStart,
                (e.nativeEvent as InputEvent | undefined)?.inputType,
              )}
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
    })
  );

  const handleFlowEditorInputChange = (
    fieldKey: 'flowEditor.source' | 'flowEditor.targetField' | 'flowEditor.pattern'
    | 'flowEditor.condition.property' | 'flowEditor.condition.value',
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

    const varMatch = getVarInsertMatch(value, cursorIndex);
    if (varMatch) {
      const obj = builderTarget ? getObjectByPanelKey(builderTarget.panelKey) : null;
      const trapVars = obj?.trap?.variables || [];
      setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
      setVarInsertContext({
        panelKey: '__flow__',
        field: fieldKey,
        value,
        replaceStart: varMatch.replaceStart,
        replaceEnd: varMatch.replaceEnd,
      });
      setVarModalMode('insert');
      setVarModalOpen(true);
      setVarModalToken(varMatch.token);
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
    const match = getVarInsertMatch(value, cursorIndex);
    if (!match) {
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
      return;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    setVarModalToken(match.token);
    setVarModalVars(Array.isArray(obj?.trap?.variables) ? obj.trap.variables : []);
    setVarModalMode('insert');
    setVarInsertContext({
      panelKey: builderTarget.panelKey,
      field: 'builderLiteral',
      value,
      replaceStart: match.replaceStart,
      replaceEnd: match.replaceEnd,
    });
    setVarModalOpen(true);
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
    const match = getVarInsertMatch(value, cursorIndex);
    if (match) {
      setVarModalToken(match.token);
      setVarModalVars(Array.isArray(obj?.trap?.variables) ? obj.trap.variables : []);
      setVarModalMode('insert');
      setVarInsertContext({
        panelKey,
        field,
        value,
        replaceStart: match.replaceStart,
        replaceEnd: match.replaceEnd,
      });
      setVarModalOpen(true);
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
      const entry = overrides.find((item: any) => (
        item?.['@objectName'] === objectName && item?.method === method && item?.scope === scope
      ));
      return Array.isArray(entry?.processors) ? entry.processors : [];
    })();
    const targetPath = `$.event.${field}`;
    const existingProcessor = overrideProcessors.find((proc: any) => getProcessorTargetField(proc) === targetPath);
    const draftValue = panelDrafts?.[panelKey]?.event?.[field];
    const evalSource = existingProcessor?.set?.source;
    const evalTextFromOverride = typeof evalSource === 'object' && typeof evalSource.eval === 'string'
      ? evalSource.eval
      : null;
    const evalValue = getEffectiveEventValue(obj, field);
    const evalTextFromValue = typeof evalValue === 'object' && typeof evalValue.eval === 'string'
      ? evalValue.eval
      : typeof evalValue === 'string'
        ? evalValue.trim()
        : '';
    const evalEnabled = isEvalMode(panelKey, field) || Boolean(evalTextFromOverride)
      || (typeof evalValue === 'object' && typeof evalValue.eval === 'string');
    const evalText = evalEnabled
      ? (typeof draftValue === 'string' && draftValue.trim() ? draftValue.trim() : (evalTextFromOverride || evalTextFromValue))
      : '';

    setBuilderTarget({ panelKey, field });
    setBuilderOpen(true);
    setShowProcessorJson(true);
    if (evalEnabled && evalText) {
      const parsed = parseEvalToRows(evalText);
      setBuilderFocus('eval');
      setBuilderTypeLocked('eval');
      if (parsed) {
        setBuilderMode('friendly');
        setBuilderConditions(parsed.rows);
        setBuilderElseResult(parsed.elseResult);
      } else {
        setBuilderMode('regular');
      }
      setBuilderRegularText(evalText);
      return;
    }
    if (existingProcessor?.regex) {
      setBuilderFocus('processor');
      setBuilderTypeLocked('processor');
      setProcessorType('regex');
      setProcessorStep('configure');
      setBuilderProcessorConfig({
        sourceType: existingProcessor.regex?.source?.startsWith('$.') ? 'path' : 'literal',
        source: String(existingProcessor.regex?.source ?? ''),
        pattern: String(existingProcessor.regex?.pattern ?? ''),
        group: existingProcessor.regex?.group ? String(existingProcessor.regex?.group) : '',
        targetField: existingProcessor.regex?.targetField ?? targetPath,
      });
      return;
    }
    if (existingProcessor?.set) {
      setBuilderFocus('processor');
      setBuilderTypeLocked('processor');
      setProcessorType('set');
      setProcessorStep('configure');
      setBuilderProcessorConfig({
        sourceType: existingProcessor.set?.source?.startsWith('$.') ? 'path' : 'literal',
        source: String(existingProcessor.set?.source ?? ''),
        pattern: '',
        argsText: Array.isArray(existingProcessor.set?.args)
          ? JSON.stringify(existingProcessor.set?.args, null, 2)
          : '',
        targetField: existingProcessor.set?.targetField ?? targetPath,
      });
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

  const isBuilderTargetReady = builderTarget && panelEditState[builderTarget.panelKey];
  const isFieldLockedByBuilder = (panelKey: string, field: string) => (
    Boolean(builderTarget
      && panelEditState[builderTarget.panelKey]
      && builderTarget.panelKey === panelKey
      && builderTarget.field !== field)
  );
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
    const eligible = !isEval
      && (typeof original === 'string' || typeof original === 'number' || original == null);
    return { eligible, value: String(display ?? '') };
  };

  const hasBuilderUnsavedChanges = () => {
    if (!builderTarget) {
      return false;
    }
    const obj = getObjectByPanelKey(builderTarget.panelKey);
    if (!obj) {
      return false;
    }
    if (builderFocus === 'literal') {
      return getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field) !== builderLiteralText;
    }
    if (builderFocus === 'eval') {
      const currentValue = getCurrentFieldValue(obj, builderTarget.panelKey, builderTarget.field);
      const candidate = builderMode === 'regular'
        ? builderRegularText.trim()
        : friendlyPreview.trim();
      if (!candidate) {
        return false;
      }
      return String(currentValue).trim() !== candidate;
    }
    if (builderFocus === 'processor') {
      if (processorType) {
        return true;
      }
      return Boolean(
        builderProcessorConfig.source
        || builderProcessorConfig.pattern
        || builderProcessorConfig.targetField,
      );
    }
    return false;
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
      setBuilderMode('regular');
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

  const getObjectByName = (objectName?: string | null) => {
    if (!objectName) {
      return null;
    }
    return getFriendlyObjects(fileData).find((item: any) => item?.['@objectName'] === objectName) || null;
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

  const getBuilderProcessorConfig = () => {
    const targetField = normalizeTargetField(builderProcessorConfig.targetField || '', builderTarget?.field);
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

  type ProcessorCatalogItem = {
    id: string;
    label: string;
    nodeKind: 'processor' | 'if';
    status: 'working' | 'testing' | 'planned';
    paletteLabel?: string;
    builderEnabled: boolean;
    helpKey: keyof typeof processorHelp;
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

  const flowPalette: Array<{
    label: string;
    nodeKind: 'processor' | 'if';
    processorType?: string;
    status: 'working' | 'testing' | 'planned';
  }> = processorCatalog.map((item) => ({
    label: item.paletteLabel || item.label,
    nodeKind: item.nodeKind,
    processorType: item.nodeKind === 'processor' ? item.id : undefined,
    status: item.status,
  }));
  const paletteSearch = advancedProcessorSearch.trim().toLowerCase();
  const filteredFlowPalette = flowPalette.filter((item) => (
    item.label.toLowerCase().includes(paletteSearch)
  ));
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
    return node.then.some((child) => nodeMatchesFocusTarget(child, target))
      || node.else.some((child) => nodeMatchesFocusTarget(child, target));
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
    const payloadRaw = event.dataTransfer.getData('application/json')
      || event.dataTransfer.getData('text/plain');
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
  ) => (
    <div
      className={`flow-lane${advancedFlowFocusTarget ? ' flow-lane-focused' : ''}`}
      onDragOver={handleFlowDragOver}
      onDrop={(event) => handleFlowDrop(event, path, setNodes, scope, lane)}
    >
      {nodes.length === 0 && (
        <div className="flow-empty">Drop processors here</div>
      )}
      {nodes.map((node) => {
        const isFocused = nodeMatchesFocusTarget(node, advancedFlowFocusTarget);
        return (
        <div
          key={node.id}
          className={`${node.kind === 'if' ? 'flow-node flow-node-if' : 'flow-node'}${nodeErrorsMap?.[node.id]?.length ? ' flow-node-error' : ''}${isFocused ? ' flow-node-focused' : ''}`}
          draggable
          onDragStart={(event) => {
            const payload = JSON.stringify({
              source: 'flow',
              nodeId: node.id,
            });
            event.dataTransfer.setData('application/json', payload);
            event.dataTransfer.setData('text/plain', payload);
          }}
        >
          <div className="flow-node-header">
            <div className="flow-node-title">{getFlowNodeLabel(node)}</div>
            <div className="flow-node-actions">
              {isFocused && (
                <span className="flow-node-focus-badge">Focused</span>
              )}
              {nodeErrorsMap?.[node.id]?.length ? (
                <span className="flow-node-error-badge" title={nodeErrorsMap[node.id].join(' ')}>
                  {nodeErrorsMap[node.id].length}
                </span>
              ) : null}
              <button
                type="button"
                className="flow-node-edit"
                onClick={() => openFlowEditor(node.id, scope, lane, nodes, setNodes)}
              >
                Edit
              </button>
              <button
                type="button"
                className="flow-node-remove"
                onClick={() => setNodes((prev) => removeNodeById(prev, node.id).nodes)}
              >
                Remove
              </button>
            </div>
          </div>
          {node.kind === 'if' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Then</div>
                {renderFlowList(
                  node.then,
                  { kind: 'if', id: node.id, branch: 'then' },
                  setNodes,
                  scope,
                  lane,
                  nodeErrorsMap,
                )}
              </div>
              <div className="flow-branch">
                <div className="flow-branch-title">Else</div>
                {renderFlowList(
                  node.else,
                  { kind: 'if', id: node.id, branch: 'else' },
                  setNodes,
                  scope,
                  lane,
                  nodeErrorsMap,
                )}
              </div>
            </div>
          )}
          {node.kind === 'processor' && node.processorType === 'foreach' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Per-item processors</div>
                {renderFlowList(
                  Array.isArray(node.config?.processors)
                    ? node.config.processors
                    : [],
                  { kind: 'foreach', id: node.id, branch: 'processors' },
                  setNodes,
                  scope,
                  lane,
                  nodeErrorsMap,
                )}
              </div>
            </div>
          )}
          {node.kind === 'processor' && node.processorType === 'switch' && (
            <div className="flow-branches">
              <div className="flow-branch">
                <div className="flow-branch-title">Cases</div>
                {(Array.isArray(node.config?.cases) ? node.config.cases : []).map((item: any) => (
                  <div key={item.id} className="flow-branch flow-branch-nested">
                    <div className="flow-branch-title">Case</div>
                    {renderFlowList(
                      Array.isArray(item.processors) ? item.processors : [],
                      { kind: 'switch', id: node.id, branch: 'case', caseId: item.id },
                      setNodes,
                      scope,
                      lane,
                      nodeErrorsMap,
                    )}
                  </div>
                ))}
              </div>
              <div className="flow-branch">
                <div className="flow-branch-title">Default</div>
                {renderFlowList(
                  Array.isArray(node.config?.defaultProcessors)
                    ? node.config.defaultProcessors
                    : [],
                  { kind: 'switch', id: node.id, branch: 'default' },
                  setNodes,
                  scope,
                  lane,
                  nodeErrorsMap,
                )}
              </div>
            </div>
          )}
        </div>
      );
      })}
      <div className="flow-drop-gap" aria-hidden="true" />
    </div>
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
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return;
    }
    const existingOverrides = Array.isArray(overrideInfo?.overrides) ? [...overrideInfo.overrides] : [];
    const method = overrideInfo?.method || (String(selectedFile.PathID || '').includes('/syslog/') ? 'syslog' : 'trap');
    const scope = 'post';
    const matchIndex = baseOverrides.findIndex((entry: any) => (
      entry?.['@objectName'] === objectName && entry?.method === method && entry?.scope === scope
    ));
    const overrideEntry = matchIndex >= 0
      ? { ...baseOverrides[matchIndex] }
      : {
        name: `${objectName} Override`,
        description: `Overrides for ${objectName}`,
        domain: 'fault',
        method,
        scope,
        '@objectName': objectName,
        _type: 'override',
        processors: [],
      };
    const processors = Array.isArray(overrideEntry.processors) ? [...overrideEntry.processors] : [];
    const processorKey = Object.keys(processor)[0];
    const targetField = getProcessorTargetField(processor);
    const existingIdx = processors.findIndex((proc: any) => (
      Object.keys(proc || {})[0] === processorKey && getProcessorTargetField(proc) === targetField
    ));
    if (existingIdx >= 0) {
      const existingProcessor = processors[existingIdx];
      if (JSON.stringify(existingProcessor) === JSON.stringify(processor)) {
        closeBuilder();
        return;
      }
      processors[existingIdx] = processor;
    } else {
      processors.push(processor);
    }
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
      example: '{"append": {"source": "Example Value", "array": [], "targetField": "$.event.NewArray"}}',
    },
    appendToOutputStream: {
      title: 'Append to Output Stream',
      description: 'Append data to a configured output stream (planned).',
      example: '{"appendToOutputStream": {"source": "$.trap", "output": "pulsar+ssl:///assure1/event/sink"}}',
    },
    break: {
      title: 'Break',
      description: 'Stop processing the current processor chain (planned).',
      example: '{"break": {}}',
    },
    convert: {
      title: 'Convert',
      description: 'Convert a value from one type/format to another (planned).',
      example: '{"convert": {"source": "$.event.Count", "type": "inttostring", "targetField": "$.event.CountString", "ignoreFailure": true}}',
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
      example: '{"foreach": {"source": "$.event.Details.trap.variables", "keyVal": "i", "valField": "v", "processors": []}}',
    },
    grok: {
      title: 'Grok',
      description: 'Parse text using Grok patterns and store extracted values (planned).',
      example: '{"grok": {"source": "$.syslog.datagram", "pattern": "%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}", "targetField": "$.syslog.variables"}}',
    },
    if: {
      title: 'If',
      description: 'Conditionally run processors based on a single condition (planned).',
      example: '{"if": {"source": "$.event.EventCategory", "operator": "==", "value": 3, "processors": [], "else": []}}',
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
      example: '{"lookup": {"source": "db", "properties": {}, "fallback": {}, "targetField": "$.localmem.results"}}',
    },
    math: {
      title: 'Math',
      description: 'Apply arithmetic to a numeric source and store the result (planned).',
      example: '{"math": {"source": "$.event.Count", "operation": "*", "value": 2, "targetField": "$.localmem.CountTimesTwo"}}',
    },
    regex: {
      title: 'Regex',
      description: 'Extract a value from text using a regular expression capture group and store it in a target field.',
      example: '{"regex": {"source": "Events are cleared", "pattern": "Events are (?<text>.*$)", "targetField": ""}}',
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
      example: '{"replace": {"source": "This is a test", "pattern": "a test", "replacement": "not a test", "targetField": "$.localmem.example"}}',
    },
    set: {
      title: 'Set',
      description: 'Set a target field to a literal value or another field path. Useful for overrides or copying values.',
      example: '{"set": {"source": "$.event.%s", "args": ["Details"], "targetField": "$.event.Details2"}}',
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
      example: '{"split": {"source": "1,2,3,4", "delimiter": ",", "targetField": "$.localmem.splitarr"}}',
    },
    strcase: {
      title: 'String Case',
      description: 'Change the case of a string (planned).',
      example: '{"strcase": {"source": "HELLO, WORLD", "type": "lower", "targetField": "$.localmem.lowercase"}}',
    },
    substr: {
      title: 'Substring',
      description: 'Extract a substring from a source value (planned).',
      example: '{"substr": {"source": "Hello", "start": 1, "targetField": "$.localmem.substr"}}',
    },
    switch: {
      title: 'Switch',
      description: 'Branch processors based on matching cases (planned).',
      example: '{"switch": {"source": "$.localmem.val1", "operator": "!=", "case": [{"match": 2, "then": [{"discard": {}}]}, {"match": 5, "operator": "==", "then": [{"discard": {}}]}], "default": [{"log": {"type": "info", "source": "Do nothing since none of the cases were met"}}]}}',
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
      return pre !== (advancedFlowBaseline.pre || '')
        || post !== (advancedFlowBaseline.post || '');
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
        ...collectFocusMatches(prePayloads, advancedFlowFocusTarget, 'pre'),
        ...collectFocusMatches(postPayloads, advancedFlowFocusTarget, 'post'),
      ];
    }
    const objectPayloads = buildFlowProcessors(advancedFlow);
    return collectFocusMatches(objectPayloads, advancedFlowFocusTarget, 'object');
  }, [advancedFlowFocusTarget, advancedProcessorScope, advancedFlow, globalPreFlow, globalPostFlow]);

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

  const flowErrorCount = Object.keys(flowValidation.pre).length
    + Object.keys(flowValidation.post).length
    + Object.keys(flowValidation.object).length;

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
  const getStagedDirtyFields = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return [] as string[];
    }
    return Array.from(stagedFieldChangeMap.get(objectName)?.keys() || []);
  };
  const getStagedFieldChange = (obj: any, field: string) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return undefined;
    }
    return stagedFieldChangeMap.get(objectName)?.get(field);
  };
  const isFieldStagedDirty = (obj: any, field: string) => Boolean(getStagedFieldChange(obj, field));
  const isFieldStagedRemoved = (obj: any, field: string) => getStagedFieldChange(obj, field) === 'removed';
  const formatDiffValue = (value: any) => (
    value === undefined ? '' : JSON.stringify(value, null, 2)
  );

  const diffLines = (beforeText: string, afterText: string) => {
    const beforeLines = beforeText === '' ? [] : beforeText.split('\n');
    const afterLines = afterText === '' ? [] : afterText.split('\n');
    const beforeCount = beforeLines.length;
    const afterCount = afterLines.length;
    const dp: number[][] = Array.from({ length: beforeCount + 1 }, () => (
      Array(afterCount + 1).fill(0)
    ));

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

  const renderInlineDiff = (beforeValue: any, afterValue: any, mode: 'after' | 'original') => {
    const beforeText = formatDiffValue(beforeValue);
    const afterText = formatDiffValue(afterValue);
    const lines = diffLines(beforeText, afterText);
    const filtered = lines.filter((line) => (
      mode === 'after' ? line.type !== 'remove' : line.type !== 'add'
    ));
    return filtered.map((line, idx) => {
      const prefix = mode === 'after'
        ? (line.type === 'add' ? '+' : ' ')
        : (line.type === 'remove' ? '-' : ' ');
      return (
        <span
          key={`${mode}-${idx}-${line.type}`}
          className={`diff-line diff-line-${line.type}`}
        >
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

  const openAdvancedFlowModal = (
    scope: 'object' | 'global',
    objectNameOverride?: string,
    focusTargetField?: string | null,
  ) => {
    if (!hasEditPermission) {
      return;
    }
    const method = getOverrideMethod();
    if (scope === 'global') {
      const preEntry = getOverrideEntry({ scope: 'pre', method });
      const postEntry = getOverrideEntry({ scope: 'post', method });
      const preProcessors = Array.isArray(preEntry?.processors) ? preEntry.processors : [];
      const postProcessors = Array.isArray(postEntry?.processors) ? postEntry.processors : [];
      setGlobalPreFlow(buildFlowNodesFromProcessors(preProcessors));
      setGlobalPostFlow(buildFlowNodesFromProcessors(postProcessors));
      setAdvancedFlowBaseline({
        scope: 'global',
        pre: JSON.stringify(preProcessors),
        post: JSON.stringify(postProcessors),
      });
      setAdvancedFlowTarget({ scope: 'global', method });
      setAdvancedProcessorScope('global');
      setAdvancedFlowFocusTarget(focusTargetField || null);
      setAdvancedFlowFocusIndex(0);
      setAdvancedFlowFocusOnly(false);
      setAdvancedFlowDefaultTarget(focusTargetField || null);
      setShowAdvancedProcessorModal(true);
      return;
    }
    const objectName = objectNameOverride || (() => {
      if (!builderTarget) {
        return null;
      }
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      return obj?.['@objectName'] || null;
    })();
    if (!objectName) {
      return;
    }
    const entry = getOverrideEntry({ objectName, scope: 'post', method });
    const processors = Array.isArray(entry?.processors) ? entry.processors : [];
    setAdvancedFlow(buildFlowNodesFromProcessors(processors));
    setAdvancedFlowBaseline({
      scope: 'object',
      objectName,
      object: JSON.stringify(processors),
    });
    setAdvancedFlowTarget({ scope: 'object', objectName, method });
    setAdvancedProcessorScope('object');
    setAdvancedFlowFocusTarget(focusTargetField || null);
    setAdvancedFlowFocusIndex(0);
    setAdvancedFlowFocusOnly(false);
    setAdvancedFlowDefaultTarget(focusTargetField || null);
    setShowAdvancedProcessorModal(true);
  };

  const saveAdvancedFlow = () => {
    if (!selectedFile || !advancedFlowTarget) {
      return;
    }
    if (!ensureEditPermission()) {
      return;
    }
    const method = advancedFlowTarget.method || getOverrideMethod();
    const existingOverrides = getOverrideEntries().slice();
    const baseOverrides = pendingOverrideSave
      ? [...pendingOverrideSave]
      : existingOverrides;
    const beforeOverrides = JSON.parse(JSON.stringify(baseOverrides));
    if (advancedFlowTarget.scope === 'global') {
      const preProcessors = buildFlowProcessors(globalPreFlow);
      const postProcessors = buildFlowProcessors(globalPostFlow);
      const updateEntry = (scope: 'pre' | 'post', processors: any[]) => {
        const matchIndex = baseOverrides.findIndex((entry: any) => (
          entry?.scope === scope
          && entry?.method === method
          && !entry?.['@objectName']
        ));
        if (processors.length === 0) {
          if (matchIndex >= 0) {
            baseOverrides.splice(matchIndex, 1);
          }
          return;
        }
        const nextEntry = matchIndex >= 0
          ? { ...baseOverrides[matchIndex] }
          : {
            name: `Global ${scope} Override`,
            description: `Global ${scope} processors`,
            domain: 'fault',
            method,
            scope,
            _type: 'override',
            processors: [],
          };
        nextEntry.processors = processors;
        if (matchIndex >= 0) {
          baseOverrides[matchIndex] = nextEntry;
        } else {
          baseOverrides.push(nextEntry);
        }
      };
      updateEntry('pre', preProcessors);
      updateEntry('post', postProcessors);
      setAdvancedFlowBaseline({
        scope: 'global',
        pre: JSON.stringify(preProcessors),
        post: JSON.stringify(postProcessors),
      });
    } else {
      const objectName = advancedFlowTarget.objectName;
      if (!objectName) {
        return;
      }
      const processors = buildFlowProcessors(advancedFlow);
      const matchIndex = baseOverrides.findIndex((entry: any) => (
        entry?.['@objectName'] === objectName
        && entry?.method === method
        && entry?.scope === 'post'
      ));
      if (processors.length === 0) {
        if (matchIndex >= 0) {
          baseOverrides.splice(matchIndex, 1);
        }
      } else {
        const overrideEntry = matchIndex >= 0
          ? { ...baseOverrides[matchIndex] }
          : {
            name: `${objectName} Override`,
            description: `Overrides for ${objectName}`,
            domain: 'fault',
            method,
            scope: 'post',
            '@objectName': objectName,
            _type: 'override',
            processors: [],
          };
        overrideEntry.processors = processors;
        if (matchIndex >= 0) {
          baseOverrides[matchIndex] = overrideEntry;
        } else {
          baseOverrides.push(overrideEntry);
        }
      }
      setAdvancedFlowBaseline({
        scope: 'object',
        objectName,
        object: JSON.stringify(processors),
      });
    }
    setPendingOverrideSave(baseOverrides);
    if (removeAllOverridesModal.open
      && removeAllOverridesModal.panelKey
      && removeAllOverridesModal.objectName) {
      const modalObj = getObjectByName(removeAllOverridesModal.objectName);
      if (modalObj) {
        window.setTimeout(() => {
          openRemoveAllOverridesModal(modalObj, removeAllOverridesModal.panelKey as string);
        }, 0);
      }
    }
    const diff = diffOverrides(beforeOverrides, baseOverrides);
    if (diff.totalChanges > 0) {
      if (advancedFlowTarget.scope === 'global') {
        triggerToast(`Staged ${diff.totalChanges} global advanced flow change(s)`, true);
      } else {
        const targetLabel = advancedFlowTarget.objectName || 'Object';
        triggerToast(`Staged ${diff.totalChanges} advanced flow change(s) for ${targetLabel}`, true);
      }
    }
    setShowAdvancedProcessorModal(false);
    setAdvancedFlowDefaultTarget(null);
  };

  const handleBuilderSelect = (item: ProcessorCatalogItem, isEnabled: boolean) => {
    if (!isEnabled) {
      return;
    }
    if (item.id === 'if') {
      if (!builderTarget) {
        return;
      }
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      const objectName = obj?.['@objectName'];
      if (!objectName) {
        return;
      }
      const method = getOverrideMethod();
      const entry = getOverrideEntry({ objectName, scope: 'post', method });
      const processors = Array.isArray(entry?.processors) ? entry.processors : [];
      setAdvancedFlow(buildFlowNodesFromProcessors(processors));
      setAdvancedFlowBaseline({
        scope: 'object',
        objectName,
        object: JSON.stringify(processors),
      });
      setAdvancedFlowTarget({ scope: 'object', objectName, method });
      setAdvancedProcessorScope('object');
      setShowAdvancedProcessorModal(true);
      return;
    }
    if (item.id === 'set') {
      setProcessorType('set');
      setProcessorStep('configure');
      setBuilderProcessorConfig((prev) => ({
        ...prev,
        ...getDefaultProcessorConfig(
          'set',
          builderTarget ? `$.event.${builderTarget.field}` : prev.targetField,
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
          builderTarget ? `$.event.${builderTarget.field}` : prev.targetField,
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
        builderTarget ? `$.event.${builderTarget.field}` : prev.targetField,
      ),
      ...(item.id === 'foreach'
        ? { processors: [] }
        : {}),
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
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? {
          ...row,
          condition: updateConditionNode(row.condition, nodeId, (current) => (
            current.type === 'condition'
              ? { ...current, [key]: value }
              : current
          )),
        }
        : row
    )));
  };

  const updateConditionGroupOperator = (rowId: string, nodeId: string, operator: 'AND' | 'OR') => {
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? {
          ...row,
          condition: updateConditionNode(row.condition, nodeId, (current) => (
            current.type === 'group' ? { ...current, operator } : current
          )),
        }
        : row
    )));
  };

  const addConditionChild = (rowId: string, nodeId: string, type: 'condition' | 'group') => {
    const newChild = type === 'group' ? createGroupNode() : createConditionNode();
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? {
          ...row,
          condition: updateConditionNode(row.condition, nodeId, (current) => (
            current.type === 'group'
              ? { ...current, children: [...current.children, newChild] }
              : current
          )),
        }
        : row
    )));
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
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId
        ? { ...row, condition: removeNode(row.condition) as ConditionTree }
        : row
    )));
  };

  const updateBuilderResult = (rowId: string, value: string) => {
    setBuilderConditions((prev) => prev.map((row) => (
      row.id === rowId ? { ...row, result: value } : row
    )));
  };

  const addBuilderRow = () => {
    setBuilderConditions((prev) => ([
      ...prev,
      { id: nextBuilderId(), condition: createConditionNode(), result: '' },
    ]));
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
    const parts = node.children
      .map((child) => buildConditionExpression(child))
      .filter(Boolean);
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
        <div className={`builder-condition-line${isNested ? ' builder-condition-line-nested' : ''}`}>
          <input
            className="builder-input"
            value={node.left}
            onChange={(e) => updateBuilderCondition(rowId, node.id, 'left', e.target.value)}
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
            onChange={(e) => updateBuilderCondition(rowId, node.id, 'right', e.target.value)}
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
              className={node.operator === 'AND'
                ? 'builder-mode-button builder-mode-button-active'
                : 'builder-mode-button'}
              onClick={() => updateConditionGroupOperator(rowId, node.id, 'AND')}
              disabled={!isBuilderTargetReady}
            >
              AND
            </button>
            <button
              type="button"
              className={node.operator === 'OR'
                ? 'builder-mode-button builder-mode-button-active'
                : 'builder-mode-button'}
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

  const enableEvalForTarget = () => {
    if (!builderTarget || !panelEditState[builderTarget.panelKey]) {
      return;
    }
    setEvalModeForField(builderTarget.panelKey, builderTarget.field, true);
  };

  const renderVarToken = (token: string, trapVars?: any[]) => {
    const index = Number(token.replace('$v', '')) - 1;
    const variable = Array.isArray(trapVars) ? trapVars[index] : null;
    const description = Array.isArray(variable?.description)
      ? variable.description.filter(Boolean).join(' ')
      : renderValue(variable?.description);
    return (
      <span className="override-summary var-token-wrap" tabIndex={0}>
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

  const renderSummary = (value: any, trapVars: any[], options?: { suppressEvalTooltip?: boolean }) => {
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
          return (
            <span key={`var-${index}`}>
              {renderVarToken(part, trapVars)}
            </span>
          );
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
          return (
            <span key={`line-var-${index}`}>
              {renderVarToken(part, trapVars)}
            </span>
          );
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
    objects.forEach((obj: any, idx: number) => {
      try {
        const text = JSON.stringify(obj).toLowerCase();
        if (text.includes(query)) {
          const key = getObjectKey(obj, idx);
          matches.push(key);
          options.push({
            key,
            label: obj?.['@objectName'] || `Object ${idx + 1}`,
          });
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
    objects.forEach((obj: any, idx: number) => {
      if (!getOverrideFlags(obj).any) {
        return;
      }
      const key = getObjectKey(obj, idx);
      keys.push(key);
      options.push({
        key,
        label: obj?.['@objectName'] || `Object ${idx + 1}`,
      });
    });
    setOverrideObjectKeys(keys);
    setOverrideObjectOptions(options);
    setOverrideMatchIndex((prev) => (
      keys.length === 0 ? 0 : Math.min(prev, keys.length - 1)
    ));
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
      if (lastLoadPingRef.current.fileId === currentFileId
        && lastLoadPingRef.current.key === key
        && lastLoadPingRef.current.mode === 'match') {
        return;
      }
      lastLoadPingRef.current = { fileId: currentFileId, key, mode: 'match' };
      startMatchPingSequence(key, 3);
      return;
    }
    if (highlightFileName) {
      if (lastLoadPingRef.current.fileId === currentFileId
        && lastLoadPingRef.current.mode === 'file') {
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
    if (typeof saved.index === 'number' && saved.index < highlightObjectKeys.length && saved.index !== currentMatchIndex) {
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
      <button
        type="button"
        className="builder-link"
        onClick={() => {
          setVarModalToken(null);
          setVarModalVars(variables);
          setVarModalMode('view');
          setVarInsertContext(null);
          setVarModalOpen(true);
        }}
      >
        {count} available variable{count === 1 ? '' : 's'}
      </button>
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
    setCurrentMatchIndex((prev) => (prev - 1 + highlightObjectKeys.length) % highlightObjectKeys.length);
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

  const normalizeEvalText = (value: string) => (
    value
      .replace(/\s+/g, ' ')
      .replace(/&&/g, ' AND ')
      .replace(/\|\|/g, ' OR ')
      .replace(/==/g, ' = ')
      .replace(/!=/g, ' ≠ ')
      .replace(/>=/g, ' ≥ ')
      .replace(/<=/g, ' ≤ ')
      .replace(/\s+/g, ' ')
      .trim()
  );

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
        lines.push(isFirst ? `Set to ${normalizeEvalText(expr)}` : `Else set to ${normalizeEvalText(expr)}`);
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
            onMouseEnter={() => {
              setSuppressVarTooltip(true);
              setSuppressEvalTooltip(false);
            }}
            onMouseLeave={() => {
              setSuppressVarTooltip(false);
              setSuppressEvalTooltip(false);
            }}
            onFocus={() => {
              setSuppressVarTooltip(true);
              setSuppressEvalTooltip(false);
            }}
            onBlur={() => {
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
  const literalMeta = getLiteralEligibility();
  const literalDirty = builderTarget
    ? (() => {
      const obj = getObjectByPanelKey(builderTarget.panelKey);
      if (!obj) {
        return false;
      }
      return getCurrentFieldValue(
        obj,
        builderTarget.panelKey,
        builderTarget.field,
      ) !== builderLiteralText;
    })()
    : false;
  const builderDirty = hasBuilderUnsavedChanges();
  const processorPayload = buildProcessorPayload();
  const builderTrapVars = builderTarget
    ? (getObjectByPanelKey(builderTarget.panelKey)?.trap?.variables || [])
    : [];
  const flowEditorLane = flowEditor?.lane || 'object';
  const flowEditorValidation = flowEditorDraft?.kind === 'processor'
    ? validateProcessorConfig(flowEditorDraft.processorType, flowEditorDraft.config || {}, flowEditorLane)
    : flowEditorDraft?.kind === 'if'
      ? {
        fieldErrors: {},
        nodeErrors: validateFlowNodes([flowEditorDraft], flowEditorLane)[flowEditorDraft.id] || [],
      }
      : { fieldErrors: {}, nodeErrors: [] };
  const flowEditorFieldErrors = flowEditorValidation.fieldErrors;
  const flowEditorNodeErrors = flowEditorValidation.nodeErrors;
  const flowEditorHasErrors = flowEditorNodeErrors.length > 0
    || Object.keys(flowEditorFieldErrors).length > 0;
  const focusedFlowJson = focusedFlowMatch
    ? JSON.stringify(focusedFlowMatch.processor, null, 2)
    : '';
  const focusedLaneLabel = focusedFlowMatch
    ? (focusedFlowMatch.lane === 'pre'
      ? 'Pre'
      : focusedFlowMatch.lane === 'post'
        ? 'Post'
        : 'Object')
    : '';
  const formatFlowTargetLabel = (target: string) => (
    target.startsWith('$.event.') ? target.replace('$.event.', '') : target
  );
  const advancedFlowRemovedTargets = useMemo(() => {
    if (!advancedFlowTarget) {
      return [] as string[];
    }
    const removed = new Set<string>();
    stagedDiff.sections.forEach((section) => {
      if (advancedProcessorScope === 'global') {
        if (section.objectName) {
          return;
        }
      } else if (section.objectName !== advancedFlowTarget.objectName) {
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
  const renderFlowJsonPreview = (fullJson: string) => (
    <div className="flow-preview">
      <div className="flow-preview-title-row">
        <div className="flow-preview-title">JSON Preview</div>
        {advancedFlowFocusTarget && (
          <div className="flow-focus-actions">
            <button
              type="button"
              className="builder-link"
              onClick={() => setAdvancedFlowFocusOnly((prev) => !prev)}
              disabled={!focusedFlowMatch}
            >
              {advancedFlowFocusOnly ? 'Show full JSON' : 'Focus only'}
            </button>
            <button
              type="button"
              className="builder-link"
              onClick={() => {
                setAdvancedFlowFocusTarget(null);
                setAdvancedFlowFocusIndex(0);
                setAdvancedFlowFocusOnly(false);
              }}
            >
              Clear focus
            </button>
          </div>
        )}
      </div>
      {advancedFlowFocusTarget && (
        <div className="flow-focus-card">
          <div className="flow-focus-row">
            <div className="flow-focus-title">
              Focused target: <span className="monospace">{advancedFlowFocusTarget}</span>
            </div>
            <div className="flow-focus-count">
              {focusedFlowMatches.length > 0
                ? `Match ${advancedFlowFocusIndex + 1} of ${focusedFlowMatches.length} (${focusedLaneLabel})`
                : 'No matching processors found'}
            </div>
          </div>
          {focusedFlowMatches.length > 1 && (
            <div className="flow-focus-controls">
              <button
                type="button"
                className="builder-link"
                onClick={() => setAdvancedFlowFocusIndex((prev) => (
                  prev <= 0 ? focusedFlowMatches.length - 1 : prev - 1
                ))}
              >
                Previous
              </button>
              <button
                type="button"
                className="builder-link"
                onClick={() => setAdvancedFlowFocusIndex((prev) => (
                  prev >= focusedFlowMatches.length - 1 ? 0 : prev + 1
                ))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
      {advancedFlowFocusOnly && focusedFlowMatch
        ? renderJsonWithFocus(focusedFlowJson, focusedFlowJson)
        : renderJsonWithFocus(fullJson, focusedFlowJson)}
    </div>
  );
  const getFieldChangeLabel = (change: { before?: any; after?: any; action: string; origin?: 'event' | 'processor' }) => {
    const label = change.origin === 'processor' ? 'Processor' : 'Field';
    if (change.action === 'updated') {
      return `${label} updated`;
    }
    if (change.action === 'added') {
      return `${label} added`;
    }
    return `${label} removed`;
  };

  const builderSidebar = (
    <FcomBuilderSidebar
      isAnyPanelEditing={isAnyPanelEditing}
      builderOpen={builderOpen}
      builderTarget={builderTarget}
      builderDirty={builderDirty}
      canUndoBuilder={canUndoBuilder}
      canRedoBuilder={canRedoBuilder}
      handleBuilderUndo={handleBuilderUndo}
      handleBuilderRedo={handleBuilderRedo}
      setShowBuilderHelpModal={setShowBuilderHelpModal}
      requestCancelBuilder={requestCancelBuilder}
      setBuilderOpen={setBuilderOpen}
      builderFocus={builderFocus}
      isBuilderTargetReady={isBuilderTargetReady}
      builderTypeLocked={builderTypeLocked}
      setBuilderSwitchModal={setBuilderSwitchModal}
      applyBuilderTypeSwitch={applyBuilderTypeSwitch}
      builderLiteralText={builderLiteralText}
      handleLiteralInputChange={handleLiteralInputChange}
      literalDirty={literalDirty}
      applyLiteralValue={applyLiteralValue}
      builderMode={builderMode}
      setBuilderMode={setBuilderMode}
      hasEditPermission={hasEditPermission}
      setAdvancedProcessorScope={setAdvancedProcessorScope}
      setShowAdvancedProcessorModal={setShowAdvancedProcessorModal}
      builderConditions={builderConditions}
      setBuilderConditions={setBuilderConditions}
      updateBuilderCondition={updateBuilderCondition}
      updateBuilderResult={updateBuilderResult}
      removeBuilderRow={removeBuilderRow}
      addBuilderRow={addBuilderRow}
      createConditionNode={createConditionNode}
      createGroupNode={createGroupNode}
      nextBuilderId={nextBuilderId}
      renderConditionNode={renderConditionNode}
      builderElseResult={builderElseResult}
      setBuilderElseResult={setBuilderElseResult}
      friendlyPreview={friendlyPreview}
      applyFriendlyEval={applyFriendlyEval}
      formatEvalReadableList={formatEvalReadableList}
      builderRegularText={builderRegularText}
      handleRegularEvalInputChange={handleRegularEvalInputChange}
      clearRegularEval={clearRegularEval}
      applyRegularEval={applyRegularEval}
      applyBuilderTemplate={applyBuilderTemplate}
      openAdvancedFlowModal={openAdvancedFlowModal}
      processorStep={processorStep}
      setProcessorStep={setProcessorStep}
      processorType={processorType}
      processorPayload={processorPayload}
      processorCatalog={processorCatalog}
      handleBuilderSelect={handleBuilderSelect}
      builderProcessorConfig={builderProcessorConfig}
      setBuilderProcessorConfig={setBuilderProcessorConfig}
      builderNestedAddType={builderNestedAddType}
      setBuilderNestedAddType={setBuilderNestedAddType}
      builderPaletteItems={builderPaletteItems}
      builderSwitchCaseAddType={builderSwitchCaseAddType}
      setBuilderSwitchCaseAddType={setBuilderSwitchCaseAddType}
      builderSwitchDefaultAddType={builderSwitchDefaultAddType}
      setBuilderSwitchDefaultAddType={setBuilderSwitchDefaultAddType}
      createFlowNodeFromPaletteValue={createFlowNodeFromPaletteValue}
      renderProcessorHelp={renderProcessorHelp}
      renderProcessorConfigFields={renderProcessorConfigFields}
      renderFlowList={renderFlowList}
      getProcessorCatalogLabel={getProcessorCatalogLabel}
      getProcessorSummaryLines={getProcessorSummaryLines}
      showProcessorJson={showProcessorJson}
      setShowProcessorJson={setShowProcessorJson}
      applyProcessor={applyProcessor}
      nextSwitchCaseId={nextSwitchCaseId}
    />
  );

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <h1>COM Curation &amp; Management</h1>
          {isAuthenticated && (
            <AppTabs activeApp={activeApp} onChange={setActiveApp} />
          )}
          {isAuthenticated && (
            <div className="header-actions">
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
                <span className="logout-icon" aria-hidden="true">🚪</span>
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
            <FcomBrowserPanel
              hasEditPermission={hasEditPermission}
              setShowPathModal={setShowPathModal}
              breadcrumbs={breadcrumbs}
              handleCrumbClick={handleCrumbClick}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchScope={searchScope}
              setSearchScope={setSearchScope}
              handleSearchSubmit={handleSearchSubmit}
              searchLoading={searchLoading}
              handleClearSearch={handleClearSearch}
              handleResetNavigation={handleResetNavigation}
              favoritesFolders={favoritesFolders}
              favoritesFiles={favoritesFiles}
              favoritesLoading={favoritesLoading}
              favoritesError={favoritesError}
              handleOpenFolder={handleOpenFolder}
              openFileFromUrl={openFileFromUrl}
              handleOpenSearchResult={handleOpenSearchResult}
              getParentLabel={getParentLabel}
              getParentPath={getParentPath}
              searchResults={searchResults}
              searchError={searchError}
              getSearchResultName={getSearchResultName}
              browseError={browseError}
              browseLoading={browseLoading}
              entries={entries}
              isFolder={isFolder}
              handleOpenFile={handleOpenFile}
            />
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
                    hasLocalOverrides={hasLocalOverrides}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    openAdvancedFlowModal={openAdvancedFlowModal}
                    hasEditPermission={hasEditPermission}
                    showTestControls={isTrapFileContext}
                    onTestFile={handleTestCurrentFile}
                    fileTestLoading={selectedFile?.PathID
                      ? isFileTestLoading(selectedFile.PathID)
                      : false}
                    fileTestLabel={selectedFile?.PathID
                      ? getVendorFromPath(selectedFile.PathID)
                      : ''}
                    reviewCtaPulse={reviewCtaPulse}
                    setReviewStep={setReviewStep}
                    setShowReviewModal={setShowReviewModal}
                    hasStagedChanges={hasStagedChanges}
                    stagedDiff={stagedDiff}
                    hasGlobalAdvancedFlow={hasGlobalAdvancedFlow}
                    fileError={fileError}
                    saveError={saveError}
                    saveSuccess={saveSuccess}
                    stagedToast={stagedToast}
                    highlightQuery={highlightQuery}
                    highlightFileName={highlightFileName}
                    fileNamePingActive={fileNamePingActive}
                  />
                  <FcomFilePreview
                    selectedFile={selectedFile}
                    fileLoading={fileLoading}
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
                    getObjectKey={getObjectKey}
                    registerObjectRowRef={registerObjectRowRef}
                    getEventOverrideFields={getEventOverrideFields}
                    panelEditState={panelEditState}
                    getPanelDirtyFields={getPanelDirtyFields}
                    getBaseEventFields={getBaseEventFields}
                    hasEditPermission={hasEditPermission}
                      showTestControls={isTrapFileContext}
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
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal modal-wide">
                        {reviewStep === 'review' ? (
                          <>
                            <div className="staged-review-header">
                              <h3>Review staged changes</h3>
                              <div className="staged-review-actions">
                                <button
                                  type="button"
                                  className="builder-link"
                                  onClick={() => {
                                    const shouldExpand = Object.values(expandedOriginals).some(Boolean) === false;
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
                                            <div className="staged-section-title">{section.title}</div>
                                            <div className="staged-section-meta">
                                              <span>{fieldCount} field change{fieldCount === 1 ? '' : 's'}</span>
                                              <span>{processorCount} processor change{processorCount === 1 ? '' : 's'}</span>
                                            </div>
                                            <button
                                              type="button"
                                              className="builder-link"
                                              onClick={() => setStagedSectionOpen((prev) => ({
                                                ...prev,
                                                [sectionKey]: !isOpen,
                                              }))}
                                            >
                                              {isOpen ? 'Collapse' : 'Expand'}
                                            </button>
                                          </div>
                                          {!isOpen && (
                                            <div className="staged-section-summary">
                                              <div className="staged-summary-list">
                                                {section.fieldChanges.slice(0, 4).map((change) => (
                                                  <div key={`${sectionKey}-${change.target}-${change.action}`} className="staged-summary-item">
                                                    <span className={`pill change-pill change-pill-${change.action}`}>
                                                      {getFieldChangeLabel(change)}
                                                    </span>
                                                    <span className="staged-summary-label">{change.target}</span>
                                                  </div>
                                                ))}
                                                {section.processorChanges.slice(0, 2).map((change, idx) => (
                                                  <div key={`${sectionKey}-proc-${idx}-${change.action}`} className="staged-summary-item">
                                                    <span className={`pill change-pill change-pill-${change.action}`}>
                                                      {change.action}
                                                    </span>
                                                    <span className="staged-summary-label">
                                                      {getProcessorType(change.processor) || 'processor'}
                                                    </span>
                                                  </div>
                                                ))}
                                                {(fieldCount + processorCount) > 6 && (
                                                  <div className="staged-summary-more">
                                                    +{(fieldCount + processorCount) - 6} more
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          )}
                                          {isOpen && (
                                            <>
                                              {section.fieldChanges.length > 0 && (
                                                <div className="staged-group">
                                                  <div className="staged-group-title">Field changes</div>
                                                  {section.fieldChanges.map((change) => {
                                                    const changeKey = `${section.title}-${change.target}-${change.action}`;
                                                    const hasOverrideOriginal = change.before !== undefined;
                                                    const baseOriginal = getBaseObjectValue(section.objectName, change.target);
                                                    const originalValue = hasOverrideOriginal ? change.before : baseOriginal;
                                                    const hasOriginal = hasOverrideOriginal || baseOriginal !== undefined;
                                                    const isExpanded = Boolean(expandedOriginals[changeKey]);
                                                    const originalLabel = hasOverrideOriginal
                                                      ? 'Original (override)'
                                                      : 'Original (base value)';
                                                    return (
                                                      <div key={`${section.title}-${change.target}-${change.action}`} className="staged-change">
                                                        <div className="staged-change-header">
                                                          <span className="staged-change-label">{change.target}</span>
                                                          <span className={`pill change-pill change-pill-${change.action}`}>
                                                            {getFieldChangeLabel(change)}
                                                          </span>
                                                        </div>
                                                        <div className="staged-change-body">
                                                          {change.after !== undefined && (
                                                            <div className="staged-change-column">
                                                              <div className="staged-change-subtitle">After</div>
                                                              <pre className="code-block diff-block">
                                                                {renderInlineDiff(originalValue, change.after, 'after')}
                                                              </pre>
                                                            </div>
                                                          )}
                                                          {hasOriginal && (
                                                            <div className="staged-change-column">
                                                              <button
                                                                type="button"
                                                                className="staged-change-toggle"
                                                                onClick={() => {
                                                                  setExpandedOriginals((prev) => ({
                                                                    ...prev,
                                                                    [changeKey]: !prev[changeKey],
                                                                  }));
                                                                }}
                                                              >
                                                                {isExpanded ? 'Hide original' : 'Show original'}
                                                              </button>
                                                              {isExpanded && (
                                                                <>
                                                                  <div className="staged-change-subtitle">{originalLabel}</div>
                                                                  {originalValue === undefined ? (
                                                                    <div className="staged-change-empty">Not set</div>
                                                                  ) : (
                                                                    <pre className="code-block diff-block">
                                                                      {renderInlineDiff(originalValue, change.after, 'original')}
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
                                                  <div className="staged-group-title">Processor flow changes</div>
                                                  {section.processorChanges.map((change, idx) => (
                                                    <div key={`${section.title}-proc-${idx}-${change.action}`} className="staged-change">
                                                      <div className="staged-change-header">
                                                        <span className="staged-change-label">
                                                          {getProcessorType(change.processor) || 'processor'}
                                                        </span>
                                                        <span className={`pill change-pill change-pill-${change.action}`}>
                                                          {change.action}
                                                        </span>
                                                      </div>
                                                      <div className="staged-change-body">
                                                        <div className="staged-change-column">
                                                          <div className="staged-change-subtitle">Summary</div>
                                                          <div className="builder-preview-lines">
                                                            {getProcessorSummaryLines(change.processor).map((line, lineIdx) => (
                                                              <span key={`${line}-${lineIdx}`}>{line}</span>
                                                            ))}
                                                          </div>
                                                          <pre className="code-block">
                                                            {JSON.stringify(change.processor, null, 2)}
                                                          </pre>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ))}
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
                                  setPendingOverrideSave(null);
                                  setShowReviewModal(false);
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
                              disabled={!hasEditPermission}
                            />
                            <div className="modal-actions">
                              <button
                                type="button"
                                onClick={() => setReviewStep('review')}
                              >
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
                      </div>
                    </div>
                  )}
                  {showBuilderHelpModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal modal-wide">
                        <h3>Builder Help</h3>
                        <div className="builder-help-section">
                          <h4>Processor Builder</h4>
                          <p>
                            Use processors to transform or set event fields after a match. Select a processor,
                            configure inputs, and review the generated JSON before applying.
                          </p>
                          <ul>
                            <li><strong>Set</strong>: assign a literal or copy from a field path.</li>
                            <li><strong>Regex</strong>: extract a value using a capture group.</li>
                          </ul>
                        </div>
                        <div className="builder-help-section">
                          <h4>Eval Builder</h4>
                          <p>
                            Use Friendly for guided conditions or Regular for raw expressions. Click $v tokens to
                            see trap variable details.
                          </p>
                        </div>
                        <div className="builder-help-section">
                          <h4>References</h4>
                          <p>Docs: architecture/FCOM_Curation_UI_Plan.md</p>
                          <p>UA REST/processor docs (internal UA documentation).</p>
                        </div>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setShowBuilderHelpModal(false)}>Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {showAdvancedProcessorModal && (
                    <div
                      className="modal-overlay modal-overlay-top"
                      style={getModalOverlayStyle('advancedFlow', 0)}
                      role="dialog"
                      aria-modal="true"
                    >
                      <div className="modal modal-flow" ref={advancedFlowModalRef}>
                        <div className="flow-modal-header">
                          <h3>
                            {advancedProcessorScope === 'global'
                              ? 'Advanced Processors (Global)'
                              : 'Advanced Processors (Object)'}
                          </h3>
                          <button
                            type="button"
                            className="flow-modal-close"
                            onClick={requestCloseAdvancedFlowModal}
                          >
                            Close
                          </button>
                        </div>
                        <div className="flow-modal-subtitle">
                          {advancedProcessorScope === 'global'
                            ? 'Wireframe: configure global pre/post processors for the file. Drag from the palette into the lanes.'
                            : 'Wireframe: configure object processors. Drag from the palette into the flow lanes.'}
                        </div>
                        {(advancedFlowDirty || flowErrorCount > 0) && (
                          <div className="builder-hint builder-hint-warning">
                            {flowErrorCount > 0
                              ? `Resolve ${flowErrorCount} validation issue(s) before saving.`
                              : 'Pending Advanced Flow changes. Save to stage.'}
                          </div>
                        )}
                        {advancedFlowRemovedTargets.length > 0 && (
                          <div className="flow-removed-card">
                            <div className="flow-removed-title">Marked for deletion on save</div>
                            <div className="flow-removed-list">
                              {advancedFlowRemovedTargets.map((target) => (
                                <div key={target} className="flow-removed-item">
                                  <span className="flow-removed-label">{formatFlowTargetLabel(target)}</span>
                                  <span className="pill removed-pill">To be deleted</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flow-modal-body">
                          <div className="flow-palette">
                            <div className="flow-palette-title">Palette</div>
                            <input
                              className="flow-palette-search"
                              placeholder="Search processors"
                              value={advancedProcessorSearch}
                              onChange={(event) => setAdvancedProcessorSearch(event.target.value)}
                            />
                            <div className="flow-palette-list">
                              {paletteSections.map((section) => (
                                <div key={section.status} className="flow-palette-section">
                                  <div className="flow-palette-section-title">{section.title}</div>
                                  {section.items.length === 0 ? (
                                    <div className="flow-palette-empty">None</div>
                                  ) : (
                                    <div className="flow-palette-section-grid">
                                      {section.items.map((item) => {
                                        const isEnabled = item.status !== 'planned';
                                        return (
                                          <div
                                            key={`${item.label}-${item.nodeKind}`}
                                            className={isEnabled
                                              ? 'flow-palette-item'
                                              : 'flow-palette-item flow-palette-item-disabled'}
                                            draggable={isEnabled}
                                            onDragStart={(event) => {
                                              if (!isEnabled) {
                                                return;
                                              }
                                              const payload = JSON.stringify({
                                                source: 'palette',
                                                nodeKind: item.nodeKind,
                                                processorType: item.processorType,
                                              });
                                              event.dataTransfer.setData('application/json', payload);
                                              event.dataTransfer.setData('text/plain', payload);
                                              event.dataTransfer.effectAllowed = 'copyMove';
                                            }}
                                          >
                                            <span>{item.label}</span>
                                            {renderProcessorHelp((item.nodeKind === 'if'
                                              ? 'if'
                                              : item.processorType) as keyof typeof processorHelp)}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flow-canvas">
                            {advancedProcessorScope === 'global' ? (
                              <>
                                <div className="flow-canvas-title">Global Flow</div>
                                <div className="flow-global-sections">
                                  <div className="flow-global-section">
                                    <div className="flow-global-title">Pre</div>
                                    {renderFlowList(
                                      globalPreFlow,
                                      { kind: 'root' },
                                      setGlobalPreFlow,
                                      'global',
                                      'pre',
                                      flowValidation.pre,
                                    )}
                                  </div>
                                  <div className="flow-global-section">
                                    <div className="flow-global-title">Post</div>
                                    {renderFlowList(
                                      globalPostFlow,
                                      { kind: 'root' },
                                      setGlobalPostFlow,
                                      'global',
                                      'post',
                                      flowValidation.post,
                                    )}
                                  </div>
                                </div>
                                {renderFlowJsonPreview(JSON.stringify({
                                  pre: buildFlowProcessors(globalPreFlow),
                                  post: buildFlowProcessors(globalPostFlow),
                                }, null, 2))}
                              </>
                            ) : (
                              <>
                                <div className="flow-canvas-title">Flow</div>
                                {renderFlowList(
                                  advancedFlow,
                                  { kind: 'root' },
                                  setAdvancedFlow,
                                  'object',
                                  'object',
                                  flowValidation.object,
                                )}
                                {renderFlowJsonPreview(JSON.stringify(buildFlowProcessors(advancedFlow), null, 2))}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="modal-actions">
                          <button
                            type="button"
                            onClick={requestCloseAdvancedFlowModal}
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            aria-disabled={!advancedFlowDirty || flowErrorCount > 0 || !hasEditPermission}
                            className={`builder-card builder-card-primary${(!advancedFlowDirty || flowErrorCount > 0 || !hasEditPermission)
                              ? ' button-disabled'
                              : ''}`}
                            onClick={() => {
                              if (!advancedFlowDirty || flowErrorCount > 0 || !hasEditPermission) {
                                if (flowErrorCount > 0) {
                                  triggerFlowErrorPulse(advancedFlowModalRef.current);
                                }
                                return;
                              }
                              saveAdvancedFlow();
                            }}
                          >
                            Save Changes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {flowEditor && flowEditorDraft && (
                    <div
                      className="modal-overlay modal-overlay-top"
                      style={getModalOverlayStyle('flowEditor', 1)}
                      role="dialog"
                      aria-modal="true"
                    >
                      <div className="modal modal-wide" ref={flowEditorModalRef}>
                        <div className="flow-editor-header">
                          <h3>
                            Configure Processor
                            {flowEditorDraft ? ` — ${getFlowNodeLabel(flowEditorDraft)}` : ''}
                          </h3>
                          <button
                            type="button"
                            className="builder-link"
                            onClick={() => setShowFieldReferenceModal(true)}
                          >
                            Field reference
                          </button>
                        </div>
                        {processorHelp[flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType] && (
                          <div className="builder-hint">
                            <div>
                              {processorHelp[flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType].description}
                            </div>
                            <div className="builder-example-row">
                              <button
                                type="button"
                                className="builder-link"
                                onClick={applyFlowEditorExample}
                              >
                                Apply example
                              </button>
                              <span className="builder-example-code">
                                {processorHelp[flowEditorDraft.kind === 'if' ? 'if' : flowEditorDraft.processorType].example}
                              </span>
                            </div>
                          </div>
                        )}
                        {flowEditorDraft.kind === 'processor'
                          && ['set', 'regex'].includes(flowEditorDraft.processorType)
                          && (
                            <div className="processor-form">
                              {renderProcessorConfigFields(
                                flowEditorDraft.processorType,
                                flowEditorDraft.config || {},
                                (key, value) => setFlowEditorDraft((prev) => (prev
                                  ? {
                                    ...prev,
                                    config: {
                                      ...(prev as FlowProcessorNode).config,
                                      [key]: value,
                                    },
                                  }
                                  : prev)),
                                'flow',
                                flowEditorFieldErrors,
                              )}
                            </div>
                          )}
                        {flowEditorDraft.kind === 'if' && (
                          <div className="processor-form">
                            <div className="processor-row">
                              <label className="builder-label">Property</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.condition.property}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.condition.property',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Operator</label>
                              <select
                                className="builder-select"
                                value={flowEditorDraft.condition.operator}
                                onChange={(e) => setFlowEditorDraft((prev) => (prev
                                  ? {
                                    ...prev,
                                    condition: {
                                      ...(prev as FlowIfNode).condition,
                                      operator: e.target.value,
                                    },
                                  }
                                  : prev))}
                              >
                                <option value="==">==</option>
                                <option value="!=">!=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
                                <option value=">=">&gt;=</option>
                                <option value="<=">&lt;=</option>
                                <option value="=~">=~</option>
                              </select>
                            </div>
                            <div className="processor-row">
                              <label className="builder-label">Value</label>
                              <input
                                className="builder-input"
                                value={flowEditorDraft.condition.value}
                                onChange={(e) => handleFlowEditorInputChange(
                                  'flowEditor.condition.value',
                                  e.target.value,
                                  e.target.selectionStart,
                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                )}
                              />
                            </div>
                          </div>
                        )}
                        {flowEditorDraft.kind === 'processor'
                          && flowEditorDraft.processorType === 'foreach'
                          && (
                            <div className="processor-form">
                              <div className="processor-row">
                                <label className="builder-label">Source</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.source || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        source: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Key</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.keyVal || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        keyVal: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Value</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.valField || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        valField: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Processors</label>
                                {renderFlowList(
                                  Array.isArray(flowEditorDraft.config?.processors)
                                    ? (flowEditorDraft.config?.processors as FlowNode[])
                                    : [],
                                  { kind: 'root' },
                                  (updater) => {
                                    setFlowEditorDraft((prev) => {
                                      if (!prev || prev.kind !== 'processor') {
                                        return prev;
                                      }
                                      const current = Array.isArray(prev.config?.processors)
                                        ? prev.config.processors
                                        : [];
                                      const next = typeof updater === 'function'
                                        ? (updater as (items: FlowNode[]) => FlowNode[])(current)
                                        : updater;
                                      return {
                                        ...prev,
                                        config: {
                                          ...(prev as FlowProcessorNode).config,
                                          processors: next,
                                        },
                                      } as FlowNode;
                                    });
                                  },
                                  flowEditor?.scope || 'object',
                                  flowEditor?.lane || 'object',
                                  validateFlowNodes(
                                    Array.isArray(flowEditorDraft.config?.processors)
                                      ? (flowEditorDraft.config?.processors as FlowNode[])
                                      : [],
                                    flowEditor?.lane || 'object',
                                  ),
                                )}
                              </div>
                            </div>
                          )}
                        {flowEditorDraft.kind === 'processor'
                          && flowEditorDraft.processorType === 'switch'
                          && (
                            <div className="processor-form">
                              <div className="processor-row">
                                <label className="builder-label">Source</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.source || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        source: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Operator</label>
                                <input
                                  className="builder-input"
                                  value={flowEditorDraft.config?.operator || ''}
                                  onChange={(e) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        operator: e.target.value,
                                      },
                                    }
                                    : prev))}
                                />
                              </div>
                              <div className="processor-row">
                                <label className="builder-label">Cases</label>
                                <div className="flow-switch-cases">
                                  {(Array.isArray(flowEditorDraft.config?.cases)
                                    ? flowEditorDraft.config?.cases
                                    : []).map((item: any) => (
                                      <div key={item.id} className="flow-switch-case">
                                        <div className="flow-switch-case-row">
                                          <label className="builder-label">Match</label>
                                          <input
                                            className="builder-input"
                                            value={item.match ?? ''}
                                            onChange={(e) => setFlowEditorDraft((prev) => {
                                              if (!prev || prev.kind !== 'processor') {
                                                return prev;
                                              }
                                              const cases = Array.isArray(prev.config?.cases)
                                                ? prev.config.cases
                                                : [];
                                              return {
                                                ...prev,
                                                config: {
                                                  ...(prev as FlowProcessorNode).config,
                                                  cases: cases.map((entry: any) => (
                                                    entry.id === item.id
                                                      ? { ...entry, match: e.target.value }
                                                      : entry
                                                  )),
                                                },
                                              } as FlowNode;
                                            })}
                                          />
                                        </div>
                                        <div className="flow-switch-case-row">
                                          <label className="builder-label">Operator (optional)</label>
                                          <input
                                            className="builder-input"
                                            value={item.operator ?? ''}
                                            onChange={(e) => setFlowEditorDraft((prev) => {
                                              if (!prev || prev.kind !== 'processor') {
                                                return prev;
                                              }
                                              const cases = Array.isArray(prev.config?.cases)
                                                ? prev.config.cases
                                                : [];
                                              return {
                                                ...prev,
                                                config: {
                                                  ...(prev as FlowProcessorNode).config,
                                                  cases: cases.map((entry: any) => (
                                                    entry.id === item.id
                                                      ? { ...entry, operator: e.target.value }
                                                      : entry
                                                  )),
                                                },
                                              } as FlowNode;
                                            })}
                                          />
                                        </div>
                                        <div className="flow-switch-case-row">
                                          <button
                                            type="button"
                                            className="builder-link"
                                            onClick={() => setFlowEditorDraft((prev) => {
                                              if (!prev || prev.kind !== 'processor') {
                                                return prev;
                                              }
                                              const cases = Array.isArray(prev.config?.cases)
                                                ? prev.config.cases
                                                : [];
                                              return {
                                                ...prev,
                                                config: {
                                                  ...(prev as FlowProcessorNode).config,
                                                  cases: cases.filter((entry: any) => entry.id !== item.id),
                                                },
                                              } as FlowNode;
                                            })}
                                          >
                                            Remove case
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  <button
                                    type="button"
                                    className="builder-link"
                                    onClick={() => setFlowEditorDraft((prev) => {
                                      if (!prev || prev.kind !== 'processor') {
                                        return prev;
                                      }
                                      const cases = Array.isArray(prev.config?.cases)
                                        ? prev.config.cases
                                        : [];
                                      return {
                                        ...prev,
                                        config: {
                                          ...(prev as FlowProcessorNode).config,
                                          cases: [
                                            ...cases,
                                            {
                                              id: nextSwitchCaseId(),
                                              match: '',
                                              operator: '',
                                              processors: [],
                                            },
                                          ],
                                        },
                                      } as FlowNode;
                                    })}
                                  >
                                    Add case
                                  </button>
                                </div>
                              </div>
                              <div className="builder-hint">
                                Drag processors into each case or the Default lane on the canvas.
                              </div>
                            </div>
                          )}
                        {flowEditorDraft.kind === 'processor'
                          && !['set', 'regex', 'foreach', 'switch'].includes(flowEditorDraft.processorType)
                          && (
                            <div className="processor-form">
                              {(processorConfigSpecs[flowEditorDraft.processorType] || []).length === 0 ? (
                                <div className="builder-hint">
                                  No configuration required for this processor.
                                </div>
                              ) : (
                                renderProcessorConfigFields(
                                  flowEditorDraft.processorType,
                                  flowEditorDraft.config || {},
                                  (key, value) => setFlowEditorDraft((prev) => (prev
                                    ? {
                                      ...prev,
                                      config: {
                                        ...(prev as FlowProcessorNode).config,
                                        [key]: value,
                                      },
                                    }
                                    : prev)),
                                  'flow',
                                )
                              )}
                            </div>
                          )}
                        {flowEditorNodeErrors.length > 0 && (
                          <div className="builder-hint builder-hint-warning">
                            {flowEditorNodeErrors.map((item) => (
                              <div key={item}>{item}</div>
                            ))}
                          </div>
                        )}
                        <div className="modal-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setFlowEditor(null);
                              setFlowEditorDraft(null);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            aria-disabled={flowEditorHasErrors}
                            className={`builder-card builder-card-primary${flowEditorHasErrors ? ' button-disabled' : ''}`}
                            onClick={() => {
                              if (!flowEditor || !flowEditorDraft) {
                                return;
                              }
                              if (flowEditorHasErrors) {
                                triggerValidationPulse(flowEditorModalRef.current);
                                return;
                              }
                              const setNodes = flowEditor.setNodesOverride
                                || getFlowStateByLane(flowEditor.scope, flowEditor.lane).setNodes;
                              setNodes((prev) => replaceNodeById(prev, flowEditor.nodeId, flowEditorDraft));
                              setFlowEditor(null);
                              setFlowEditorDraft(null);
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {showFieldReferenceModal && (
                    <div
                      className={`modal-overlay${(showAdvancedProcessorModal || flowEditor)
                        ? ' modal-overlay-top'
                        : ''}`}
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
                            <div className="field-reference-title">Event fields (from this file)</div>
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
                          <button type="button" onClick={() => setShowFieldReferenceModal(false)}>Close</button>
                        </div>
                      </div>
                    </div>
                  )}
                  {builderSwitchModal.open && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Switch builder type</h3>
                        <p>
                          Switch from {builderSwitchModal.from} to {builderSwitchModal.to}? This will replace the
                          current configuration.
                        </p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setBuilderSwitchModal({ open: false })}>
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
                        <h3>{removeOverrideModal.isNewField ? 'Remove field' : 'Remove override'}</h3>
                        <p>
                          {removeOverrideModal.isNewField
                            ? 'Removing this field will discard it on save.'
                            : 'Removing this override will default to original value:'}
                        </p>
                        {!removeOverrideModal.isNewField && (
                          <pre className="code-block">{removeOverrideModal.baseValue ?? '—'}</pre>
                        )}
                        <p>Are you sure?</p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setRemoveOverrideModal({ open: false })}>
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
                              {JSON.stringify(removeAllOverridesModal.baseValues ?? {}, null, 2)}
                            </pre>
                            <p>Are you sure?</p>
                          </>
                        ) : (
                          <p>No direct overrides can be removed here.</p>
                        )}
                        {(removeAllOverridesModal.processorFields?.length || 0) > 0 && (
                          <>
                            <p className="modal-warning">
                              These fields are set by Advanced Flow and won’t be removed here:
                            </p>
                            <ul className="modal-warning-list">
                              {removeAllOverridesModal.processorFields?.map((field) => (
                                <li key={field}>{field}</li>
                              ))}
                            </ul>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => {
                                const focusField = removeAllOverridesModal.processorFields?.[0];
                                const objectName = removeAllOverridesModal.objectName;
                                if (objectName) {
                                  openAdvancedFlowModal(
                                    'object',
                                    objectName,
                                    focusField ? `$.event.${focusField}` : null,
                                  );
                                }
                              }}
                            >
                              Open Advanced Flow
                            </button>
                          </>
                        )}
                        <div className="modal-actions">
                          <button type="button" onClick={() => setRemoveAllOverridesModal({ open: false })}>
                            {(removeAllOverridesModal.fields?.length || 0) > 0 ? 'No' : 'Close'}
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
                          <button type="button" onClick={() => setPanelNavWarning((prev) => ({ ...prev, open: false }))}>
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
                  {pendingAdvancedFlowClose && (
                    <div
                      className="modal-overlay modal-overlay-top"
                      style={getModalOverlayStyle('advancedFlowConfirm', 3)}
                      role="dialog"
                      aria-modal="true"
                    >
                      <div className="modal">
                        <h3>Discard Advanced Flow changes?</h3>
                        <p>You have unsaved Advanced Flow edits. Discard them?</p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setPendingAdvancedFlowClose(false)}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingAdvancedFlowClose(false);
                              setShowAdvancedProcessorModal(false);
                              setFlowEditor(null);
                              setFlowEditorDraft(null);
                              setAdvancedFlowDefaultTarget(null);
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
                                cancelEventEdit(next.panelKey);
                              }
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
                        <div className="save-spinner" aria-hidden="true" />
                        <div>
                          <div className="save-overlay-title">Saving changes…</div>
                          <div className="save-overlay-subtitle">
                            Please wait{saveElapsed ? ` • ${saveElapsed}s` : ''}
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
                            .filter((field) => field.toLowerCase().includes(addFieldSearch.toLowerCase()))
                            .map((field) => {
                              const existingFields = new Set([
                                ...Object.keys(addFieldContext.obj?.event || {}),
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
                                  className={isReserved || isExisting
                                    ? 'add-field-item add-field-item-disabled'
                                    : 'add-field-item'}
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
                            <div className="empty-state">No event fields found in this file.</div>
                          )}
                          {addFieldSearch.trim() && !availableEventFields.some((field) => field.toLowerCase() === addFieldSearch.trim().toLowerCase()) && (
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
                      UA internal paths use an <span className="code-pill">id-core</span> prefix. The UI
                      displays the cleaned path for readability.
                    </p>
                  </div>
                  <div className="help-section">
                    <h4>Search modes</h4>
                    <ul>
                      <li><strong>Names</strong>: searches file and folder names (and paths).</li>
                      <li><strong>Content</strong>: searches inside file contents only.</li>
                      <li><strong>All</strong>: searches both names and contents.</li>
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
                            if (varModalMode === 'insert' && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              handleVarInsertSelect(token);
                            }
                          }}
                        >
                          <div className="trap-var-title">
                            <span className="trap-var-name">{renderValue(variable?.name)}</span>
                            <span className={`pill${isSelected ? ' pill-selected' : ''}`}>{token}</span>
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
                    <button type="button" onClick={() => {
                      setVarModalOpen(false);
                      setVarModalMode('view');
                      setVarInsertContext(null);
                    }}>
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
                      .filter((field) => field.toLowerCase().includes(eventFieldSearch.trim().toLowerCase()))
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
                      <div className="empty-state">No event fields found in this file.</div>
                    )}
                    {eventFieldSearch.trim() && !availableEventFields.some((field) => field.toLowerCase() === eventFieldSearch.trim().toLowerCase()) && (
                      <button
                        type="button"
                        className="add-field-item"
                        onClick={() => handleEventFieldInsertSelect(eventFieldSearch.trim())}
                      >
                        Add "{eventFieldSearch.trim()}"
                      </button>
                    )}
                  </div>
                  <div className="modal-actions">
                    <button type="button" onClick={() => {
                      setEventFieldPickerOpen(false);
                      setEventFieldInsertContext(null);
                    }}>
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
          <PcomPage />
          ) : (
          <div className="split-layout">
            <div className="panel">
              <div className="panel-scroll">
                <div className="panel-header">
                  <div className="panel-title-row">
                    <h2>MIB Browser</h2>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => loadMibPath(mibPath)}
                    >
                      Refresh
                    </button>
                  </div>
                  <div className="panel-section">
                    <div className="panel-section-title">Path</div>
                    <div className="breadcrumbs mib-breadcrumbs">
                      {buildBreadcrumbsFromPath(mibPath).map((crumb, index, items) => {
                        const targetPath = crumb.node ? `/${crumb.node}` : '/';
                        return (
                          <button
                            key={`${crumb.label}-${index}`}
                            type="button"
                            className="crumb"
                            onClick={() => loadMibPath(targetPath)}
                            disabled={index === items.length - 1}
                          >
                            {crumb.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="panel-section">
                    <div className="panel-section-title">Search</div>
                    <form className="mib-search" onSubmit={handleMibSearchSubmit}>
                      <div className="mib-search-row">
                        <input
                          type="text"
                          placeholder="Search MIBs"
                          value={mibSearch}
                          onChange={(e) => setMibSearch(e.target.value)}
                        />
                        <select
                          value={mibSearchScope}
                          onChange={(e) => setMibSearchScope(e.target.value as 'folder' | 'all')}
                        >
                          <option value="folder">Current folder</option>
                          <option value="all">All folders</option>
                        </select>
                        <button type="submit" className="search-button">
                          Search
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={handleMibClearSearch}
                          disabled={!mibSearch}
                        >
                          Clear
                        </button>
                      </div>
                      {mibSearchMode === 'search' && mibSearch.trim() && (
                        <div className="muted">
                          Searching all MIBs for “{mibSearch.trim()}”.
                        </div>
                      )}
                      {mibSearchMode !== 'search' && mibSearch.trim() && (
                        <div className="muted">
                          Filtering current folder for “{mibSearch.trim()}”.
                        </div>
                      )}
                    </form>
                  </div>
                </div>
                {mibError && <div className="error">{mibError}</div>}
                {mibLoading ? (
                  <div>Loading MIBs…</div>
                ) : (
                  <div className="browse-results">
                    {mibEntries.length === 0 ? (
                      <div className="empty-state">No MIB files found.</div>
                    ) : (
                      <ul className="browse-list">
                        {mibEntries.map((entry) => (
                          <li key={entry.path || entry.name}>
                            <button
                              type="button"
                              className={entry.isDir ? 'browse-link' : 'browse-link file-link'}
                              onClick={() => handleOpenMibEntry(entry)}
                            >
                              <span className="browse-icon" aria-hidden="true">
                                {entry.isDir ? '📁' : '📄'}
                              </span>
                              {entry.name}
                            </button>
                            {!entry.isDir && (
                              <span className="browse-meta">
                                {entry.size ? `${Math.round(entry.size / 1024)} KB` : ''}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(mibTotal !== null || mibFilteredTotal !== null) && (
                      <div className="muted">
                        Showing {mibEntries.length} of {mibFilteredTotal ?? mibTotal ?? mibEntries.length}
                        {mibSearch.trim() ? ' matches' : ' items'}.
                        {mibSearchMode === 'search' && mibHasMore && ' (more matches available)'}
                      </div>
                    )}
                    {mibHasMore && (
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => {
                          if (mibSearchScope === 'all' && mibSearch.trim()) {
                            void loadMibSearch({ append: true });
                          } else {
                            void loadMibPath(mibPath, { append: true });
                          }
                        }}
                        disabled={mibLoading}
                      >
                        Load more
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="panel">
              <div className="panel-scroll">
                <div className="panel-header">
                  <h2>MIB Details</h2>
                </div>
                {!mibSelectedFile ? (
                  <div className="empty-state">Select a MIB file to inspect.</div>
                ) : (
                  <div className="mib-details">
                    <div className="file-title">
                      <strong>{mibSelectedFile}</strong>
                    </div>
                    <div className="mib-actions">
                      <button
                        type="button"
                        className="action-link"
                        onClick={runMib2Fcom}
                        disabled={!hasEditPermission || mib2FcomLoading}
                        title={hasEditPermission ? '' : 'Read-only access'}
                      >
                        {mib2FcomLoading ? 'Running…' : 'Run MIB2FCOM'}
                      </button>
                      <label className="mib-checkbox">
                        <input
                          type="checkbox"
                          checked={mibUseParent}
                          onChange={(e) => setMibUseParent(e.target.checked)}
                          disabled={!hasEditPermission}
                        />
                        Use parent MIBs
                      </label>
                    </div>
                    {mib2FcomError && <div className="error">{mib2FcomError}</div>}
                    {mibOutput && (
                      <div className="panel-section">
                        <div className="panel-section-title">
                          MIB2FCOM Output{mibOutputName ? ` (${mibOutputName})` : ''}
                        </div>
                        <textarea
                          className="mib-output"
                          value={mibOutput}
                          onChange={(e) => setMibOutput(e.target.value)}
                          disabled={!hasEditPermission}
                        />
                      </div>
                    )}
                    <div className="panel-section">
                      <div className="panel-section-title">Definitions</div>
                      <input
                        type="text"
                        placeholder="Search definitions"
                        value={mibDefinitionSearch}
                        onChange={(e) => setMibDefinitionSearch(e.target.value)}
                      />
                      <div className="mib-definition-list">
                        {filteredMibDefinitions.length === 0 ? (
                          <div className="empty-state">No definitions found.</div>
                        ) : (
                          filteredMibDefinitions.map((definition) => (
                            <button
                              key={`${definition.name}-${definition.oid || definition.kind}`}
                              type="button"
                              className={mibSelectedDefinition?.name === definition.name
                                ? 'mib-definition-item mib-definition-item-active'
                                : 'mib-definition-item'}
                              onClick={() => setMibSelectedDefinition(definition)}
                            >
                              <span className="mib-definition-name">{definition.name}</span>
                              <span className="mib-definition-kind">{definition.kind}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                    {mibSelectedDefinition && (
                      <div className="mib-definition-details">
                        <div className="mib-definition-title">{mibSelectedDefinition.name}</div>
                        <div className="mib-definition-meta">
                          <span>Kind: {mibSelectedDefinition.kind}</span>
                          <span>OID: {mibSelectedDefinition.oid || '—'}</span>
                        </div>
                        <div className="mib-definition-meta">
                          {mibSelectedDefinition.module && <span>Module: {mibSelectedDefinition.module}</span>}
                          {mibSelectedDefinition.syntax && <span>Syntax: {mibSelectedDefinition.syntax}</span>}
                          {mibSelectedDefinition.access && <span>Access: {mibSelectedDefinition.access}</span>}
                          {mibSelectedDefinition.status && <span>Status: {mibSelectedDefinition.status}</span>}
                          {mibSelectedDefinition.defval && <span>Default: {mibSelectedDefinition.defval}</span>}
                          {mibSelectedDefinition.index && <span>Index: {mibSelectedDefinition.index}</span>}
                        </div>
                        {mibSelectedDefinition.description && (
                          <div className="mib-definition-description">{mibSelectedDefinition.description}</div>
                        )}
                        <button
                          type="button"
                          className="action-link"
                          onClick={() => openTrapComposer(mibSelectedDefinition, mibSelectedFile)}
                        >
                          Compose Trap
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
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
                ) : trapSource === 'fcom' && (
                  <div className="muted">Prefilled from FCOM test command.</div>
                )}
                {bulkTrapContext && (
                  <div className="panel-section">
                    <div className="panel-section-title">Progress</div>
                    {!trapSending && !bulkTrapSummary ? (
                      <div className="trap-progress-meta">
                        <span>
                          Ready to send {bulkTrapContext.total} SNMP traps.
                        </span>
                        {!trapHost && (
                          <span className="trap-progress-failed">Select a destination to continue.</span>
                        )}
                      </div>
                    ) : bulkTrapSummary ? (
                      <div className="trap-progress-meta">
                        <span>
                          Completed: {bulkTrapSummary.passed}/{bulkTrapSummary.total} sent,
                          {' '}{bulkTrapSummary.failed} failed.
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="trap-progress">
                          <div
                            className="trap-progress-bar"
                            style={{
                              width: bulkTrapProgress.total > 0
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
                            <span className="trap-progress-current">Now: {bulkTrapProgress.currentLabel}</span>
                          )}
                          {bulkTrapProgress.failed > 0 && (
                            <span className="trap-progress-failed">Failed: {bulkTrapProgress.failed}</span>
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
                      <select
                        value=""
                        onChange={(e) => setTrapHost(e.target.value)}
                      >
                        <option value="">Select recent</option>
                        {recentTargets.map((target) => (
                          <option key={target} value={target}>{target}</option>
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
                        <select value={trapVersion} onChange={(e) => setTrapVersion(e.target.value)}>
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
                            onChange={(e) => setTrapVarbinds((prev) => prev.map((item, idx) => (
                              idx === index ? { ...item, oid: e.target.value } : item
                            )))}
                          />
                          <select
                            value={binding.type}
                            onChange={(e) => setTrapVarbinds((prev) => prev.map((item, idx) => (
                              idx === index ? { ...item, type: e.target.value } : item
                            )))}
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
                            onChange={(e) => setTrapVarbinds((prev) => prev.map((item, idx) => (
                              idx === index ? { ...item, value: e.target.value } : item
                            )))}
                          />
                          <button
                            type="button"
                            className="builder-link"
                            onClick={() => setTrapVarbinds((prev) => prev.filter((_item, idx) => idx !== index))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="builder-link"
                        onClick={() => setTrapVarbinds((prev) => ([
                          ...prev,
                          { oid: '', type: 's', value: '' },
                        ]))}
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
                    aria-disabled={trapSending || (bulkTrapContext
                      ? (!trapHost || Boolean(bulkTrapSummary))
                      : (!trapHost || !trapOid))}
                    className={`builder-card builder-card-primary${trapSending || (bulkTrapContext
                      ? (!trapHost || Boolean(bulkTrapSummary))
                      : (!trapHost || !trapOid))
                      ? ' button-disabled'
                      : ''}`}
                    onClick={() => {
                      const disabled = trapSending || (bulkTrapContext
                        ? (!trapHost || Boolean(bulkTrapSummary))
                        : (!trapHost || !trapOid));
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

              <label>
                Auth type
                <select
                  value={authType}
                  onChange={(e) => setAuthType(e.target.value as 'basic' | 'certificate')}
                >
                  {authOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              {authType === 'basic' ? (
                <>
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
                </>
              ) : (
                <>
                  <label>
                    Certificate path
                    <input
                      type="text"
                      value={certPath}
                      onChange={(e) => setCertPath(e.target.value)}
                    />
                  </label>
                  <label>
                    Key path
                    <input
                      type="text"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                    />
                  </label>
                  <label>
                    CA bundle path (optional)
                    <input
                      type="text"
                      value={caPath}
                      onChange={(e) => setCaPath(e.target.value)}
                    />
                  </label>
                </>
              )}

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
                      {overviewProgress?.total
                        ? ` · ${overviewProgress.processed} / ${overviewProgress.total} ${overviewProgress.unit || 'items'}`
                        : ''}
                    </span>
                    {overviewProgress?.total ? (
                      <div className="trap-progress" aria-hidden="true">
                        <div
                          className="trap-progress-bar"
                          style={{ width: `${overviewProgressPercent}%` }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : overviewStatus?.lastBuiltAt ? (
                  <span className="muted">
                    Last refresh {formatTime(overviewStatus.lastBuiltAt)}
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
                      {searchProgress?.total
                        ? ` · ${searchProgress.processed} / ${searchProgress.total} ${searchProgress.unit || 'items'}`
                        : ''}
                    </span>
                    {searchProgress?.total ? (
                      <div className="trap-progress" aria-hidden="true">
                        <div
                          className="trap-progress-bar"
                          style={{ width: `${searchProgressPercent}%` }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : searchStatus?.lastBuiltAt ? (
                  <span className="muted">
                    Indexed {searchStatus.counts?.files || 0} files · Last refresh {formatTime(searchStatus.lastBuiltAt)}
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
                      {folderProgress?.total
                        ? ` · ${folderProgress.processed} / ${folderProgress.total} ${folderProgress.unit || 'items'}`
                        : ''}
                    </span>
                    {folderProgress?.total ? (
                      <div className="trap-progress" aria-hidden="true">
                        <div
                          className="trap-progress-bar"
                          style={{ width: `${folderProgressPercent}%` }}
                        />
                      </div>
                    ) : null}
                  </>
                ) : folderOverviewStatus?.entryCount ? (
                  <span className="muted">
                    {folderOverviewStatus.entryCount} entries · Last refresh {formatTime(folderOverviewStatus.lastBuiltAt)}
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
              {cacheActionMessage && <div className="success" style={{ marginTop: '1rem' }}>{cacheActionMessage}</div>}
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
      </div>
    </ErrorBoundary>
  );
}
