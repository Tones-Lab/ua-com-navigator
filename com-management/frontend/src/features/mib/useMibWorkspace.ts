import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';

type UseMibWorkspaceOptions = {
  api: any;
  triggerToast: (message: string, success?: boolean) => void;
};

type MibSupportMap = Record<string, { fcom: boolean | null; pcom: boolean | null; checkedAt: number }>;

type LoadMibPathOptions = {
  append?: boolean;
  searchOverride?: string;
};

type LoadMibSearchOptions = {
  append?: boolean;
  queryOverride?: string;
};

export default function useMibWorkspace({ api, triggerToast }: UseMibWorkspaceOptions) {
  const mibUrlHydratingRef = useRef(false);
  const [mibPath, setMibPath] = useState('/');
  const [mibEntries, setMibEntries] = useState<any[]>([]);
  const [mibLoading, setMibLoading] = useState(false);
  const [mibLoadingElapsed, setMibLoadingElapsed] = useState(0);
  const [mibShowLoadingTimer, setMibShowLoadingTimer] = useState(false);
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
  const [mibDetailsLoading, setMibDetailsLoading] = useState(false);
  const [mibDefinitionSearch, setMibDefinitionSearch] = useState('');
  const [mibObjectFilter, setMibObjectFilter] = useState<'all' | 'fcom' | 'pcom'>('all');
  const [mibSelectedDefinition, setMibSelectedDefinition] = useState<any | null>(null);
  const [mibSupportByPath, setMibSupportByPath] = useState<MibSupportMap>({});
  const [mibOutput, setMibOutput] = useState('');
  const [mibOutputName, setMibOutputName] = useState('');
  const [mib2FcomLoading, setMib2FcomLoading] = useState(false);
  const [mib2FcomError, setMib2FcomError] = useState<string | null>(null);
  const [mibUseParent, setMibUseParent] = useState(true);

  useEffect(() => {
    if (!mibLoading) {
      setMibLoadingElapsed(0);
      setMibShowLoadingTimer(false);
      return;
    }
    setMibLoadingElapsed(0);
    setMibShowLoadingTimer(false);
    const timerId = window.setTimeout(() => {
      setMibShowLoadingTimer(true);
    }, 2000);
    const intervalId = window.setInterval(() => {
      setMibLoadingElapsed((prev) => prev + 1);
    }, 1000);
    return () => {
      window.clearTimeout(timerId);
      window.clearInterval(intervalId);
    };
  }, [mibLoading]);

  const getMibBaseName = (value?: string | null) => {
    if (!value) {
      return '';
    }
    const name = value.split('/').pop() || value;
    return name.replace(/\.(mib|txt)$/i, '');
  };

  const getMibSupportStatus = (supported: boolean | null) => {
    if (supported === true) {
      return { label: 'OK', status: 'ok' as const };
    }
    if (supported === false) {
      return { label: '!', status: 'warn' as const };
    }
    return { label: '?', status: 'unknown' as const };
  };

  const getSupportedCountLabel = (supported: boolean | null, total: number) => {
    if (supported === null) {
      return 'N/A';
    }
    return supported ? total : 0;
  };

  const resolveMibSupport = async (pathValue: string) => {
    if (!pathValue) {
      return;
    }
    if (mibSupportByPath[pathValue]) {
      return;
    }
    const baseName = getMibBaseName(pathValue);
    if (!baseName) {
      setMibSupportByPath((prev) => ({
        ...prev,
        [pathValue]: { fcom: null, pcom: null, checkedAt: Date.now() },
      }));
      return;
    }
    const lookupComsFile = async (fileName: string) => {
      try {
        const resp = await api.searchComs(fileName, 'name', 5);
        const results = Array.isArray(resp.data?.results) ? resp.data.results : [];
        const lower = fileName.toLowerCase();
        return results.some((result: any) => {
          const pathId = String(result?.pathId || '').toLowerCase();
          const name = String(result?.name || '').toLowerCase();
          return pathId.endsWith(lower) || name === lower;
        });
      } catch {
        return null;
      }
    };
    const [fcomSupported, pcomSupported] = await Promise.all([
      lookupComsFile(`${baseName}-FCOM.json`),
      lookupComsFile(`${baseName}-PCOM.json`),
    ]);
    setMibSupportByPath((prev) => ({
      ...prev,
      [pathValue]: {
        fcom: fcomSupported,
        pcom: pcomSupported,
        checkedAt: Date.now(),
      },
    }));
  };

  const loadMibPath = async (path: string, options?: LoadMibPathOptions) => {
    const append = options?.append ?? false;
    const offset = append ? mibOffset : 0;
    const searchParam = options?.searchOverride ?? '';
    setMibLoading(true);
    setMibError(null);
    try {
      const targetPath = path || '/';
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
      setMibFilteredTotal(
        typeof resp.data?.filtered_total === 'number' ? resp.data.filtered_total : null,
      );
      setMibPath(resp.data?.path || '/');
      setMibSearchMode('browse');
    } catch (err: any) {
      setMibError(err?.response?.data?.error || 'Failed to load MIB folder');
    } finally {
      if (mibUrlHydratingRef.current) {
        mibUrlHydratingRef.current = false;
      }
      setMibLoading(false);
    }
  };

  const loadMibSearch = async (options?: LoadMibSearchOptions) => {
    const query =
      options?.queryOverride !== undefined
        ? String(options.queryOverride).trim()
        : mibSearch.trim();
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

  const handleMibSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMibSelectedFile(null);
    setMibDefinitions([]);
    setMibSelectedDefinition(null);
    setMibOffset(0);
    const query = mibSearch.trim();
    const isNumericOid = /^\d+(?:\.\d+)+$/.test(query);
    if (isNumericOid) {
      try {
        const resp = await api.lookupMibOid(query);
        const moduleName = String(resp.data?.module || '').trim();
        const resolvedName = String(resp.data?.name || '').trim();
        if (moduleName) {
          const label = resolvedName ? `${moduleName}::${resolvedName}` : moduleName;
          triggerToast(`OID resolved to ${label}. Searching MIB files...`);
          setMibSearch(moduleName);
          setMibSearchScope('all');
          await loadMibSearch({ append: false, queryOverride: moduleName });
          return;
        }
      } catch {
        // ignore lookup errors and fall back to filename search
      }
    }
    if (mibSearchScope === 'all') {
      await loadMibSearch({ append: false });
      return;
    }
    await loadMibPath(mibPath, { append: false });
  };

  const handleMibClearSearch = async () => {
    setMibSearch('');
    setMibOffset(0);
    await loadMibPath(mibPath, { append: false, searchOverride: '' });
  };

  const loadMibDefinitions = async (filePath: string) => {
    setMibDetailsLoading(true);
    setMibError(null);
    try {
      const resp = await api.parseMib(filePath);
      const defs = Array.isArray(resp.data?.definitions) ? resp.data.definitions : [];
      const baseName = filePath.split('/').pop()?.replace(/\.(mib|txt)$/i, '') || '';
      const moduleName = defs.length > 0 ? String(defs[0]?.module || '').trim() : '';
      const resolvedModule = moduleName || baseName;
      const names = defs
        .map((definition: any) => String(definition?.name || '').trim())
        .filter(Boolean);
      let translateMap: Record<string, string> = {};
      if (names.length > 0) {
        try {
          const translateResp = await api.translateMibNames(resolvedModule || null, names);
          const entries: Array<{ name?: string; fullOid?: string }> = Array.isArray(
            translateResp.data?.entries,
          )
            ? translateResp.data.entries
            : [];
          const lowered = entries.reduce<Record<string, string>>((acc, entry) => {
            const key = String(entry?.name || '').trim().toLowerCase();
            const value = String(entry?.fullOid || '').trim();
            if (!key || !value) {
              return acc;
            }
            acc[key] = value;
            return acc;
          }, {});
          translateMap = lowered;
        } catch {
          translateMap = {};
        }
      }

      const normalized = defs.map((definition: any) => {
        const name = String(definition?.name || '').trim();
        const key = name.toLowerCase();
        const description = Array.isArray(definition?.description)
          ? definition.description.filter(Boolean).join(' ')
          : String(definition?.description || '').trim();
        return {
          ...definition,
          name,
          description,
          module: String(definition?.module || resolvedModule || '').trim() || undefined,
          oid: String(definition?.oid || '').trim() || undefined,
          fullOid: translateMap[key] || String(definition?.fullOid || '').trim() || undefined,
          kind: String(definition?.kind || '').trim(),
          syntax: String(definition?.syntax || '').trim() || undefined,
          access: String(definition?.access || '').trim() || undefined,
          status: String(definition?.status || '').trim() || undefined,
          defval: String(definition?.defval || '').trim() || undefined,
          index: String(definition?.index || '').trim() || undefined,
        };
      });

      setMibDefinitions(normalized);
      setMibDefinitionSearch('');
      setMibObjectFilter('all');
      setMibSelectedDefinition((prev: any | null) => {
        if (prev?.name) {
          const match = normalized.find((entry: any) => entry.name === prev.name);
          if (match) {
            return match;
          }
        }
        return normalized[0] || null;
      });
    } catch (err: any) {
      setMibError(err?.response?.data?.error || 'Failed to parse MIB file');
      setMibDefinitions([]);
      setMibSelectedDefinition(null);
    } finally {
      setMibDetailsLoading(false);
    }
  };

  const openMibFileFromUrl = async (pathValue: string) => {
    if (!pathValue) {
      return;
    }
    setMibSelectedFile(pathValue);
    setMibDefinitions([]);
    setMibSelectedDefinition(null);
    setMibDefinitionSearch('');
    setMibObjectFilter('all');
    await loadMibDefinitions(pathValue);
  };

  const handleOpenMibEntry = (entry: any) => {
    if (!entry) {
      return;
    }
    if (entry.isDir) {
      const pathValue = entry.path || entry.PathID || entry.PathName || entry.name || '/';
      void loadMibPath(pathValue, { append: false });
      return;
    }
    const filePath = entry.path || entry.PathID || entry.PathName || entry.name;
    if (!filePath) {
      return;
    }
    setMibSelectedFile(filePath);
    setMibDefinitions([]);
    setMibSelectedDefinition(null);
    setMibDefinitionSearch('');
    setMibObjectFilter('all');
    void loadMibDefinitions(filePath);
  };

  const openMibFavorite = (favorite: any) => {
    if (!favorite?.pathId) {
      return;
    }
    if (favorite.type === 'folder') {
      setMibSelectedFile(null);
      setMibDefinitions([]);
      setMibSelectedDefinition(null);
      setMibDefinitionSearch('');
      setMibObjectFilter('all');
      setMibSearch('');
      setMibSearchScope('folder');
      setMibOffset(0);
      void loadMibPath(favorite.pathId, { append: false, searchOverride: '' });
      return;
    }
    const filePath = favorite.pathId;
    setMibSelectedFile(filePath);
    setMibDefinitions([]);
    setMibSelectedDefinition(null);
    setMibDefinitionSearch('');
    setMibObjectFilter('all');
    void loadMibDefinitions(filePath);
  };

  const runMib2Fcom = async () => {
    if (!mibSelectedFile) {
      setMib2FcomError('Select a MIB file first.');
      return;
    }
    setMib2FcomLoading(true);
    setMib2FcomError(null);
    try {
      const outputName = mibOutputName.trim() || undefined;
      const resp = await api.runMib2Fcom(mibSelectedFile, outputName, mibUseParent);
      const output = resp.data?.output ?? '';
      const name = resp.data?.output_name ?? resp.data?.outputName ?? outputName ?? '';
      setMibOutput(typeof output === 'string' ? output : JSON.stringify(output, null, 2));
      setMibOutputName(String(name || outputName || ''));
      if (resp.data?.error) {
        setMib2FcomError(String(resp.data.error));
      }
    } catch (err: any) {
      setMib2FcomError(err?.response?.data?.error || 'Failed to run MIB2FCOM');
    } finally {
      setMib2FcomLoading(false);
    }
  };

  const filteredMibDefinitions = useMemo(() => {
    const query = mibDefinitionSearch.trim().toLowerCase();
    const results = mibDefinitions
      .map((entry, index) => {
        const name = String(entry?.name || '').toLowerCase();
        const oid = String(entry?.oid || '').toLowerCase();
        const fullOid = String(entry?.fullOid || '').toLowerCase();
        const description = String(entry?.description || '').toLowerCase();
        if (!query) {
          return { entry, index, score: 0, matchesQuery: true };
        }
        const exactMatch =
          name === query || oid === query || fullOid === query || description === query;
        const startsWith =
          name.startsWith(query) ||
          oid.startsWith(query) ||
          fullOid.startsWith(query) ||
          description.startsWith(query);
        const includesMatch =
          name.includes(query) ||
          oid.includes(query) ||
          fullOid.includes(query) ||
          description.includes(query);
        const matchesQuery = exactMatch || startsWith || includesMatch;
        const score = exactMatch ? 0 : startsWith ? 1 : includesMatch ? 2 : 3;
        return { entry, index, score, matchesQuery };
      })
      .filter(({ entry, matchesQuery }) => {
        if (!matchesQuery) {
          return false;
        }
        if (mibObjectFilter === 'all') {
          return true;
        }
        const kind = String(entry?.kind || '').toUpperCase();
        const isFcom = kind === 'NOTIFICATION-TYPE' || kind === 'TRAP-TYPE';
        const isPcom = kind === 'OBJECT-TYPE';
        if (mibObjectFilter === 'fcom') {
          return isFcom;
        }
        if (mibObjectFilter === 'pcom') {
          return isPcom;
        }
        return true;
      });
    if (!query) {
      return results.map(({ entry }) => entry);
    }
    return results
      .sort((a, b) => {
        if (a.score !== b.score) {
          return a.score - b.score;
        }
        return a.index - b.index;
      })
      .map(({ entry }) => entry);
  }, [mibDefinitions, mibDefinitionSearch, mibObjectFilter]);

  const mibDefinitionCounts = useMemo(() => {
    let fcomCount = 0;
    let pcomCount = 0;
    mibDefinitions.forEach((definition) => {
      const kind = String(definition?.kind || '').toUpperCase();
      if (kind === 'NOTIFICATION-TYPE' || kind === 'TRAP-TYPE') {
        fcomCount += 1;
      } else if (kind === 'OBJECT-TYPE') {
        pcomCount += 1;
      }
    });
    return { fcomCount, pcomCount };
  }, [mibDefinitions]);

  const mibSelectedSupport = mibSelectedFile ? mibSupportByPath[mibSelectedFile] : null;

  useEffect(() => {
    if (mibEntries.length === 0) {
      return;
    }
    let active = true;
    const run = async () => {
      for (const entry of mibEntries) {
        if (!active) {
          return;
        }
        if (entry?.isDir) {
          continue;
        }
        const pathValue = entry?.path;
        if (!pathValue) {
          continue;
        }
        if (mibSupportByPath[pathValue]) {
          continue;
        }
        await resolveMibSupport(pathValue);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [mibEntries, mibSupportByPath]);

  useEffect(() => {
    if (!mibSelectedFile) {
      return;
    }
    void resolveMibSupport(mibSelectedFile);
  }, [mibSelectedFile]);

  const resetMibState = () => {
    setMibPath('/');
    setMibEntries([]);
    setMibLoading(false);
    setMibError(null);
    setMibSearch('');
    setMibSearchScope('folder');
    setMibSearchMode('browse');
    setMibOffset(0);
    setMibHasMore(false);
    setMibTotal(null);
    setMibFilteredTotal(null);
    setMibSelectedFile(null);
    setMibDefinitions([]);
    setMibDetailsLoading(false);
    setMibDefinitionSearch('');
    setMibObjectFilter('all');
    setMibSelectedDefinition(null);
    setMibOutput('');
    setMibOutputName('');
    setMib2FcomLoading(false);
    setMib2FcomError(null);
    setMibUseParent(true);
  };

  return {
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
    mibDefinitions,
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
    setMibSelectedFile,
    setMibDefinitions,
    setMibDefinitionSearch,
    setMibObjectFilter,
    setMibSelectedDefinition,
    setMibOutput,
    setMibOutputName,
    setMibUseParent,
    loadMibPath,
    loadMibSearch,
    handleMibSearchSubmit,
    handleMibClearSearch,
    getMibBaseName,
    getMibSupportStatus,
    getSupportedCountLabel,
    loadMibDefinitions,
    openMibFileFromUrl,
    handleOpenMibEntry,
    openMibFavorite,
    runMib2Fcom,
    resetMibState,
  };
}
