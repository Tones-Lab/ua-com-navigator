import { useMemo } from 'react';

type UseOverviewPagePropsArgs = any;

export default function useOverviewPageProps(args: UseOverviewPagePropsArgs) {
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