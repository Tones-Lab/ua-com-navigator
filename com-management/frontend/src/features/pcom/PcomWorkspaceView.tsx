import ComFilePreview from '../../components/ComFilePreview';
import ActionRow from '../../components/ActionRow';
import { FileTitleRow, ViewToggle } from '../../components/FileHeaderCommon';
import FcomBrowserPanel from '../fcom/FcomBrowserPanel';
import FcomRawPreview from '../fcom/FcomRawPreview';
import PcomFriendlyView from './PcomFriendlyView';

type PcomWorkspaceViewProps = {
  comBrowserPanelProps: any;
  selectedFile: any;
  formatDisplayPath: (pathId: string) => string;
  browseNode: string | null;
  isFavorite: (type: 'file' | 'folder', pathId: string) => boolean;
  toggleFavorite: (favorite: {
    type: 'file' | 'folder';
    pathId: string;
    label: string;
    node?: string;
  }) => void;
  viewMode: 'friendly' | 'preview';
  setViewMode: (mode: 'friendly' | 'preview') => void;
  pcomParsed: any;
  pcomObjectEntries: Array<{ key: string; name: string; obj: any }>;
  pcomSelectedObject: { key: string; name: string; obj: any } | null;
  setPcomSelectedObjectKey: (key: string) => void;
  formatPcomValue: (value: any) => string;
  searchHighlightActive: boolean;
  highlightQuery: string | null;
  rawMatchPositions: number[];
  rawMatchIndex: number;
  handlePrevRawMatch: () => void;
  handleNextRawMatch: () => void;
  editorText: string;
  renderRawHighlightedText: (text: string, query: string) => string | React.ReactNode[];
};

export default function PcomWorkspaceView({
  comBrowserPanelProps,
  selectedFile,
  formatDisplayPath,
  browseNode,
  isFavorite,
  toggleFavorite,
  viewMode,
  setViewMode,
  pcomParsed,
  pcomObjectEntries,
  pcomSelectedObject,
  setPcomSelectedObjectKey,
  formatPcomValue,
  searchHighlightActive,
  highlightQuery,
  rawMatchPositions,
  rawMatchIndex,
  handlePrevRawMatch,
  handleNextRawMatch,
  editorText,
  renderRawHighlightedText,
}: PcomWorkspaceViewProps) {
  return (
    <div className="split-layout">
      <FcomBrowserPanel {...comBrowserPanelProps} />
      <div className="panel">
        <div className="panel-scroll">
          <div className="file-details">
            <FileTitleRow
              title={selectedFile?.PathName ? selectedFile.PathName : 'Select a PCOM file'}
              path={selectedFile && selectedFile.PathID ? formatDisplayPath(selectedFile.PathID) : null}
              favorite={
                selectedFile
                  ? {
                      active: isFavorite('file', String(selectedFile.PathID || '')),
                      onToggle: () =>
                        toggleFavorite({
                          type: 'file',
                          pathId: String(selectedFile.PathID || ''),
                          label: String(selectedFile.PathName || selectedFile.PathID || ''),
                          node: browseNode || undefined,
                        }),
                    }
                  : null
              }
            />
            <ActionRow>
              <ViewToggle viewMode={viewMode} onChange={setViewMode} />
              <button
                type="button"
                className="action-link"
                disabled
                title="Stub only (no file creation yet)"
              >
                Create PCOM (Stub)
              </button>
            </ActionRow>
            <ComFilePreview
              selectedFile={selectedFile}
              viewMode={viewMode}
              emptyState={<div className="empty-state">Select a file on the left to view it.</div>}
              friendlyView={
                <PcomFriendlyView
                  pcomParsed={pcomParsed}
                  pcomObjectEntries={pcomObjectEntries}
                  pcomSelectedObject={pcomSelectedObject}
                  setPcomSelectedObjectKey={setPcomSelectedObjectKey}
                  formatPcomValue={formatPcomValue}
                />
              }
              rawView={
                <FcomRawPreview
                  searchHighlightActive={searchHighlightActive}
                  highlightQuery={highlightQuery}
                  rawMatchPositions={rawMatchPositions}
                  rawMatchIndex={rawMatchIndex}
                  handlePrevRawMatch={handlePrevRawMatch}
                  handleNextRawMatch={handleNextRawMatch}
                  rawPreviewText={editorText}
                  renderRawHighlightedText={renderRawHighlightedText}
                />
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
