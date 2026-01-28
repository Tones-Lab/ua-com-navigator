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
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [browseData, setBrowseData] = useState<any>(null);
  const [browseNode, setBrowseNode] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
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

  const loadNodeInternal = async (node: string | null, label?: string) => {
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
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to load files');
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
    }
  };

  const handleOpenFile = async (entry: any) => {
    if (!confirmDiscardIfDirty(() => handleOpenFileInternal(entry))) {
      return;
    }
  };

  const openFileFromUrl = async (fileId: string, nodeParam?: string | null) => {
    const fileName = fileId.split('/').pop() || fileId;
    const parentNode = nodeParam || fileId.split('/').slice(0, -1).join('/');
    try {
      if (parentNode) {
        const resp = await api.browsePath(browsePath, { node: parentNode });
        setBrowseData(resp.data);
        setEntries(Array.isArray(resp.data?.data) ? resp.data.data : []);
        setBrowseNode(parentNode);
        setBreadcrumbs(buildBreadcrumbsFromPath(fileId));
        const entry = Array.isArray(resp.data?.data)
          ? resp.data.data.find((item: any) => item.PathID === fileId || item.PathName === fileName)
          : null;
        if (entry) {
          await handleOpenFileInternal(entry);
          return;
        }
      }
      setBreadcrumbs(buildBreadcrumbsFromPath(fileId));
      await handleOpenFileInternal({ PathID: fileId, PathName: fileName });
    } catch (err: any) {
      setBrowseError(err?.response?.data?.error || 'Failed to restore file from URL');
    }
  };

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

  const renderValue = (value: any) => {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    try {
      return JSON.stringify(value);
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
            return <span key={`text-${index}`}>{part}</span>;
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
    const target = varRowRefs.current[varModalToken];
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [varModalOpen, varModalToken, varModalVars]);

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

  const quickLinks = [
    {
      label: 'CastleRock (trap)',
      node: 'id-core/default/processing/event/fcom/_objects/trap/CastleRock',
      crumbs: [
        { label: '/', node: null },
        { label: 'core', node: 'id-core' },
        { label: 'default', node: 'id-core/default' },
        { label: 'processing', node: 'id-core/default/processing' },
        { label: 'event', node: 'id-core/default/processing/event' },
        { label: 'fcom', node: 'id-core/default/processing/event/fcom' },
        { label: '_objects', node: 'id-core/default/processing/event/fcom/_objects' },
        { label: 'trap', node: 'id-core/default/processing/event/fcom/_objects/trap' },
        { label: 'CastleRock', node: 'id-core/default/processing/event/fcom/_objects/trap/CastleRock' },
      ],
    },
  ];

  const handleQuickLink = async (link: { label: string; node: string; crumbs: Array<{ label: string; node: string | null }> }) => {
    confirmDiscardIfDirty(async () => {
      setBreadcrumbs(link.crumbs);
      await loadNodeInternal(link.node);
    });
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
                <div className="quick-links">
                  {quickLinks.map((link) => (
                    <button
                      key={link.label}
                      type="button"
                      className="quick-link"
                      onClick={() => handleQuickLink(link)}
                    >
                      {link.label}
                    </button>
                  ))}
                </div>
              </div>
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
                              onClick={() => loadNode(entry.PathID, entry.PathName)}
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
              {!selectedFile ? (
                <div className="empty-state">Select a file to preview.</div>
              ) : (
                <div className="file-details">
                  <div className="file-title">
                    <strong>
                      {selectedFile.PathName}
                      {viewMode === 'edit' && editorText !== originalText && (
                        <span className="unsaved-indicator" title="Unsaved changes">
                          ● Unsaved
                        </span>
                      )}
                    </strong>
                    <span className="file-path">{selectedFile.PathID}</span>
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
                          {getFriendlyObjects(fileData).length === 0 ? (
                            <div className="empty-state">No objects found.</div>
                          ) : (
                            getFriendlyObjects(fileData).map((obj: any, idx: number) => (
                              <div className="object-card" key={obj?.['@objectName'] || idx}>
                                <div className="object-header">
                                  <div className="object-title">
                                    <span className="object-name">{obj?.['@objectName'] || `Object ${idx + 1}`}</span>
                                    {obj?.certification && <span className="pill">{obj.certification}</span>}
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
                  <h3>Current path</h3>
                  <input type="text" readOnly value={getCurrentPath()} />
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowPathModal(false)}>
                      Close
                    </button>
                    <button
                      type="button"
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
