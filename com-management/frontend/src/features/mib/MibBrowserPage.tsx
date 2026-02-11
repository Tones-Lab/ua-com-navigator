import React from 'react';
import EmptyState from '../../components/EmptyState';
import InlineMessage from '../../components/InlineMessage';
import PanelHeader from '../../components/PanelHeader';
import SearchPanel from '../../components/SearchPanel';
import PathBreadcrumbs from '../../components/PathBreadcrumbs';

type MibBrowserPageProps = {
  mibPath: string;
  buildBreadcrumbsFromPath: (value: string) => Array<{ label: string; node: string | null }>;
  loadMibPath: (path: string) => void;
  handleMibSearchSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  mibSearch: string;
  setMibSearch: (value: string) => void;
  mibLoading: boolean;
  mibError: string | null;
  mibEntries: any[];
  handleOpenMibEntry: (entry: any) => void;
  selectedMibEntry: any | null;
  mibDetails: any | null;
  mibDetailsLoading: boolean;
  mibDetailsError: string | null;
  isMibFolder: (entry: any) => boolean;
  formatMibPathLabel: (value: string) => string;
  renderMibDetails: (details: any) => React.ReactNode;
  renderMibEntryType: (entry: any) => React.ReactNode;
  renderMibEntryStatus: (entry: any) => React.ReactNode;
};

export default function MibBrowserPage({
  mibPath,
  buildBreadcrumbsFromPath,
  loadMibPath,
  handleMibSearchSubmit,
  mibSearch,
  setMibSearch,
  mibLoading,
  mibError,
  mibEntries,
  handleOpenMibEntry,
  selectedMibEntry,
  mibDetails,
  mibDetailsLoading,
  mibDetailsError,
  isMibFolder,
  formatMibPathLabel,
  renderMibDetails,
  renderMibEntryType,
  renderMibEntryStatus,
}: MibBrowserPageProps) {
  return (
    <div className="split-layout">
      <div className="panel">
        <div className="panel-scroll">
          <PanelHeader
            title="MIB Browser"
            actions={
              <button type="button" className="ghost-button" onClick={() => loadMibPath(mibPath)}>
                Refresh
              </button>
            }
          >
            <PathBreadcrumbs
              items={buildBreadcrumbsFromPath(mibPath).map((crumb) => ({
                label: crumb.label,
                value: crumb.node,
              }))}
              onSelect={(index) => {
                const target = buildBreadcrumbsFromPath(mibPath)[index];
                const targetPath = target?.node ? `/${target.node}` : '/';
                loadMibPath(targetPath);
              }}
            />
            <SearchPanel
              placeholder="Search MIBs and OIDs"
              query={mibSearch}
              onQueryChange={setMibSearch}
              onSubmit={handleMibSearchSubmit}
              disableSearch={!mibSearch.trim()}
            />
          </PanelHeader>
          {mibError && <InlineMessage tone="error">{mibError}</InlineMessage>}
          {mibLoading ? (
            <EmptyState>Loading MIBs…</EmptyState>
          ) : mibEntries.length === 0 ? (
            <EmptyState>No MIB entries found.</EmptyState>
          ) : (
            <ul className="browse-list">
              {mibEntries.map((entry) => {
                const isFolder = isMibFolder(entry);
                return (
                  <li key={entry?.PathID || entry?.PathName || entry?.name}>
                    <button
                      type="button"
                      className={isFolder ? 'browse-link' : 'browse-link file-link'}
                      onClick={() =>
                        isFolder ? loadMibPath(entry.PathID) : handleOpenMibEntry(entry)
                      }
                    >
                      <span className="browse-icon" aria-hidden="true">
                        {isFolder ? '📁' : '📄'}
                      </span>
                      {formatMibPathLabel(entry.PathName || entry.PathID || entry.name || '')}
                    </button>
                    {!isFolder && (
                      <div className="mib-entry-meta">
                        {renderMibEntryType(entry)}
                        {renderMibEntryStatus(entry)}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-scroll">
          <div className="panel-header">
            <div className="panel-title-row">
              <h2>MIB Details</h2>
            </div>
          </div>
          {mibDetailsError && <InlineMessage tone="error">{mibDetailsError}</InlineMessage>}
          {mibDetailsLoading ? (
            <EmptyState>Loading details…</EmptyState>
          ) : selectedMibEntry && mibDetails ? (
            <div className="mib-details">{renderMibDetails(mibDetails)}</div>
          ) : (
            <EmptyState>Select a MIB entry to view details.</EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}
