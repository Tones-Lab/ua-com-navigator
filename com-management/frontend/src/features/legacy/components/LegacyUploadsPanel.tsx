import EmptyState from '../../../components/EmptyState';
import InlineMessage from '../../../components/InlineMessage';
import type { RefObject } from 'react';

type LegacyUploadEntry = {
  path: string;
  type: 'file' | 'folder';
  size: number;
  modifiedAt: string;
};

type LegacyUploadsPanelProps = {
  uploadRoot: string;
  fileInputRef: RefObject<HTMLInputElement>;
  uploading: boolean;
  uploadsLoading: boolean;
  uploadError: string | null;
  uploadsError: string | null;
  fileEntries: LegacyUploadEntry[];
  selectedPaths: string[];
  conversionStatus: 'idle' | 'ready' | 'running';
  conversionStatusTone: 'error' | 'running' | 'ready' | 'idle';
  conversionStatusText: string;
  isReadyToConvert: boolean;
  showConversionRun?: boolean;
  onUpload: () => void;
  onRefresh: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleSelectedPath: (path: string) => void;
  onOpenEntry: (entry: LegacyUploadEntry) => void;
  onRunConversion: (mode: 'preview' | 'run') => void;
};

export default function LegacyUploadsPanel({
  uploadRoot,
  fileInputRef,
  uploading,
  uploadsLoading,
  uploadError,
  uploadsError,
  fileEntries,
  selectedPaths,
  conversionStatus,
  conversionStatusTone,
  conversionStatusText,
  isReadyToConvert,
  showConversionRun = true,
  onUpload,
  onRefresh,
  onSelectAll,
  onDeselectAll,
  onToggleSelectedPath,
  onOpenEntry,
  onRunConversion,
}: LegacyUploadsPanelProps) {
  return (
    <div className="panel-section">
      <div className="panel-section-title">Legacy Uploads</div>
      <div className="muted">
        Upload rules from your machine. Files are stored in {uploadRoot || 'the legacy upload folder'}.
      </div>
      <div className="panel-section-actions">
        <input ref={fileInputRef} type="file" multiple className="legacy-file-input" />
        <button type="button" className="ghost-button" onClick={onUpload} disabled={uploading}>
          {uploading ? 'Uploading…' : 'Upload files'}
        </button>
        <button type="button" className="ghost-button" onClick={onRefresh} disabled={uploadsLoading}>
          Refresh
        </button>
      </div>
      {uploadError && <InlineMessage tone="error">{uploadError}</InlineMessage>}
      {uploadsError && <InlineMessage tone="error">{uploadsError}</InlineMessage>}
      {uploadsLoading ? (
        <div className="muted">Loading uploads…</div>
      ) : fileEntries.length === 0 ? (
        <EmptyState>No legacy files uploaded yet.</EmptyState>
      ) : (
        <div className="legacy-upload-layout">
          <ul className="browse-list legacy-upload-list">
            <li className="legacy-upload-toolbar">
              <button
                type="button"
                className="ghost-button"
                onClick={onSelectAll}
                disabled={selectedPaths.length === fileEntries.length}
              >
                Select all
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={onDeselectAll}
                disabled={selectedPaths.length === 0}
              >
                Deselect all
              </button>
              <span className="muted">
                Selected {selectedPaths.length} of {fileEntries.length}
              </span>
            </li>
            {fileEntries.map((entry) => (
              <li key={entry.path}>
                <div className="legacy-upload-row">
                  <input
                    type="checkbox"
                    checked={selectedPaths.includes(entry.path)}
                    onChange={() => onToggleSelectedPath(entry.path)}
                  />
                  <button type="button" className="browse-link file-link" onClick={() => onOpenEntry(entry)}>
                    {entry.path}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {showConversionRun && (
            <div className="legacy-upload-meta">
              <div className="panel-section-title">Conversion Run</div>
              <div className="muted">
                {isReadyToConvert
                  ? 'Files are ready. Start a conversion run to generate a report.'
                  : 'Upload files to enable conversion.'}
              </div>
              <div className="legacy-action-row">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!isReadyToConvert || conversionStatus === 'running'}
                  onClick={() => onRunConversion('run')}
                >
                  {conversionStatus === 'running' ? 'Converting…' : 'Run conversion'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!isReadyToConvert}
                  onClick={() => onRunConversion('preview')}
                >
                  Preview report
                </button>
              </div>
              <div className="legacy-status">
                <span className={`legacy-status-pill legacy-status-${conversionStatusTone}`} />
                {conversionStatusText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
