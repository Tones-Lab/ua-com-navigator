import React from 'react';

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
          <div className="panel-header">
            <div className="panel-title-row">
              <h2>MIB Browser</h2>
              <button type="button" className="ghost-button" onClick={() => loadMibPath(mibPath)}>
                Refresh
              </button>
            </div>
            <div className="panel-section">
              <div className="panel-section-title">Path</div>
              <div className="breadcrumbs mib-breadcrumbs">
                {buildBreadcrumbsFromPath(mibPath).map((crumb, index, items) => {
                  const targetPath = crumb.node ? `/${crumb.node}` : '/';
                  return (
                    <button
                      key={`${crumb.label}-${index}`}
                      type="button"
                      className="crumb"
                      onClick={() => loadMibPath(targetPath)}
                      disabled={index === items.length - 1}
                    >
                      {crumb.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="panel-section">
              <div className="panel-section-title">Search</div>
              <form className="mib-search" onSubmit={handleMibSearchSubmit}>
                <div className="mib-search-row">
                  <input
                    type="text"
                    placeholder="Search MIBs and OIDs"
                    value={mibSearch}
                    onChange={(event) => setMibSearch(event.target.value)}
                  />
                  <button type="submit" className="search-button" disabled={!mibSearch.trim()}>
                    Search
                  </button>
                </div>
              </form>
            </div>
          </div>
          {mibError && <div className="error">{mibError}</div>}
          {mibLoading ? (
            <div className="empty-state">Loading MIBs…</div>
          ) : mibEntries.length === 0 ? (
            <div className="empty-state">No MIB entries found.</div>
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
          {mibDetailsError && <div className="error">{mibDetailsError}</div>}
          {mibDetailsLoading ? (
            <div className="empty-state">Loading details…</div>
          ) : selectedMibEntry && mibDetails ? (
            <div className="mib-details">{renderMibDetails(mibDetails)}</div>
          ) : (
            <div className="empty-state">Select a MIB entry to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}
