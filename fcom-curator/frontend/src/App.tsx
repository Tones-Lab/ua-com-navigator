import React, { useEffect, useMemo, useRef, useState } from 'react';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { useSessionStore } from './stores';
import api from './services/api';
import './App.css';

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
          <div className="panel">
            <h2>Something went wrong</h2>
            <p className="error">{this.state.error?.message || 'Unknown error'}</p>
            <button type="button" className="save-button" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const { session, isAuthenticated, setSession, setServers, servers, clearSession } = useSessionStore();
  const [serverId, setServerId] = useState<string>('');
  const [authType, setAuthType] = useState<'basic' | 'certificate'>('basic');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [certPath, setCertPath] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [caPath, setCaPath] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browsePath, setBrowsePath] = useState('/');
  const [showPathModal, setShowPathModal] = useState(false);
  const formatDisplayPath = (rawPath: string) => {
    const cleaned = rawPath.replace(/^\/+/, '');
    if (!cleaned) {
      return '/';
    }
    const parts = cleaned.split('/');
    if (parts[0]?.startsWith('id-')) {
      parts[0] = parts[0].replace(/^id-/, '');
    }
    return `/${parts.join('/')}`;
  };

  const getCurrentPath = () => {
    if (selectedFile?.PathID) {
      return formatDisplayPath(selectedFile.PathID);
    }
    if (browseNode) {
      return formatDisplayPath(browseNode);
    }
    return '/';
  };
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
  const [searchHighlightActive, setSearchHighlightActive] = useState(false);
  const [highlightQuery, setHighlightQuery] = useState<string | null>(null);
  const [highlightPathId, setHighlightPathId] = useState<string | null>(null);
  const [highlightObjectKeys, setHighlightObjectKeys] = useState<string[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const highlightNextOpenRef = useRef(false);
  const objectRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const getRawPath = () => {
    if (selectedFile?.PathID) {
      return `/${selectedFile.PathID}`;
    }
    if (browseNode) {
      return `/${browseNode}`;
    }
    return '/';
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

  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseData, setBrowseData] = useState<any>(null);
  const [browseNode, setBrowseNode] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [favorites, setFavorites] = useState<Array<{ type: 'file' | 'folder'; pathId: string; label: string; node?: string }>>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [folderOverview, setFolderOverview] = useState<any>(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ label: string; node: string | null }>>([
    { label: '/', node: null },
  ]);
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
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  const [panelEditEnabled, setPanelEditEnabled] = useState(false);
  const [panelEditState, setPanelEditState] = useState<Record<string, boolean>>({});
  const [panelDrafts, setPanelDrafts] = useState<Record<string, any>>({});
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
  }>({ open: false });
  const [schema, setSchema] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
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
  const varListRef = useRef<HTMLDivElement | null>(null);
  const varRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const canEditRules = Boolean(
    session?.ua_login?.data?.Permissions?.rule?.Rules?.update,
  );

  useEffect(() => {
    if (!panelEditEnabled) {
      setPanelEditState({});
      setPanelDrafts({});
    }
  }, [panelEditEnabled]);
  useEffect(() => {
    if (viewMode !== 'friendly' && panelEditEnabled) {
      setPanelEditEnabled(false);
    }
  }, [viewMode, panelEditEnabled]);

  useEffect(() => {
    if (viewMode !== 'friendly' && panelEditEnabled) {
      setPanelEditEnabled(false);
    }
  }, [viewMode, panelEditEnabled]);

  const togglePanelEdit = (key: string) => {
    setPanelEditState((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const ajv = useMemo(() => {
    const instance = new Ajv({ allErrors: true, strict: false });
    addFormats(instance);
    return instance;
  }, []);

  const validator = useMemo(() => {
    if (!schema) {
      return null;
    }
    try {
      return ajv.compile(schema);
    } catch {
      return null;
    }
  }, [ajv, schema]);

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
    if (!isAuthenticated || schema || schemaLoading) {
      return;
    }
    const loadSchema = async () => {
      setSchemaError(null);
      setSchemaLoading(true);
      try {
        const resp = await api.getSchema();
        setSchema(resp.data);
      } catch (err: any) {
        setSchemaError(err?.response?.data?.error || 'Schema unavailable');
      } finally {
        setSchemaLoading(false);
      }
    };
    void loadSchema();
  }, [isAuthenticated, schema, schemaLoading]);

  useEffect(() => {
    if (!validator) {
      setValidationErrors([]);
      setJsonParseError(null);
      return;
    }
    const text = editorText.trim();
    if (!text) {
      setValidationErrors([]);
      setJsonParseError(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      setJsonParseError(null);
      try {
        const valid = validator(parsed);
        if (!valid) {
          const errors = (validator.errors || []).map((err) => ({
            path: err.instancePath || '/',
            message: err.message || 'Invalid value',
          }));
          setValidationErrors(errors);
        } else {
          setValidationErrors([]);
        }
      } catch (err: any) {
        setValidationErrors([]);
        setSchemaError(err?.message || 'Schema validation failed');
      }
    } catch (err: any) {
      setJsonParseError(err?.message || 'Invalid JSON');
      setValidationErrors([]);
    }
  }, [editorText, validator]);

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
      setSelectedFile(null);
      setFileData(null);
      setEntries([]);
      setBrowseData(null);
      setBrowseNode(null);
      setBreadcrumbs([{ label: '/', node: null }]);
      setViewMode('preview');
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const confirmDiscardIfDirty = (action: () => void) => {
    const dirtyMap = getPanelDirtyMap();
    if (Object.keys(dirtyMap).length > 0) {
      setPanelNavWarning({ open: true, fields: dirtyMap });
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

  const stopSearchStatusPolling = () => {
    if (searchStatusPollRef.current !== null) {
      window.clearInterval(searchStatusPollRef.current);
      searchStatusPollRef.current = null;
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
  };

  const handleResetNavigation = async () => {
    handleClearSearch();
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
    setBrowseLoading(true);
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
    if (!highlightNextOpenRef.current) {
      setHighlightQuery(null);
      setHighlightPathId(null);
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      setSearchHighlightActive(false);
    }
    setSelectedFolder(null);
    setFolderOverview(null);
    setSelectedFile(entry);
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
    setHighlightQuery(null);
    setHighlightPathId(null);
    setHighlightObjectKeys([]);
    setCurrentMatchIndex(0);
    setSearchHighlightActive(false);
    setSelectedFile(null);
    setFileData(null);
    setOverrideInfo(null);
    setOverrideError(null);
    setSelectedFolder(entry);
    setFolderOverview(null);
    setFolderLoading(true);
    try {
      setBreadcrumbs(buildBreadcrumbsFromPath(entry.PathID));
      await loadNodeInternal(entry.PathID, entry.PathName);
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

  const favoritesFiles = favorites.filter((fav) => fav.type === 'file');
  const favoritesFolders = favorites.filter((fav) => fav.type === 'folder');

  const saveWithContent = async (content: any, message: string) => {
    if (!selectedFile) {
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
    setSaveError(null);
    setSaveSuccess(null);
    setSaveLoading(true);
    try {
      const resp = await api.saveOverrides(selectedFile.PathID, pendingOverrideSave, message.trim());
      setOverrideInfo(resp.data);
      setSaveSuccess('Overrides saved. Restart FCOM Processor required.');
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

  const overrideIndex = useMemo(() => {
    const entries = Array.isArray(overrideInfo?.overrides) ? overrideInfo.overrides : [];
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
  }, [overrideInfo]);

  const getProcessorTargetField = (processor: any) => {
    if (!processor || typeof processor !== 'object') {
      return null;
    }
    const keys = [
      'set',
      'copy',
      'replace',
      'convert',
      'interpolate',
      'append',
      'sort',
      'split',
      'math',
      'length',
      'date',
      'regex',
      'rename',
      'strcase',
      'substr',
    ];
    for (const key of keys) {
      const target = processor?.[key]?.targetField;
      if (target) {
        return target;
      }
    }
    return null;
  };

  const getOverrideFlags = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return { event: false, trap: false, pre: false, any: false };
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const targets = processors.map(getProcessorTargetField).filter(Boolean) as string[];
    const event = targets.some((target) => target.startsWith('$.event.'));
    const trap = targets.some((target) => target.startsWith('$.trap.') || target.includes('trap.variables'));
    const pre = targets.some((target) => target.startsWith('$.preProcessors'));
    return { event, trap, pre, any: event || trap || pre };
  };

  const getOverrideTargets = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return new Set<string>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const targets = processors.map(getProcessorTargetField).filter(Boolean) as string[];
    return new Set<string>(targets);
  };

  const getOverrideValueMap = (obj: any) => {
    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return new Map<string, any>();
    }
    const overrides = overrideIndex.get(objectName) || [];
    const processors = overrides.flatMap((entry: any) => (Array.isArray(entry?.processors) ? entry.processors : []));
    const map = new Map<string, any>();
    processors.forEach((processor: any) => {
      const target = processor?.set?.targetField;
      if (target) {
        map.set(target, processor.set.source);
      }
    });
    return map;
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
    eventFields.forEach((field) => {
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

  const eventFields = ['Summary', 'Severity', 'EventType', 'EventCategory', 'ExpireTime'] as const;

  const getEditableValue = (value: any) => {
    if (value === null || value === undefined) {
      return { editable: true, display: '' };
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return { editable: true, display: String(value) };
    }
    if (typeof value === 'object' && typeof value.eval === 'string') {
      return { editable: false, display: value.eval };
    }
    return { editable: false, display: JSON.stringify(value) };
  };

  const startEventEdit = (obj: any, key: string) => {
    const draft: Record<string, any> = {};
    eventFields.forEach((field) => {
      const value = getEffectiveEventValue(obj, field);
      const { display } = getEditableValue(value);
      draft[field] = display;
    });
    setPanelDrafts((prev) => ({
      ...prev,
      [key]: { event: draft },
    }));
    setPanelEditState((prev) => ({ ...prev, [key]: true }));
  };

  const cancelEventEdit = (key: string) => {
    setPanelDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setPanelEditState((prev) => ({ ...prev, [key]: false }));
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
    const draft = panelDrafts?.[key]?.event || {};
    const removalFields = new Set(panelOverrideRemovals[key] || []);
    const updates: { field: string; value: any }[] = [];
    eventFields.forEach((field) => {
      const original = getEffectiveEventValue(obj, field);
      const draftValue = draft[field];
      const { display } = getEditableValue(original);
      if (String(draftValue ?? '') !== String(display ?? '')) {
        let value: any = draftValue;
        if (draftValue !== '' && !Number.isNaN(Number(draftValue)) && field !== 'Summary') {
          value = Number(draftValue);
        }
        updates.push({ field, value });
      }
    });

    if (updates.length === 0 && removalFields.size === 0) {
      cancelEventEdit(key);
      return;
    }

    const objectName = obj?.['@objectName'];
    if (!objectName) {
      return;
    }

    const existingOverrides = Array.isArray(overrideInfo?.overrides) ? [...overrideInfo.overrides] : [];
    const method = overrideInfo?.method || (String(selectedFile.PathID || '').includes('/syslog/') ? 'syslog' : 'trap');
    const scope = 'post';
    const matchIndex = existingOverrides.findIndex((entry: any) => (
      entry?.['@objectName'] === objectName && entry?.method === method && entry?.scope === scope
    ));

    const overrideEntry = matchIndex >= 0
      ? { ...existingOverrides[matchIndex] }
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

    if (removalFields.size > 0) {
      processors = processors.filter((proc: any) => {
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
      const existingIdx = processors.findIndex((proc: any) => {
        const target = getProcessorTargetField(proc);
        return target === targetField && proc?.set;
      });
      const newProcessor = buildOverrideSetProcessor(field, value);
      if (existingIdx >= 0) {
        processors[existingIdx] = newProcessor;
      } else {
        processors.push(newProcessor);
      }
    });

    if (processors.length === 0) {
      if (matchIndex >= 0) {
        existingOverrides.splice(matchIndex, 1);
      }
    } else {
      overrideEntry.processors = processors;
      if (matchIndex >= 0) {
        existingOverrides[matchIndex] = overrideEntry;
      } else {
        existingOverrides.push(overrideEntry);
      }
    }

    setPendingOverrideSave(existingOverrides);
    setCommitMessage('');
    setShowCommitModal(true);
    setPanelNavWarning((prev) => {
      if (!prev.fields[key]) {
        return prev;
      }
      const nextFields = { ...prev.fields };
      delete nextFields[key];
      return { ...prev, fields: nextFields };
    });
  };

  const openRemoveOverrideModal = (obj: any, field: string, panelKey: string) => {
    const original = obj?.event?.[field];
    const { display } = getEditableValue(original);
    setRemoveOverrideModal({
      open: true,
      objectName: obj?.['@objectName'],
      field,
      baseValue: display || '—',
      panelKey,
    });
  };

  const confirmRemoveOverride = () => {
    if (!removeOverrideModal.objectName || !removeOverrideModal.field || !removeOverrideModal.panelKey) {
      setRemoveOverrideModal({ open: false });
      return;
    }

    const panelKey = removeOverrideModal.panelKey;
    const field = removeOverrideModal.field;

    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      const list = new Set(next[panelKey] || []);
      list.add(field);
      next[panelKey] = Array.from(list);
      return next;
    });

    if (!panelEditState[panelKey]) {
      const objKey = panelKey.replace(/:event$/, '');
      const objects = getFriendlyObjects(fileData);
      const obj = objects.find((item: any, idx: number) => getObjectKey(item, idx) === objKey);
      if (obj) {
        startEventEdit(obj, panelKey);
      }
    }

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

    setRemoveOverrideModal({ open: false });
  };

  const openRemoveAllOverridesModal = (obj: any, panelKey: string) => {
    const fields = getEventOverrideFields(obj);
    if (fields.length === 0) {
      return;
    }
    const baseValues: Record<string, string> = {};
    fields.forEach((field) => {
      const original = obj?.event?.[field];
      const { display } = getEditableValue(original);
      baseValues[field] = display || '—';
    });
    setRemoveAllOverridesModal({
      open: true,
      panelKey,
      fields,
      baseValues,
    });
  };

  const confirmRemoveAllOverrides = () => {
    if (!removeAllOverridesModal.panelKey || !removeAllOverridesModal.fields) {
      setRemoveAllOverridesModal({ open: false });
      return;
    }

    const panelKey = removeAllOverridesModal.panelKey;
    const fields = removeAllOverridesModal.fields;

    setPanelOverrideRemovals((prev) => {
      const next = { ...prev };
      const list = new Set(next[panelKey] || []);
      fields.forEach((field) => list.add(field));
      next[panelKey] = Array.from(list);
      return next;
    });

    if (!panelEditState[panelKey]) {
      const objKey = panelKey.replace(/:event$/, '');
      const objects = getFriendlyObjects(fileData);
      const obj = objects.find((item: any, idx: number) => getObjectKey(item, idx) === objKey);
      if (obj) {
        startEventEdit(obj, panelKey);
      }
    }

    setPanelDrafts((prev) => {
      const next = { ...prev };
      const current = next[panelKey]?.event || {};
      const baseValues = removeAllOverridesModal.baseValues || {};
      const merged = { ...current };
      fields.forEach((field) => {
        merged[field] = baseValues[field] ?? '';
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

  const scrollToMatchIndex = (index: number) => {
    if (index < 0 || index >= highlightObjectKeys.length) {
      return;
    }
    const key = highlightObjectKeys[index];
    scrollToRef(objectRowRefs.current[key]);
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
        <span key={`match-${idx}`} className="match-highlight">
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

  const renderValue = (value: any) => {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return renderHighlightedText(String(value));
    }
    if (value && typeof value === 'object' && typeof value.eval === 'string') {
      return renderEvalDisplay(value.eval);
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

  const handleVarInsertSelect = (token: string) => {
    if (!varInsertContext) {
      return;
    }
    const { panelKey, field, value, replaceStart, replaceEnd } = varInsertContext;
    const nextValue = `${value.slice(0, replaceStart)}${token}${value.slice(replaceEnd)}`;
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
    setVarModalOpen(false);
    setVarModalMode('view');
    setVarInsertContext(null);
    setVarModalToken(null);
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
    if (!match) {
      return;
    }
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
  };

  const renderSummary = (value: any, trapVars: any[]) => {
    const text = getEvalText(value) || (typeof value === 'string' ? value : '—');
    if (!text || text === '—') {
      return text;
    }
    const parts = text.split(/(\$v\d+)/g);
    return (
      <span>
        {parts.map((part: string, index: number) => {
          if (!part.match(/^\$v\d+$/)) {
            return <span key={`text-${index}`}>{renderHighlightedText(part)}</span>;
          }
          return (
            <button
              key={`var-${index}`}
              type="button"
              className="var-token"
              onClick={() => {
                setVarModalToken(part);
                setVarModalVars(Array.isArray(trapVars) ? trapVars : []);
                setVarModalMode('view');
                setVarInsertContext(null);
                setVarModalOpen(true);
              }}
            >
              {part}
            </button>
          );
        })}
      </span>
    );
  };

  useEffect(() => {
    if (!varModalOpen || !varModalToken) {
      return;
    }
    scrollToRef(varRowRefs.current[varModalToken]);
  }, [varModalOpen, varModalToken, varModalVars]);

  useEffect(() => {
    if (!highlightQuery || !selectedFile || !searchHighlightActive) {
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
      return;
    }
    const query = highlightQuery.toLowerCase();
    const objects = getFriendlyObjects(fileData);
    const matches: string[] = [];
    objects.forEach((obj: any, idx: number) => {
      try {
        const text = JSON.stringify(obj).toLowerCase();
        if (text.includes(query)) {
          matches.push(getObjectKey(obj, idx));
        }
      } catch {
        // ignore
      }
    });
    setHighlightObjectKeys(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : 0);
  }, [fileData, highlightQuery, highlightPathId, selectedFile]);

  useEffect(() => {
    if (highlightObjectKeys.length === 0) {
      return;
    }
    scrollToMatchIndex(currentMatchIndex);
  }, [currentMatchIndex, highlightObjectKeys]);

  useEffect(() => {
    if (!selectedFile) {
      setHighlightQuery(null);
      setHighlightPathId(null);
      setHighlightObjectKeys([]);
      setCurrentMatchIndex(0);
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
    return (
      <details className="trap-vars">
        <summary>{variables.length} variable(s)</summary>
        <div className="trap-vars-list">
          {variables.map((variable: any, index: number) => (
            <div className="trap-var" key={variable?.name || variable?.oid || index}>
              <div className="trap-var-title">
                <span className="trap-var-name">{renderValue(variable?.name)}</span>
                <span className="pill">$v{index + 1}</span>
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
          ))}
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
    setCurrentMatchIndex((prev) => (prev - 1 + highlightObjectKeys.length) % highlightObjectKeys.length);
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
  const renderEvalDisplay = (evalText: string) => {
    try {
      const lines = formatEvalReadableList(evalText);
      return (
        <div className="eval-display">
          <span className="eval-label eval-label-hover" title={evalText}>
            <span className="eval-label-icon">ⓘ</span>
            Eval
          </span>
          <div className="eval-demo eval-demo-lines">
            {lines.map((line, index) => (
              <span key={`${line}-${index}`}>{renderHighlightedText(line)}</span>
            ))}
          </div>
        </div>
      );
    } catch {
      return <span className="eval-fallback">{renderHighlightedText(evalText)}</span>;
    }
  };

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <h1>COM Curation &amp; Management</h1>
          {isAuthenticated && (
            <div className="header-actions">
              <p>Welcome, {session?.user}</p>
              <button type="button" className="logout-button" onClick={handleLogout}>
                <span className="logout-icon" aria-hidden="true">🚪</span>
                Logout
              </button>
            </div>
          )}
        </header>
        <main className="app-main">
        {isAuthenticated ? (
          <div className="split-layout">
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title-row">
                  <h2>File Browser</h2>
                  <button
                    type="button"
                    className="info-button"
                    onClick={() => setShowPathModal(true)}
                    aria-label="Show full path"
                    title="Show full path"
                  >
                    ?
                  </button>
                </div>
                <div className="breadcrumbs">
                  {breadcrumbs.map((crumb, index) => (
                    <button
                      key={`${crumb.label}-${index}`}
                      type="button"
                      className="crumb"
                      onClick={() => handleCrumbClick(index)}
                      disabled={index === breadcrumbs.length - 1}
                    >
                      {crumb.label}
                    </button>
                  ))}
                </div>
                <div className="panel-section">
                  <div className="panel-section-title">Search</div>
                  <form className="global-search" onSubmit={handleSearchSubmit}>
                    <div className="global-search-row">
                      <input
                        type="text"
                        placeholder="Search files and contents"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                      <select
                        value={searchScope}
                        onChange={(e) => setSearchScope(e.target.value as 'all' | 'name' | 'content')}
                      >
                        <option value="all">All</option>
                        <option value="name">Names</option>
                        <option value="content">Content</option>
                      </select>
                      <button type="submit" className="search-button" disabled={searchLoading}>
                        {searchLoading ? 'Searching…' : 'Search'}
                      </button>
                    </div>
                    <div className="search-actions-row">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={handleClearSearch}
                        disabled={!searchQuery && searchResults.length === 0}
                      >
                        Clear Search
                      </button>
                      <button type="button" className="ghost-button" onClick={handleResetNavigation}>
                        Reset Navigation
                      </button>
                    </div>
                  </form>
                </div>
                <div className="panel-section">
                  <div className="panel-section-title">Favorites</div>
                  <div className="favorites-section">
                  <details open={favoritesFolders.length > 0}>
                    <summary>Favorite Folders</summary>
                    {favoritesLoading && <div className="muted">Loading…</div>}
                    {favoritesError && <div className="error">{favoritesError}</div>}
                    {favoritesFolders.length === 0 ? (
                      <div className="empty-state">No favorites yet.</div>
                    ) : (
                      <ul className="favorites-list">
                        {favoritesFolders.map((fav) => (
                          <li key={`${fav.type}-${fav.pathId}`}>
                            <button
                              type="button"
                              className="quick-link"
                              onClick={() => handleOpenFolder({ PathID: fav.pathId, PathName: fav.label })}
                            >
                              {fav.label}
                              {getParentLabel(getParentPath(fav.pathId)) && (
                                <span className="favorite-parent"> - ({getParentLabel(getParentPath(fav.pathId))})</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                  <details open={favoritesFiles.length > 0}>
                    <summary>Favorite Files</summary>
                    {favoritesFiles.length === 0 ? (
                      <div className="empty-state">No favorites yet.</div>
                    ) : (
                      <ul className="favorites-list">
                        {favoritesFiles.map((fav) => (
                          <li key={`${fav.type}-${fav.pathId}`}>
                            <button
                              type="button"
                              className="quick-link"
                              onClick={() => openFileFromUrl(fav.pathId, fav.node)}
                            >
                              {fav.label}
                              {fav.node && (
                                <span className="favorite-parent"> - ({getParentLabel(fav.node)})</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                  </div>
                </div>
              </div>
              {searchQuery.trim() && (
                <div className="search-results">
                  <div className="search-results-header">
                    <span>Search results ({searchResults.length})</span>
                    {searchLoading && <span className="muted">Searching…</span>}
                  </div>
                  {searchError && <div className="error">{searchError}</div>}
                  {!searchLoading && !searchError && searchResults.length === 0 && (
                    <div className="empty-state">No matches found.</div>
                  )}
                  {searchResults.length > 0 && (
                    <ul className="search-results-list">
                      {searchResults.map((result: any) => (
                        <li key={`${result.pathId}-${result.source}`}>
                          <button
                            type="button"
                            className="search-result-link"
                            onClick={() => {
                              highlightNextOpenRef.current = true;
                              setHighlightQuery(searchQuery.trim());
                              setHighlightPathId(result.pathId);
                              setSearchHighlightActive(true);
                              if (result.type === 'folder') {
                                void handleOpenFolder({
                                  PathID: result.pathId,
                                  PathName: getSearchResultName(result),
                                });
                              } else {
                                void openFileFromUrl(result.pathId);
                              }
                            }}
                          >
                            <span className="search-icon" aria-hidden="true">
                              {result.type === 'folder' ? '📁' : '📄'}
                            </span>
                            {getSearchResultName(result)}
                          </button>
                          <div className="search-result-meta">
                            <span className="search-result-path">{formatDisplayPath(result.pathId)}</span>
                            {result.matchCount && (
                              <span className="pill">{result.matchCount} hit{result.matchCount > 1 ? 's' : ''}</span>
                            )}
                            <span className="pill">{result.source}</span>
                          </div>
                          {result.matches?.length > 0 && (
                            <div className="search-snippet">
                              <span className="muted">L{result.matches[0].line}:</span> {result.matches[0].preview}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {browseError && <div className="error">{browseError}</div>}
              {browseData && (
                <div className="browse-results">
                  {entries.length > 0 ? (
                    <ul className="browse-list">
                      {entries.map((entry: any) => (
                        <li key={entry.PathID || entry.PathName}>
                          {isFolder(entry) ? (
                            <button
                              type="button"
                              className="browse-link"
                              onClick={() => handleOpenFolder(entry)}
                            >
                              <span className="browse-icon" aria-hidden="true">📁</span>
                              {entry.PathName}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="browse-link file-link"
                              onClick={() => handleOpenFile(entry)}
                            >
                              <span className="browse-icon" aria-hidden="true">📄</span>
                              {entry.PathName}
                            </button>
                          )}
                          <span className="browse-meta">
                            {entry.Info || ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <pre>{JSON.stringify(browseData, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
            <div className="panel">
              <div className="panel-header">
                <h2>File Details</h2>
              </div>
              {!selectedFile && !selectedFolder ? (
                <div className="empty-state">Select a file to preview.</div>
              ) : selectedFolder && !selectedFile ? (
                <div className="file-details">
                  <div className="file-title">
                    <strong>
                      {selectedFolder.PathName}
                      <button
                        type="button"
                        className={`star-button ${isFavorite(selectedFolder.PathID, 'folder') ? 'star-active' : ''}`}
                        onClick={() => toggleFavorite({
                          type: 'folder',
                          pathId: selectedFolder.PathID,
                          label: selectedFolder.PathName,
                          node: selectedFolder.PathID,
                        })}
                        aria-label="Toggle favorite folder"
                        title="Toggle favorite folder"
                      >
                        ★
                      </button>
                    </strong>
                    <span className="file-path">{formatDisplayPath(selectedFolder.PathID)}</span>
                  </div>
                  {folderLoading ? (
                    <div>Loading folder overview…</div>
                  ) : folderOverview ? (
                    <div className="folder-overview">
                      {folderOverview.fileCount > 0 ? (
                        <>
                          <div className="folder-summary">
                            <div>
                              <span className="label">Files</span>
                              <span className="value">{folderOverview.fileCount}</span>
                            </div>
                            <div>
                              <span className="label">Objects</span>
                              <span className="value">{folderOverview.objectCount}</span>
                            </div>
                            <div>
                              <span className="label">Schema Errors</span>
                              <span className="value">{folderOverview.schemaErrorCount}</span>
                            </div>
                            <div>
                              <span className="label">Unknown Fields</span>
                              <span className="value">{folderOverview.unknownFieldCount}</span>
                            </div>
                          </div>
                          <div className="folder-table">
                            <div className="folder-table-header">
                              <span>File</span>
                              <span>Schema Errors</span>
                              <span>Unknown Fields</span>
                            </div>
                            {folderOverview.topFiles?.length ? (
                              folderOverview.topFiles.map((row: any) => (
                                <div className="folder-table-row" key={row.pathId}>
                                  <button
                                    type="button"
                                    className="folder-link"
                                    onClick={() => openFileFromUrl(row.pathId)}
                                  >
                                    {row.file}
                                  </button>
                                  <span>{row.schemaErrors}</span>
                                  <span>{row.unknownFields}</span>
                                </div>
                              ))
                            ) : (
                              <div className="empty-state">No files with issues.</div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="empty-state">No JSON files in this folder.</div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-state">No overview available.</div>
                  )}
                </div>
              ) : (
                <div className="file-details">
                  <div className="file-title">
                    <strong>
                      {selectedFile.PathName}
                      <button
                        type="button"
                        className={`star-button ${isFavorite(selectedFile.PathID, 'file') ? 'star-active' : ''}`}
                        onClick={() => toggleFavorite({
                          type: 'file',
                          pathId: selectedFile.PathID,
                          label: selectedFile.PathName,
                          node: browseNode || undefined,
                        })}
                        aria-label="Toggle favorite file"
                        title="Toggle favorite file"
                      >
                        ★
                      </button>
                    </strong>
                    <span className="file-path">{formatDisplayPath(selectedFile.PathID)}</span>
                  </div>
                  <div className="file-meta-row">
                    <span>
                      Revision:{' '}
                      {selectedFile.LastRevision && /^[0-9]+$/.test(String(selectedFile.LastRevision))
                        ? `r${selectedFile.LastRevision}`
                        : selectedFile.LastRevision || '—'}
                    </span>
                    <span>Modified: {selectedFile.ModificationTime || '—'}</span>
                    <span>Checkouts: {selectedFile.Checkouts || '0'}</span>
                    <span className="schema-status">
                      {schemaLoading && <span>Schema: Loading…</span>}
                      {schemaError && (
                        <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
                          Schema: Error
                        </button>
                      )}
                      {!schemaLoading && !schemaError && !validator && (
                        <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
                          Schema: Not available
                        </button>
                      )}
                      {!schemaLoading && !schemaError && validator && !jsonParseError && validationErrors.length === 0 && (
                        <span className="schema-valid" aria-label="Schema validated">
                          Schema: ✓
                        </span>
                      )}
                      {!schemaLoading && !schemaError && validator && (jsonParseError || validationErrors.length > 0) && (
                        <button type="button" className="schema-issue" onClick={() => setShowSchemaModal(true)}>
                          Schema: {jsonParseError ? 'JSON error' : `${validationErrors.length} issue(s)`}
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="action-row">
                    <div className="view-toggle">
                      <span className={viewMode === 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
                        Friendly
                      </span>
                      <label className="switch" aria-label="Toggle friendly/raw view">
                        <input
                          type="checkbox"
                          checked={viewMode !== 'friendly'}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setViewMode('preview');
                            } else {
                              setViewMode('friendly');
                            }
                          }}
                        />
                        <span className="slider" />
                      </label>
                      <span className={viewMode !== 'friendly' ? 'view-toggle-label active' : 'view-toggle-label'}>
                        Raw
                      </span>
                    </div>
                    {canEditRules && viewMode === 'friendly' && (
                      <button
                        type="button"
                        className={panelEditEnabled ? 'tab-active' : 'tab'}
                        onClick={() => setPanelEditEnabled((prev) => !prev)}
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  {fileError && <div className="error">{fileError}</div>}
                  {saveError && <div className="error">{saveError}</div>}
                  {saveSuccess && <div className="success">{saveSuccess}</div>}
                  <div className="file-preview">
                    {fileLoading ? (
                      <div>Loading preview…</div>
                    ) : (
                      viewMode === 'friendly' ? (
                        <div className="friendly-view">
                          {searchHighlightActive && highlightObjectKeys.length > 0 && (
                            <div className="match-bar">
                              <span className="match-label">
                                Match {currentMatchIndex + 1} of {highlightObjectKeys.length}
                              </span>
                              <div className="match-actions">
                                <button type="button" className="match-button" onClick={handlePrevMatch}>
                                  Prev
                                </button>
                                <button type="button" className="match-button" onClick={handleNextMatch}>
                                  Next
                                </button>
                              </div>
                            </div>
                          )}
                          {getFriendlyObjects(fileData).length === 0 ? (
                            <div className="empty-state">No objects found.</div>
                          ) : (
                            getFriendlyObjects(fileData).map((obj: any, idx: number) => {
                              const overrideFlags = getOverrideFlags(obj);
                              const overrideTargets = getOverrideTargets(obj);
                              const overrideValueMap = getOverrideValueMap(obj);
                              const objectKey = getObjectKey(obj, idx);
                              const eventPanelKey = `${objectKey}:event`;
                              const eventOverrideFields = getEventOverrideFields(obj);
                              return (
                              <div
                                className={`object-card${highlightObjectKeys.includes(getObjectKey(obj, idx))
                                  ? ' object-card-highlight'
                                  : ''}${searchHighlightActive && highlightObjectKeys.length > 0 &&
                                    !highlightObjectKeys.includes(getObjectKey(obj, idx))
                                    ? ' object-card-dim'
                                    : ''}`}
                                key={obj?.['@objectName'] || idx}
                                ref={(el) => {
                                  objectRowRefs.current[objectKey] = el;
                                }}
                              >
                                <div className="object-header">
                                  <div className="object-title">
                                    <span className="object-name">{obj?.['@objectName'] || `Object ${idx + 1}`}</span>
                                    {obj?.certification && <span className="pill">{obj.certification}</span>}
                                    {overrideFlags.any && <span className="pill override-pill">Override</span>}
                                    {highlightObjectKeys.includes(getObjectKey(obj, idx)) && (
                                      <span className="pill match-pill">Match</span>
                                    )}
                                  </div>
                                  {obj?.description && <div className="object-description">{obj.description}</div>}
                                </div>
                                <div
                                  className={`object-panel${panelEditState[eventPanelKey]
                                    ? ' object-panel-editing'
                                    : ''}`}
                                >
                                  <div className="object-panel-header">
                                    <div className="panel-title-group">
                                      <span className="object-panel-title">Event</span>
                                    </div>
                                    {canEditRules && panelEditEnabled && !panelEditState[eventPanelKey] && (
                                      <button
                                        type="button"
                                        className="panel-edit-button"
                                        onClick={() => startEventEdit(obj, eventPanelKey)}
                                      >
                                        Edit
                                      </button>
                                    )}
                                    {canEditRules && panelEditEnabled && panelEditState[eventPanelKey] && (
                                      <div className="panel-edit-actions">
                                        {eventOverrideFields.length > 1 && (
                                          <button
                                            type="button"
                                            className="override-remove-all-button"
                                            onClick={() => openRemoveAllOverridesModal(obj, eventPanelKey)}
                                          >
                                            Remove All Overrides
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          className="panel-edit-button"
                                          onClick={() => saveEventEdit(obj, eventPanelKey)}
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="panel-edit-button"
                                          onClick={() => cancelEventEdit(eventPanelKey)}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="object-grid">
                                    <div className="object-row object-row-primary">
                                      <div>
                                        <span className="label">Node</span>
                                        <span className="value">{renderValue(obj?.event?.Node)}</span>
                                      </div>
                                      <div>
                                        <span className={isFieldHighlighted(eventPanelKey, 'Summary')
                                          ? 'label label-warning'
                                          : 'label'}>
                                          Summary
                                          {overrideTargets.has('$.event.Summary') && (
                                            <span className="pill override-pill pill-inline pill-action">
                                              Override
                                              {canEditRules && panelEditEnabled && overrideValueMap.has('$.event.Summary') && (
                                                <button
                                                  type="button"
                                                  className="pill-close"
                                                  aria-label="Remove Summary override"
                                                  onClick={() => openRemoveOverrideModal(obj, 'Summary', eventPanelKey)}
                                                >
                                                  ×
                                                </button>
                                              )}
                                            </span>
                                          )}
                                        </span>
                                        {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                          (() => {
                                            const value = getEffectiveEventValue(obj, 'Summary');
                                            const editable = getEditableValue(value);
                                            return (
                                              <input
                                                className={isFieldHighlighted(eventPanelKey, 'Summary')
                                                  ? 'panel-input panel-input-warning'
                                                  : 'panel-input'}
                                                value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.Summary ?? ''}
                                                onChange={(e) => handleEventInputChange(
                                                  obj,
                                                  eventPanelKey,
                                                  'Summary',
                                                  e.target.value,
                                                  e.target.selectionStart,
                                                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                                                )}
                                                disabled={!editable.editable}
                                                title={editable.editable ? '' : 'Eval values cannot be edited yet'}
                                              />
                                            );
                                          })()
                                        ) : (
                                          <span className="value">
                                            {renderSummary(
                                              overrideValueMap.get('$.event.Summary') ?? obj?.event?.Summary,
                                              obj?.trap?.variables,
                                            )}
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <span className={isFieldHighlighted(eventPanelKey, 'Severity')
                                          ? 'label label-warning'
                                          : 'label'}>
                                          Severity
                                          {overrideTargets.has('$.event.Severity') && (
                                            <span className="pill override-pill pill-inline pill-action">
                                              Override
                                              {canEditRules && panelEditEnabled && overrideValueMap.has('$.event.Severity') && (
                                                <button
                                                  type="button"
                                                  className="pill-close"
                                                  aria-label="Remove Severity override"
                                                  onClick={() => openRemoveOverrideModal(obj, 'Severity', eventPanelKey)}
                                                >
                                                  ×
                                                </button>
                                              )}
                                            </span>
                                          )}
                                        </span>
                                        {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                          <input
                                            className={isFieldHighlighted(eventPanelKey, 'Severity')
                                              ? 'panel-input panel-input-warning'
                                              : 'panel-input'}
                                            value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.Severity ?? ''}
                                            onChange={(e) => handleEventInputChange(
                                              obj,
                                              eventPanelKey,
                                              'Severity',
                                              e.target.value,
                                              e.target.selectionStart,
                                              (e.nativeEvent as InputEvent | undefined)?.inputType,
                                            )}
                                          />
                                        ) : (
                                          <span className="value">
                                            {renderValue(overrideValueMap.get('$.event.Severity') ?? obj?.event?.Severity)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="object-row object-row-secondary">
                                      <div>
                                        <span className={isFieldHighlighted(eventPanelKey, 'EventType')
                                          ? 'label label-warning'
                                          : 'label'}>
                                          Event Type
                                          {overrideTargets.has('$.event.EventType') && (
                                            <span className="pill override-pill pill-inline pill-action">
                                              Override
                                              {canEditRules && panelEditEnabled && overrideValueMap.has('$.event.EventType') && (
                                                <button
                                                  type="button"
                                                  className="pill-close"
                                                  aria-label="Remove Event Type override"
                                                  onClick={() => openRemoveOverrideModal(obj, 'EventType', eventPanelKey)}
                                                >
                                                  ×
                                                </button>
                                              )}
                                            </span>
                                          )}
                                        </span>
                                        {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                          <input
                                            className={isFieldHighlighted(eventPanelKey, 'EventType')
                                              ? 'panel-input panel-input-warning'
                                              : 'panel-input'}
                                            value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.EventType ?? ''}
                                            onChange={(e) => handleEventInputChange(
                                              obj,
                                              eventPanelKey,
                                              'EventType',
                                              e.target.value,
                                              e.target.selectionStart,
                                              (e.nativeEvent as InputEvent | undefined)?.inputType,
                                            )}
                                          />
                                        ) : (
                                          <span className="value">
                                            {renderValue(overrideValueMap.get('$.event.EventType') ?? obj?.event?.EventType)}
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <span className={isFieldHighlighted(eventPanelKey, 'ExpireTime')
                                          ? 'label label-warning'
                                          : 'label'}>
                                          Expire Time
                                          {overrideTargets.has('$.event.ExpireTime') && (
                                            <span className="pill override-pill pill-inline pill-action">
                                              Override
                                              {canEditRules && panelEditEnabled && overrideValueMap.has('$.event.ExpireTime') && (
                                                <button
                                                  type="button"
                                                  className="pill-close"
                                                  aria-label="Remove Expire Time override"
                                                  onClick={() => openRemoveOverrideModal(obj, 'ExpireTime', eventPanelKey)}
                                                >
                                                  ×
                                                </button>
                                              )}
                                            </span>
                                          )}
                                        </span>
                                        {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                          <input
                                            className={isFieldHighlighted(eventPanelKey, 'ExpireTime')
                                              ? 'panel-input panel-input-warning'
                                              : 'panel-input'}
                                            value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.ExpireTime ?? ''}
                                            onChange={(e) => handleEventInputChange(
                                              obj,
                                              eventPanelKey,
                                              'ExpireTime',
                                              e.target.value,
                                              e.target.selectionStart,
                                              (e.nativeEvent as InputEvent | undefined)?.inputType,
                                            )}
                                          />
                                        ) : (
                                          <span className="value">
                                            {renderValue(overrideValueMap.get('$.event.ExpireTime') ?? obj?.event?.ExpireTime)}
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <span className={isFieldHighlighted(eventPanelKey, 'EventCategory')
                                          ? 'label label-warning'
                                          : 'label'}>
                                          Event Category
                                          {overrideTargets.has('$.event.EventCategory') && (
                                            <span className="pill override-pill pill-inline pill-action">
                                              Override
                                              {canEditRules && panelEditEnabled && overrideValueMap.has('$.event.EventCategory') && (
                                                <button
                                                  type="button"
                                                  className="pill-close"
                                                  aria-label="Remove Event Category override"
                                                  onClick={() => openRemoveOverrideModal(obj, 'EventCategory', eventPanelKey)}
                                                >
                                                  ×
                                                </button>
                                              )}
                                            </span>
                                          )}
                                        </span>
                                        {panelEditState[`${getObjectKey(obj, idx)}:event`] ? (
                                          <input
                                            className={isFieldHighlighted(eventPanelKey, 'EventCategory')
                                              ? 'panel-input panel-input-warning'
                                              : 'panel-input'}
                                            value={panelDrafts?.[`${getObjectKey(obj, idx)}:event`]?.event?.EventCategory ?? ''}
                                            onChange={(e) => handleEventInputChange(
                                              obj,
                                              eventPanelKey,
                                              'EventCategory',
                                              e.target.value,
                                              e.target.selectionStart,
                                              (e.nativeEvent as InputEvent | undefined)?.inputType,
                                            )}
                                          />
                                        ) : (
                                          <span className="value">
                                            {renderValue(overrideValueMap.get('$.event.EventCategory') ?? obj?.event?.EventCategory)}
                                          </span>
                                        )}
                                      </div>
                                      <div>
                                        <span className="label">OID</span>
                                        <span className="value monospace">{renderValue(obj?.trap?.oid)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div
                                  className={`object-panel${panelEditState[`${getObjectKey(obj, idx)}:pre`]
                                    ? ' object-panel-editing'
                                    : ''}`}
                                >
                                  <div className="object-panel-header">
                                    <span className="object-panel-title">PreProcessors</span>
                                  </div>
                                  <div className="object-panel-body">
                                    {renderValue(obj?.preProcessors)}
                                  </div>
                                </div>
                                <div
                                  className={`object-panel${panelEditState[`${getObjectKey(obj, idx)}:trap`]
                                    ? ' object-panel-editing'
                                    : ''}`}
                                >
                                  <div className="object-panel-header">
                                    <span className="object-panel-title">Trap Variables</span>
                                  </div>
                                  <div className="object-panel-body">
                                    {renderTrapVariables(obj?.trap?.variables)}
                                  </div>
                                </div>
                              </div>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <pre>{JSON.stringify(getPreviewContent(fileData), null, 2)}</pre>
                      )
                    )}
                  </div>
                  {showCommitModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Commit message</h3>
                        <input
                          type="text"
                          placeholder="Enter commit message here"
                          value={commitMessage}
                          onChange={(e) => setCommitMessage(e.target.value)}
                        />
                        <div className="modal-actions">
                          <button type="button" onClick={() => {
                            setPendingOverrideSave(null);
                            setShowCommitModal(false);
                          }}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (pendingOverrideSave) {
                                handleSaveOverrides(commitMessage);
                              } else {
                                handleSaveFile(commitMessage);
                              }
                              setShowCommitModal(false);
                            }}
                            disabled={saveLoading}
                          >
                            {saveLoading ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {removeOverrideModal.open && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Remove override</h3>
                        <p>Removing this override will default to original value:</p>
                        <pre className="code-block">{removeOverrideModal.baseValue ?? '—'}</pre>
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
                        <p>Removing these overrides will default to original values:</p>
                        <pre className="code-block">{JSON.stringify(removeAllOverridesModal.baseValues ?? {}, null, 2)}</pre>
                        <p>Are you sure?</p>
                        <div className="modal-actions">
                          <button type="button" onClick={() => setRemoveAllOverridesModal({ open: false })}>
                            No
                          </button>
                          <button type="button" onClick={confirmRemoveAllOverrides}>
                            Yes
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {showSchemaModal && (
                    <div className="modal-overlay" role="dialog" aria-modal="true">
                      <div className="modal">
                        <h3>Schema issues</h3>
                        {schemaError && <div className="error">Schema: {schemaError}</div>}
                        {!schemaError && !validator && (
                          <div className="error">Schema not available</div>
                        )}
                        {!schemaError && validator && jsonParseError && (
                          <div className="error">JSON: {jsonParseError}</div>
                        )}
                        {!schemaError && validator && !jsonParseError && validationErrors.length > 0 && (
                          <ul>
                            {validationErrors.map((err, idx) => (
                              <li key={`${err.path}-${idx}`}>
                                <span className="validation-path">{err.path}</span>
                                <span className="validation-message">{err.message}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="modal-actions">
                          <button type="button" onClick={() => setShowSchemaModal(false)}>
                            Close
                          </button>
                        </div>
                      </div>
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
                </div>
              )}
            </div>
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
                  <div className="index-status">
                    <div className="index-status-header">Search Index Status</div>
                    {searchRebuildPending || searchStatus?.isBuilding ? (
                      <span className="muted">Index rebuilding…</span>
                    ) : searchStatus?.lastBuiltAt ? (
                      <span className="muted">
                        Indexed {searchStatus.counts?.files || 0} files · Last refresh {formatTime(searchStatus.lastBuiltAt)}
                        {searchStatus?.nextRefreshAt
                          ? ` · Next refresh ${formatTime(searchStatus.nextRefreshAt)}`
                          : ''}
                      </span>
                    ) : (
                      <span className="muted">Index warming…</span>
                    )}
                    <div className="index-status-actions">
                      <button type="button" className="link-button" onClick={refreshSearchStatus}>
                        Refresh status
                      </button>
                      <button
                        type="button"
                        className="link-button"
                        onClick={handleRebuildIndex}
                        disabled={searchStatus?.isBuilding}
                      >
                        Rebuild index
                      </button>
                    </div>
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
              <div className="modal-overlay" role="dialog" aria-modal="true">
                <div className="modal modal-wide">
                  <h3>Trap variables {varModalToken ? `for ${varModalToken}` : ''}</h3>
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
          </div>
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
        </main>
      </div>
    </ErrorBoundary>
  );
}

export default App;
