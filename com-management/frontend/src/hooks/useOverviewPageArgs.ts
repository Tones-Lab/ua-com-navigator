import { useMemo } from 'react';

type UseOverviewPageArgsArgs = any;

export default function useOverviewPageArgs(args: UseOverviewPageArgsArgs) {
  const {
    overviewStatus,
    overviewTopN,
    setOverviewTopN,
    loadOverview,
    overviewLoading,
    overviewVendorFilter,
    setOverviewVendorFilter,
    overviewError,
    overviewData,
    overviewProtocols,
    formatRelativeAge,
    formatOverviewNumber,
    handleOverviewFolderClick,
    toggleOverviewSort,
    overviewVendorSort,
  } = args;

  return useMemo(
    () => ({
      overviewStatus,
      overviewTopN,
      setOverviewTopN,
      loadOverview,
      overviewLoading,
      overviewVendorFilter,
      setOverviewVendorFilter,
      overviewError,
      overviewData,
      overviewProtocols,
      formatRelativeAge,
      formatOverviewNumber,
      handleOverviewFolderClick,
      toggleOverviewSort,
      overviewVendorSort,
    }),
    [
      overviewStatus,
      overviewTopN,
      setOverviewTopN,
      loadOverview,
      overviewLoading,
      overviewVendorFilter,
      setOverviewVendorFilter,
      overviewError,
      overviewData,
      overviewProtocols,
      formatRelativeAge,
      formatOverviewNumber,
      handleOverviewFolderClick,
      toggleOverviewSort,
      overviewVendorSort,
    ],
  );
}