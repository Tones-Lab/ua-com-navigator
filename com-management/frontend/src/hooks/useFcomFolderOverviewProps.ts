import { useMemo } from 'react';

type UseFcomFolderOverviewPropsArgs = any;

export default function useFcomFolderOverviewProps(args: UseFcomFolderOverviewPropsArgs) {
  const {
    selectedFolder,
    folderLoading,
    folderOverview,
    folderTableFilter,
    setFolderTableFilter,
    toggleFolderSort,
    folderTableSort,
    folderTableRows,
    formatOverviewNumber,
    formatDisplayPath,
    hasEditPermission,
    showTestControls,
    onTestVendor,
    onTestFile,
    isVendorTesting,
    isFileTesting,
  } = args;

  return useMemo(
    () => ({
      selectedFolder,
      folderLoading,
      folderOverview,
      folderTableFilter,
      setFolderTableFilter,
      toggleFolderSort,
      folderTableSort,
      folderTableRows,
      formatOverviewNumber,
      formatDisplayPath,
      hasEditPermission,
      showTestControls,
      onTestVendor,
      onTestFile,
      isVendorTesting,
      isFileTesting,
    }),
    [
      selectedFolder,
      folderLoading,
      folderOverview,
      folderTableFilter,
      setFolderTableFilter,
      toggleFolderSort,
      folderTableSort,
      folderTableRows,
      formatOverviewNumber,
      formatDisplayPath,
      hasEditPermission,
      showTestControls,
      onTestVendor,
      onTestFile,
      isVendorTesting,
      isFileTesting,
    ],
  );
}