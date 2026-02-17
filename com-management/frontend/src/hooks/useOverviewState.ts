import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../services/api';
import useRequest from './useRequest';
import useSortableTable from './useSortableTable';
import { getApiErrorMessage } from '../utils/errorUtils';

type AppTab = 'overview' | 'fcom' | 'pcom' | 'mib' | 'legacy';

type OverviewSortKey =
  | 'vendor'
  | 'files'
  | 'overrides'
  | 'objects'
  | 'variables'
  | 'evalObjects'
  | 'processorObjects'
  | 'literalObjects';

type UseOverviewStateParams = {
  isAuthenticated: boolean;
  activeApp: AppTab;
};

export default function useOverviewState({ isAuthenticated, activeApp }: UseOverviewStateParams) {
  const [overviewStatus, setOverviewStatus] = useState<any | null>(null);
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const {
    loading: overviewLoading,
    error: overviewError,
    run: runOverviewRequest,
  } = useRequest();
  const [overviewRebuildPending, setOverviewRebuildPending] = useState(false);
  const overviewRebuildStartRef = useRef<number | null>(null);
  const overviewStatusPollRef = useRef<number | null>(null);

  const [overviewTopN, setOverviewTopN] = useState(10);
  const [overviewVendorFilter, setOverviewVendorFilter] = useState('');
  const {
    sort: overviewVendorSort,
    toggleSort: toggleOverviewSort,
  } = useSortableTable<OverviewSortKey>({ key: 'files', direction: 'desc' });

  const stopOverviewStatusPolling = () => {
    if (overviewStatusPollRef.current !== null) {
      window.clearInterval(overviewStatusPollRef.current);
      overviewStatusPollRef.current = null;
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

  const loadOverview = async (options?: { forceRebuild?: boolean }) => {
    if (!isAuthenticated) {
      return;
    }
    try {
      await runOverviewRequest(
        async () => {
          if (options?.forceRebuild) {
            setOverviewRebuildPending(true);
            overviewRebuildStartRef.current = Date.now();
            startOverviewStatusPolling();
            await api.rebuildOverviewIndex();
          }
          const [statusRes, dataRes] = await Promise.all([api.getOverviewStatus(), api.getOverview()]);
          setOverviewStatus(statusRes.data);
          setOverviewData(dataRes.data?.data ?? null);
        },
        {
          getErrorMessage: (err) => getApiErrorMessage(err, 'Failed to load overview'),
          rethrow: true,
        },
      );
    } catch {
      if (options?.forceRebuild) {
        setOverviewRebuildPending(false);
        stopOverviewStatusPolling();
      }
    }
  };

  const overviewProtocols = useMemo(() => {
    if (!overviewData?.protocols) {
      return [] as Array<{ name: string; counts: any; vendors: any[] }>;
    }
    const filterText = overviewVendorFilter.trim().toLowerCase();
    return overviewData.protocols.map((protocol: any) => {
      const vendors = Array.isArray(protocol.vendors) ? protocol.vendors : [];
      const filteredVendors = filterText
        ? vendors.filter((vendor: any) =>
            String(vendor?.name || '')
              .toLowerCase()
              .includes(filterText),
          )
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

  useEffect(() => {
    if (!isAuthenticated || activeApp !== 'overview') {
      return;
    }
    void loadOverview();
  }, [isAuthenticated, activeApp]);

  useEffect(() => () => stopOverviewStatusPolling(), []);

  return {
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
  };
}
