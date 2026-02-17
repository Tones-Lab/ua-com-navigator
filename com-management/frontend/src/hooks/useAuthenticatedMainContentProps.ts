import { useMemo } from 'react';

type UseAuthenticatedMainContentPropsArgs = any;

export default function useAuthenticatedMainContentProps(
  args: UseAuthenticatedMainContentPropsArgs,
) {
  const {
    isAuthenticated,
    activeApp,
    overviewPageProps,
    comBrowserPanelProps,
    selectedFile,
    fcomFolderOverviewProps,
    fcomFileHeaderProps,
    fcomFilePreviewProps,
    fcomReviewCommitModalProps,
    fcomFlowModalStackProps,
    fcomAuxOverlaysProps,
    pcomWorkspaceViewProps,
    mibWorkspaceProps,
    trapComposerModalProps,
    pcomAdvancedSettingsModalProps,
    signInScreenProps,
  } = args;

  return useMemo(
    () => ({
      isAuthenticated,
      activeApp,
      overviewPageProps,
      comBrowserPanelProps,
      selectedFile,
      fcomFolderOverviewProps,
      fcomFileHeaderProps,
      fcomFilePreviewProps,
      fcomReviewCommitModalProps,
      fcomFlowModalStackProps,
      fcomAuxOverlaysProps,
      pcomWorkspaceViewProps,
      mibWorkspaceProps,
      trapComposerModalProps,
      pcomAdvancedSettingsModalProps,
      signInScreenProps,
    }),
    [
      isAuthenticated,
      activeApp,
      overviewPageProps,
      comBrowserPanelProps,
      selectedFile,
      fcomFolderOverviewProps,
      fcomFileHeaderProps,
      fcomFilePreviewProps,
      fcomReviewCommitModalProps,
      fcomFlowModalStackProps,
      fcomAuxOverlaysProps,
      pcomWorkspaceViewProps,
      mibWorkspaceProps,
      trapComposerModalProps,
      pcomAdvancedSettingsModalProps,
      signInScreenProps,
    ],
  );
}