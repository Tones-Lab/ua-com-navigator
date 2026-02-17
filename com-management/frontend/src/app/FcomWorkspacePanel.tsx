import FcomBrowserPanel from '../features/fcom/FcomBrowserPanel';
import FcomFolderOverview from '../features/fcom/FcomFolderOverview';
import FcomFileHeader from '../features/fcom/FcomFileHeader';
import FcomFilePreview from '../features/fcom/FcomFilePreview';
import FcomReviewCommitModal from '../features/fcom/FcomReviewCommitModal';
import FcomFlowModalStack from '../features/fcom/FcomFlowModalStack';
import FcomAuxOverlays from '../features/fcom/FcomAuxOverlays';

type FcomWorkspacePanelProps = {
  comBrowserPanelProps: any;
  selectedFile: any;
  fcomFolderOverviewProps: any;
  fcomFileHeaderProps: any;
  fcomFilePreviewProps: any;
  fcomReviewCommitModalProps: any;
  fcomFlowModalStackProps: any;
  fcomAuxOverlaysProps: any;
};

export default function FcomWorkspacePanel({
  comBrowserPanelProps,
  selectedFile,
  fcomFolderOverviewProps,
  fcomFileHeaderProps,
  fcomFilePreviewProps,
  fcomReviewCommitModalProps,
  fcomFlowModalStackProps,
  fcomAuxOverlaysProps,
}: FcomWorkspacePanelProps) {
  return (
    <div className="split-layout">
      <FcomBrowserPanel {...comBrowserPanelProps} />
      <div className="panel">
        <div className="panel-scroll">
          <div className="file-details">
            {!selectedFile && <FcomFolderOverview {...fcomFolderOverviewProps} />}
            <FcomFileHeader {...fcomFileHeaderProps} />
            <FcomFilePreview {...fcomFilePreviewProps} />
            <FcomReviewCommitModal {...fcomReviewCommitModalProps} />
            <FcomFlowModalStack {...fcomFlowModalStackProps} />
            <FcomAuxOverlays {...fcomAuxOverlaysProps} />
          </div>
        </div>
      </div>
    </div>
  );
}