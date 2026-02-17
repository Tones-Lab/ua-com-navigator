import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';

type AppTab = 'overview' | 'fcom' | 'pcom' | 'mib' | 'legacy';

type UseBrowseDeepLinkParams = {
  isAuthenticated: boolean;
  urlHydrated: MutableRefObject<boolean>;
  entriesLength: number;
  browseLoading: boolean;
  activeApp: AppTab;
  browseNode: string | null;
  selectedFilePathId: string | null;
  viewMode: 'friendly' | 'preview';
  serverId?: string | null;
  mibPath: string;
  mibSelectedFile: string | null;
  mibUrlHydratingRef: MutableRefObject<boolean>;
  setActiveApp: Dispatch<SetStateAction<AppTab>>;
  setViewMode: Dispatch<SetStateAction<'friendly' | 'preview'>>;
  setMibPath: Dispatch<SetStateAction<string>>;
  setBreadcrumbs: Dispatch<SetStateAction<Array<{ label: string; node: string | null }>>>;
  buildBreadcrumbsFromNode: (node: string) => Array<{ label: string; node: string | null }>;
  inferAppFromPath: (pathId?: string | null) => 'fcom' | 'pcom' | 'mib' | null;
  loadNode: (node: string | null, label?: string) => Promise<void> | void;
  loadNodeInternal: (node: string | null, label?: string) => Promise<boolean>;
  loadDefaultBrowseNode: (app: AppTab) => Promise<void>;
  openFileFromUrl: (fileId: string, nodeParam?: string | null) => Promise<unknown> | void;
  loadMibPath: (path: string, options?: { append?: boolean }) => Promise<void>;
  openMibFileFromUrl: (path: string) => Promise<void>;
};

export default function useBrowseDeepLink({
  isAuthenticated,
  urlHydrated,
  entriesLength,
  browseLoading,
  activeApp,
  browseNode,
  selectedFilePathId,
  viewMode,
  serverId,
  mibPath,
  mibSelectedFile,
  mibUrlHydratingRef,
  setActiveApp,
  setViewMode,
  setMibPath,
  setBreadcrumbs,
  buildBreadcrumbsFromNode,
  inferAppFromPath,
  loadNode,
  loadNodeInternal,
  loadDefaultBrowseNode,
  openFileFromUrl,
  loadMibPath,
  openMibFileFromUrl,
}: UseBrowseDeepLinkParams) {
  useEffect(() => {
    if (isAuthenticated && entriesLength === 0 && !browseLoading && !urlHydrated.current) {
      if (activeApp === 'fcom' || activeApp === 'pcom') {
        void loadDefaultBrowseNode(activeApp);
      } else {
        void loadNode(null, '/');
      }
    }
  }, [isAuthenticated, entriesLength, browseLoading, activeApp]);

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
        const fallbackPath = mibFileParam ? mibFileParam.split('/').slice(0, -1).join('/') : null;
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
      if (selectedFilePathId) {
        params.set('file', selectedFilePathId);
      } else {
        params.delete('file');
      }
    }
    params.set('app', activeApp);
    params.set('view', viewMode);
    if (serverId) {
      params.set('server', serverId);
    }
    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, '', nextUrl);
  }, [
    activeApp,
    browseNode,
    selectedFilePathId,
    viewMode,
    mibPath,
    mibSelectedFile,
    isAuthenticated,
    serverId,
  ]);
}
