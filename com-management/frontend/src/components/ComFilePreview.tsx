import type { ReactNode } from 'react';

type ComFilePreviewProps = {
  selectedFile: any | null;
  viewMode: 'friendly' | 'preview';
  emptyState: ReactNode;
  friendlyView: ReactNode;
  rawView: ReactNode;
  loadingState?: ReactNode;
  showLoadingOverlay?: boolean;
  loadingOverlay?: ReactNode;
};

export default function ComFilePreview({
  selectedFile,
  viewMode,
  emptyState,
  friendlyView,
  rawView,
  loadingState,
  showLoadingOverlay,
  loadingOverlay,
}: ComFilePreviewProps) {
  return (
    <div className="file-preview">
      {showLoadingOverlay && loadingOverlay}
      {!selectedFile ? emptyState : loadingState ? loadingState : viewMode === 'friendly' ? friendlyView : rawView}
    </div>
  );
}
