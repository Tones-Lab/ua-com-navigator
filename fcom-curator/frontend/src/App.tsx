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
  const [viewMode, setViewMode] = useState<'friendly' | 'preview' | 'edit'>('preview');
  const [originalText, setOriginalText] = useState('');
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [testSaveCount, setTestSaveCount] = useState(0);
  const [schema, setSchema] = useState<any>(null);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ path: string; message: string }>>([]);
  const [jsonParseError, setJsonParseError] = useState<string | null>(null);
  const urlHydrated = useRef(false);
  const [varModalOpen, setVarModalOpen] = useState(false);
  const [varModalToken, setVarModalToken] = useState<string | null>(null);
  const [varModalVars, setVarModalVars] = useState<any[]>([]);
  const varListRef = useRef<HTMLDivElement | null>(null);
  const varRowRefs = useRef<Record<string, HTMLDivElement | null>>({});

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
        setSchemaError(err?.response?.data?.error || 'Failed to load schema');
      } finally {
        setSchemaLoading(false);
      }
    };
    loadSchema();
  }, [isAuthenticated, schema, schemaLoading]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    const loadStatus = async () => {
      try {
        const resp = await api.getSearchStatus();
        setSearchStatus(resp.data);
      } catch {
        // ignore status errors
      }
    };
    loadStatus();
    return () => {
      if (searchStatusPollRef.current !== null) {
        window.clearInterval(searchStatusPollRef.current);
      }
    };
  }, [isAuthenticated]);

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

    if (viewParam === 'friendly' || viewParam === 'preview' || viewParam === 'edit') {
      setViewMode(viewParam);
    }

    if (fileParam) {
      void openFileFromUrl(fileParam, nodeParam);
      return;
    }

    if (nodeParam) {
      setBreadcrumbs(buildBreadcrumbsFromNode(nodeParam));
      void loadNodeInternal(nodeParam);
    }
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
      setSession(resp.data);
    } catch (err: any) {
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
      setSelectedFile(null);
      setFileData(null);
      setEntries([]);
      setBrowseData(null);
      setBrowseNode(null);
      setBreadcrumbs([{ label: '/', node: null }]);
      setViewMode('preview');
    }
  };

  const confirmDiscardIfDirty = (action: () => void) => {
    if (viewMode === 'edit' && editorText !== originalText) {
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
    setFileLoading(true);
    if (entry?.PathID) {
      setBreadcrumbs(buildBreadcrumbsFromPath(entry.PathID));
    }
    try {
      const resp = await api.readFile(entry.PathID);
      setFileData(resp.data);
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

  const handleTestSave = async () => {
    if (!editorText.trim()) {
      return;
    }
    try {
      const parsed = JSON.parse(editorText);
      const firstObject = parsed?.objects?.[0];
      if (firstObject?.event?.Summary) {
        firstObject.event.Summary = `${firstObject.event.Summary}x`;
      } else if (firstObject?.Summary) {
        firstObject.Summary = `${firstObject.Summary}x`;
      } else if (firstObject?.event) {
        firstObject.event.Summary = 'x';
      }
      const updatedText = JSON.stringify(parsed, null, 2);
      const nextCount = testSaveCount + 1;
      setTestSaveCount(nextCount);
      setEditorText(updatedText);
      const commit = 'test save';
      setCommitMessage(commit);
      await saveWithContent(parsed, commit);
    } catch {
      setSaveError('Test save failed: invalid JSON');
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

  const renderSummary = (value: any, trapVars: any[]) => {
    const text = getEvalText(value) || (typeof value === 'string' ? value : '—');
    if (!text || text === '—') {
      return text;
    }
    const parts = text.split(/(\$v\d+)/g);
    return (
      <span>
        {parts.map((part, index) => {
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

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <h1>COM Curation & Management</h1>
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
                      {viewMode === 'edit' && editorText !== originalText && (
                        <span className="unsaved-indicator" title="Unsaved changes">
                          ● Unsaved
                        </span>
                      )}
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
                  </div>
                  <div className="action-row">
                    <button
                      type="button"
                      className={viewMode === 'friendly' ? 'tab-active' : 'tab'}
                      onClick={() => setViewMode('friendly')}
                    >
                      Friendly
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'preview' ? 'tab-active' : 'tab'}
                      onClick={() => setViewMode('preview')}
                    >
                      Raw
                    </button>
                    <button
                      type="button"
                      className={viewMode === 'edit' ? 'tab-active' : 'tab'}
                      onClick={() => setViewMode('edit')}
                    >
                      Edit
                    </button>
                    {viewMode === 'edit' && (
                      <button
                        type="button"
                        className="save-button"
                        onClick={() => {
                          setCommitMessage('');
                          setShowCommitModal(true);
                        }}
                        disabled={editorText === originalText}
                      >
                        Save
                      </button>
                    )}
                    {viewMode === 'edit' && (
                      <button
                        type="button"
                        className="test-save-button"
                        onClick={handleTestSave}
                        disabled={saveLoading}
                      >
                        Test Save
                      </button>
                    )}
                  </div>
                  {fileError && <div className="error">{fileError}</div>}
                  {saveError && <div className="error">{saveError}</div>}
                  {saveSuccess && <div className="success">{saveSuccess}</div>}
                  <div className="validation-summary">
                    {schemaLoading && <span>Schema: Loading…</span>}
                    {schemaError && <span className="error">Schema: {schemaError}</span>}
                    {!schemaLoading && !schemaError && !validator && (
                      <span className="error">Schema: Not available</span>
                    )}
                    {!schemaLoading && !schemaError && validator && !jsonParseError && validationErrors.length === 0 && (
                      <span className="success">Schema: Valid</span>
                    )}
                    {!schemaLoading && !schemaError && validator && jsonParseError && (
                      <span className="error">JSON: {jsonParseError}</span>
                    )}
                    {!schemaLoading && !schemaError && validator && !jsonParseError && validationErrors.length > 0 && (
                      <details>
                        <summary className="error">Schema: {validationErrors.length} issue(s)</summary>
                        <ul>
                          {validationErrors.map((err, idx) => (
                            <li key={`${err.path}-${idx}`}>
                              <span className="validation-path">{err.path}</span>
                              <span className="validation-message">{err.message}</span>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <div className="file-preview">
                    {fileLoading ? (
                      <div>Loading preview…</div>
                    ) : (
                      viewMode === 'edit' ? (
                        <div className="editor">
                          <textarea
                            value={editorText}
                            onChange={(e) => setEditorText(e.target.value)}
                          />
                        </div>
                      ) : viewMode === 'friendly' ? (
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
                            getFriendlyObjects(fileData).map((obj: any, idx: number) => (
                              <div
                                className={`object-card${highlightObjectKeys.includes(getObjectKey(obj, idx))
                                  ? ' object-card-highlight'
                                  : ''}${searchHighlightActive && highlightObjectKeys.length > 0 &&
                                    !highlightObjectKeys.includes(getObjectKey(obj, idx))
                                    ? ' object-card-dim'
                                    : ''}`}
                                key={obj?.['@objectName'] || idx}
                                ref={(el) => {
                                  objectRowRefs.current[getObjectKey(obj, idx)] = el;
                                }}
                              >
                                <div className="object-header">
                                  <div className="object-title">
                                    <span className="object-name">{obj?.['@objectName'] || `Object ${idx + 1}`}</span>
                                    {obj?.certification && <span className="pill">{obj.certification}</span>}
                                    {highlightObjectKeys.includes(getObjectKey(obj, idx)) && (
                                      <span className="pill match-pill">Match</span>
                                    )}
                                  </div>
                                  {obj?.description && <div className="object-description">{obj.description}</div>}
                                </div>
                                <div className="object-grid">
                                  <div className="object-row object-row-primary">
                                    <div>
                                      <span className="label">Node</span>
                                      <span className="value">{renderValue(obj?.event?.Node)}</span>
                                    </div>
                                    <div>
                                      <span className="label">Summary</span>
                                      <span className="value">{renderSummary(obj?.event?.Summary, obj?.trap?.variables)}</span>
                                    </div>
                                    <div>
                                      <span className="label">Severity</span>
                                      <span className="value">{renderValue(obj?.event?.Severity)}</span>
                                    </div>
                                  </div>
                                  <div className="object-row object-row-secondary">
                                    <div>
                                      <span className="label">Event Type</span>
                                      <span className="value">{renderValue(obj?.event?.EventType)}</span>
                                    </div>
                                    <div>
                                      <span className="label">Expire Time</span>
                                      <span className="value">{renderValue(obj?.event?.ExpireTime)}</span>
                                    </div>
                                    <div>
                                      <span className="label">Event Category</span>
                                      <span className="value">{renderValue(obj?.event?.EventCategory)}</span>
                                    </div>
                                    <div>
                                      <span className="label">OID</span>
                                      <span className="value monospace">{renderValue(obj?.trap?.oid)}</span>
                                    </div>
                                  </div>
                                  <div className="object-row object-row-tertiary">
                                    <div>
                                      <span className="label">Trap Variables</span>
                                      <span className="value">{renderTrapVariables(obj?.trap?.variables)}</span>
                                    </div>
                                    <div>
                                      <span className="label">PreProcessors</span>
                                      <span className="value">{renderValue(obj?.preProcessors)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
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
                          <button type="button" onClick={() => setShowCommitModal(false)}>
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveFile(commitMessage)}
                            disabled={saveLoading}
                          >
                            {saveLoading ? 'Saving…' : 'Save'}
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
                  {varModalVars.length === 0 ? (
                    <div className="empty-state">No trap variables available.</div>
                  ) : (
                    <div className="var-list" ref={varListRef}>
                      {varModalVars.map((variable: any, index: number) => {
                        const token = `$v${index + 1}`;
                        const isSelected = token === varModalToken;
                        return (
                        <div
                          className={`trap-var${isSelected ? ' trap-var-selected' : ''}`}
                          key={variable?.name || variable?.oid || index}
                          ref={(el) => {
                            varRowRefs.current[token] = el;
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
                    <button type="button" onClick={() => setVarModalOpen(false)}>
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
