import type { ComponentProps, ReactNode } from 'react';
import FcomBrowserPanel from './FcomBrowserPanel';
import FcomFileHeader from './FcomFileHeader';
import FcomFilePreview from './FcomFilePreview';
import FcomFolderOverview from './FcomFolderOverview';

type FcomWorkspaceProps = {
  comBrowserPanelProps: ComponentProps<typeof FcomBrowserPanel>;
  fcomFolderOverviewProps: ComponentProps<typeof FcomFolderOverview>;
  fcomFileHeaderProps: ComponentProps<typeof FcomFileHeader>;
  fcomFilePreviewProps: ComponentProps<typeof FcomFilePreview>;
  selectedFile: ComponentProps<typeof FcomFileHeader>['selectedFile'];
  children?: ReactNode;
};

export default function FcomWorkspace({
  comBrowserPanelProps,
  fcomFolderOverviewProps,
  fcomFileHeaderProps,
  fcomFilePreviewProps,
  selectedFile,
  children,
}: FcomWorkspaceProps) {
  return (
    <div className="split-layout">
      <FcomBrowserPanel {...comBrowserPanelProps} />
      <div className="panel">
        <div className="panel-scroll">
          <div className="file-details">
            {!selectedFile && <FcomFolderOverview {...fcomFolderOverviewProps} />}
            <FcomFileHeader {...fcomFileHeaderProps} />
            <FcomFilePreview {...fcomFilePreviewProps} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
