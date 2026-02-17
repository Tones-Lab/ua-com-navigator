import ActionRow from '../../components/ActionRow';
import PanelSection from '../../components/PanelSection';
import TableSortButton from '../../components/TableSortButton';

type FcomFolderOverviewProps = {
  selectedFolder: any | null;
  folderLoading: boolean;
  folderOverview: any | null;
  folderTableFilter: string;
  setFolderTableFilter: (value: string) => void;
  toggleFolderSort: (key: 'file' | 'objects' | 'schemaErrors' | 'unknownFields') => void;
  folderTableSort: {
    key: 'file' | 'objects' | 'schemaErrors' | 'unknownFields';
    direction: 'asc' | 'desc';
  };
  folderTableRows: any[];
  formatOverviewNumber: (value: number) => string;
  formatDisplayPath: (pathId?: string | null) => string;
  hasEditPermission: boolean;
  showTestControls: boolean;
  onTestVendor: () => void;
  onTestFile: (pathId: string, label?: string) => void;
  isVendorTesting: boolean;
  isFileTesting: (pathId?: string) => boolean;
};

export default function FcomFolderOverview({
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
}: FcomFolderOverviewProps) {
  if (!selectedFolder) {
    return null;
  }

  return (
    <PanelSection title="Folder Overview">
      <div className="file-title">
        <strong>{selectedFolder.PathName || selectedFolder.PathID}</strong>
        {selectedFolder.PathID && (
          <span className="file-path">{formatDisplayPath(selectedFolder.PathID)}</span>
        )}
      </div>
      {showTestControls && (
        <ActionRow>
          <button
            type="button"
            className="action-link"
            onClick={onTestVendor}
            disabled={!hasEditPermission || isVendorTesting}
            title={hasEditPermission ? '' : 'Read-only access'}
          >
            {isVendorTesting ? 'Testing…' : 'Test Vendor SNMP Traps (All Files)'}
          </button>
        </ActionRow>
      )}
      {folderLoading && <div className="muted">Loading overview…</div>}
      {!folderLoading && folderOverview && (
        <div className="folder-overview">
          <div className="overview-stat-grid">
            <div className="overview-stat">
              <span className="overview-stat-label">Files</span>
              <span className="overview-stat-value">
                {formatOverviewNumber(folderOverview.fileCount || 0)}
              </span>
            </div>
            <div className="overview-stat">
              <span className="overview-stat-label">Overrides</span>
              <span className="overview-stat-value">
                {formatOverviewNumber(folderOverview.overrideCount || 0)}
              </span>
            </div>
            <div className="overview-stat">
              <span className="overview-stat-label">Objects</span>
              <span className="overview-stat-value">
                {formatOverviewNumber(folderOverview.objectCount || 0)}
              </span>
            </div>
            <div className="overview-stat">
              <span className="overview-stat-label">Schema issues</span>
              <span className="overview-stat-value">
                {formatOverviewNumber(folderOverview.schemaErrorCount || 0)}
              </span>
            </div>
            <div className="overview-stat">
              <span className="overview-stat-label">Unknown fields</span>
              <span className="overview-stat-value">
                {formatOverviewNumber(folderOverview.unknownFieldCount || 0)}
              </span>
            </div>
          </div>
          {Array.isArray(folderOverview.topFiles) && folderOverview.topFiles.length > 0 ? (
            <div className="overview-table-wrapper">
              <div className="overview-filter-row">
                <label htmlFor="folder-file-filter">Filter files</label>
                <input
                  id="folder-file-filter"
                  type="text"
                  placeholder="Type to filter files"
                  value={folderTableFilter}
                  onChange={(event) => setFolderTableFilter(event.target.value)}
                />
              </div>
              <table className="overview-table">
                <thead>
                  <tr>
                    <th>
                      <TableSortButton
                        label="File"
                        sortKey="file"
                        activeKey={folderTableSort.key}
                        direction={folderTableSort.direction}
                        onToggle={toggleFolderSort}
                      />
                    </th>
                    <th>
                      <TableSortButton
                        label="Objects"
                        sortKey="objects"
                        activeKey={folderTableSort.key}
                        direction={folderTableSort.direction}
                        onToggle={toggleFolderSort}
                      />
                    </th>
                    <th>
                      <TableSortButton
                        label="Schema"
                        sortKey="schemaErrors"
                        activeKey={folderTableSort.key}
                        direction={folderTableSort.direction}
                        onToggle={toggleFolderSort}
                      />
                    </th>
                    <th>
                      <TableSortButton
                        label="Unknown"
                        sortKey="unknownFields"
                        activeKey={folderTableSort.key}
                        direction={folderTableSort.direction}
                        onToggle={toggleFolderSort}
                      />
                    </th>
                    {showTestControls && <th>Test</th>}
                  </tr>
                </thead>
                <tbody>
                  {folderTableRows.map((row: any) => (
                    <tr key={row.pathId || row.file}>
                      <td>{row.file}</td>
                      <td>{formatOverviewNumber(row.objects || 0)}</td>
                      <td>{formatOverviewNumber(row.schemaErrors || 0)}</td>
                      <td>{formatOverviewNumber(row.unknownFields || 0)}</td>
                      {showTestControls && (
                        <td>
                          <button
                            type="button"
                            className="ghost-button"
                            onClick={() => row.pathId && onTestFile(row.pathId, row.file)}
                            disabled={
                              !row.pathId || !hasEditPermission || isFileTesting(row.pathId)
                            }
                            title={hasEditPermission ? '' : 'Read-only access'}
                          >
                            {isFileTesting(row.pathId) ? 'Testing…' : 'Test SNMP File'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overview-empty">No overview rows available.</div>
          )}
        </div>
      )}
    </PanelSection>
  );
}
