import { useMemo } from 'react';

type UseFcomFolderOverviewArgsArgs = any;

export default function useFcomFolderOverviewArgs(args: UseFcomFolderOverviewArgsArgs) {
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