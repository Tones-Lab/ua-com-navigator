import OverviewPage from '../features/overview/OverviewPage';
import PcomWorkspaceView from '../features/pcom/PcomWorkspaceView';
import MibWorkspace from '../features/mib/MibWorkspace';
import LegacyWorkspace from '../features/legacy/LegacyWorkspace';
import TrapComposerModal from '../features/fcom/TrapComposerModal';
import PcomAdvancedSettingsModal from '../features/mib/PcomAdvancedSettingsModal';
import SignInScreen from './SignInScreen';
import FcomWorkspacePanel from './FcomWorkspacePanel';

type AuthenticatedMainContentProps = {
  isAuthenticated: boolean;
  activeApp: any;
  overviewPageProps: any;
  comBrowserPanelProps: any;
  selectedFile: any;
  fcomFolderOverviewProps: any;
  fcomFileHeaderProps: any;
  fcomFilePreviewProps: any;
  fcomReviewCommitModalProps: any;
  fcomFlowModalStackProps: any;
  fcomAuxOverlaysProps: any;
  pcomWorkspaceViewProps: any;
  mibWorkspaceProps: any;
  trapComposerModalProps: any;
  pcomAdvancedSettingsModalProps: any;
  signInScreenProps: any;
};

export default function AuthenticatedMainContent({
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
}: AuthenticatedMainContentProps) {
  if (!isAuthenticated) {
    return <SignInScreen {...signInScreenProps} />;
  }

  return (
    <>
      {activeApp === 'overview' ? (
        <OverviewPage {...overviewPageProps} />
      ) : activeApp === 'fcom' ? (
        <FcomWorkspacePanel
          comBrowserPanelProps={comBrowserPanelProps}
          selectedFile={selectedFile}
          fcomFolderOverviewProps={fcomFolderOverviewProps}
          fcomFileHeaderProps={fcomFileHeaderProps}
          fcomFilePreviewProps={fcomFilePreviewProps}
          fcomReviewCommitModalProps={fcomReviewCommitModalProps}
          fcomFlowModalStackProps={fcomFlowModalStackProps}
          fcomAuxOverlaysProps={fcomAuxOverlaysProps}
        />
      ) : activeApp === 'pcom' ? (
        <PcomWorkspaceView {...pcomWorkspaceViewProps} />
      ) : activeApp === 'legacy' ? (
        <LegacyWorkspace />
      ) : (
        <MibWorkspace {...mibWorkspaceProps} />
      )}
      <TrapComposerModal {...trapComposerModalProps} />
      <PcomAdvancedSettingsModal {...pcomAdvancedSettingsModalProps} />
    </>
  );
}