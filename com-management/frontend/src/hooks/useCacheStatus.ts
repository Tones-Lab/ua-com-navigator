import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

type UseCacheStatusParams = {
  isAuthenticated: boolean;
  showUserMenu: boolean;
  showPathModal: boolean;
  refreshOverviewStatus: () => Promise<void>;
  startOverviewStatusPolling: () => void;
  stopOverviewStatusPolling: () => void;
};

type RebuildFolderOptions = {
  selectedFolderPathId?: string | null;
  onFolderOverviewReload?: () => Promise<void>;
};

export default function useCacheStatus({
  isAuthenticated,
  showUserMenu,
  showPathModal,
  refreshOverviewStatus,
  startOverviewStatusPolling,
  stopOverviewStatusPolling,
}: UseCacheStatusParams) {
  const [searchStatus, setSearchStatus] = useState<any>(null);
  const [searchRebuildPending, setSearchRebuildPending] = useState(false);
  const searchRebuildStartRef = useRef<number | null>(null);
  const searchStatusPollRef = useRef<number | null>(null);

  const [folderOverviewStatus, setFolderOverviewStatus] = useState<any | null>(null);
  const [folderRebuildPending, setFolderRebuildPending] = useState(false);
  const folderRebuildStartRef = useRef<number | null>(null);
  const folderStatusPollRef = useRef<number | null>(null);

  const [mibTranslateStatus, setMibTranslateStatus] = useState<any | null>(null);

  const refreshSearchStatus = async () => {
    try {
      const resp = await api.getSearchStatus();
      setSearchStatus(resp.data);
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

  const refreshMibTranslateStatus = async () => {
    try {
      const resp = await api.getMibTranslateStatus();
      setMibTranslateStatus(resp.data);
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

  const rebuildSearchIndexAndTrack = async () => {
    searchRebuildStartRef.current = Date.now();
    setSearchRebuildPending(true);
    const resp = await api.rebuildSearchIndex();
    setSearchStatus(resp.data);
    startSearchStatusPolling();
    return resp.data;
  };

  const rebuildFolderOverviewCacheAndTrack = async ({
    selectedFolderPathId,
    onFolderOverviewReload,
  }: RebuildFolderOptions = {}) => {
    setFolderRebuildPending(true);
    folderRebuildStartRef.current = Date.now();
    startFolderStatusPolling();
    try {
      await api.rebuildFolderOverviewCache(undefined, 25);
      await refreshFolderOverviewStatus();
      if (selectedFolderPathId && onFolderOverviewReload) {
        await onFolderOverviewReload();
      }
    } catch (error) {
      setFolderRebuildPending(false);
      stopFolderStatusPolling();
      throw error;
    }
  };

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
    void refreshMibTranslateStatus();
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

  return {
    searchStatus,
    setSearchStatus,
    searchRebuildPending,
    refreshSearchStatus,
    startSearchStatusPolling,
    stopSearchStatusPolling,
    rebuildSearchIndexAndTrack,
    folderOverviewStatus,
    folderRebuildPending,
    refreshFolderOverviewStatus,
    startFolderStatusPolling,
    stopFolderStatusPolling,
    rebuildFolderOverviewCacheAndTrack,
    mibTranslateStatus,
    refreshMibTranslateStatus,
  };
}
