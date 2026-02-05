import React from 'react';

type OverviewPageProps = {
  overviewStatus: any;
  overviewTopN: number;
  setOverviewTopN: (value: number) => void;
  loadOverview: (options: { forceRebuild?: boolean }) => void;
  overviewLoading: boolean;
  overviewVendorFilter: string;
  setOverviewVendorFilter: (value: string) => void;
  overviewError: string | null;
  overviewData: any;
  overviewProtocols: any[];
  formatRelativeAge: (value: string) => string;
  formatOverviewNumber: (value: number) => string;
  handleOverviewFolderClick: (protocol: string, vendor?: string) => void;
  toggleOverviewSort: (key: any) => void;
  getSortIndicator: (activeKey: any, key: any, direction: any) => React.ReactNode;
  overviewVendorSort: { key: string; direction: 'asc' | 'desc' };
};

export default function OverviewPage({
  overviewStatus,
  overviewTopN,
  setOverviewTopN,
  loadOverview,
  overviewLoading,
  overviewVendorFilter,
  setOverviewVendorFilter,
  overviewError,
  overviewData,
  overviewProtocols,
  formatRelativeAge,
  formatOverviewNumber,
  handleOverviewFolderClick,
  toggleOverviewSort,
  getSortIndicator,
  overviewVendorSort,
}: OverviewPageProps) {
  return (
    <div className="overview-layout">
      <div className="overview-columns">
        <section className="overview-card overview-card-fcom">
          <div className="overview-card-header">
            <div>
              <h2>FCOM Overview</h2>
              <p className="overview-subtitle">
                File, object, and vendor rollups from FCOM folders.
              </p>
              <div className="overview-cache-status">
                {overviewStatus?.isBuilding
                  ? 'Cache: Refreshing'
                  : overviewStatus?.lastBuiltAt
                    ? `Cache: Loaded (age: ${formatRelativeAge(overviewStatus.lastBuiltAt)})`
                    : 'Cache: Not loaded'}
              </div>
            </div>
            <div className="overview-actions">
              <div className="overview-topn">
                <label htmlFor="overview-topn">Top N</label>
                <select
                  id="overview-topn"
                  value={overviewTopN}
                  onChange={(event) => setOverviewTopN(Number(event.target.value))}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={0}>All</option>
                </select>
              </div>
              <button
                type="button"
                className="save-button"
                onClick={() => loadOverview({ forceRebuild: true })}
                disabled={overviewLoading}
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="overview-filter-row">
            <label htmlFor="overview-vendor-filter">Filter vendors</label>
            <input
              id="overview-vendor-filter"
              type="text"
              placeholder="Type to filter vendors"
              value={overviewVendorFilter}
              onChange={(event) => setOverviewVendorFilter(event.target.value)}
            />
          </div>

          {overviewError && <p className="error">{overviewError}</p>}
          {overviewLoading && !overviewData && (
            <div className="overview-empty">Loading overview…</div>
          )}

          {overviewData && (
            <>
              <div className="overview-stat-grid">
                <div className="overview-stat">
                  <span className="overview-stat-label">Original FCOM files</span>
                  <span className="overview-stat-value">
                    {formatOverviewNumber(overviewData.totals?.files || 0)}
                  </span>
                </div>
                <div className="overview-stat">
                  <span className="overview-stat-label">Overrides</span>
                  <span className="overview-stat-value">
                    {formatOverviewNumber(overviewData.totals?.overrides || 0)}
                  </span>
                </div>
                <div className="overview-stat">
                  <span className="overview-stat-label">Objects</span>
                  <span className="overview-stat-value">
                    {formatOverviewNumber(overviewData.totals?.objects || 0)}
                  </span>
                </div>
                <div className="overview-stat">
                  <span className="overview-stat-label">Trap variables</span>
                  <span className="overview-stat-value">
                    {formatOverviewNumber(overviewData.totals?.variables || 0)}
                  </span>
                </div>
                <div className="overview-stat">
                  <span className="overview-stat-label">Eval objects</span>
                  <span className="overview-stat-value">
                    {formatOverviewNumber(overviewData.totals?.evalObjects || 0)}
                  </span>
                </div>
                <div className="overview-stat">
                  <span className="overview-stat-label">Processor objects</span>
                  <span className="overview-stat-value">
                    {formatOverviewNumber(overviewData.totals?.processorObjects || 0)}
                  </span>
                </div>
                <div className="overview-stat">
                  <span className="overview-stat-label">Literal objects</span>
                  <span className="overview-stat-value">
                    {formatOverviewNumber(overviewData.totals?.literalObjects || 0)}
                  </span>
                </div>
              </div>

              {overviewProtocols.length === 0 ? (
                <div className="overview-empty">No protocol data found.</div>
              ) : (
                <div className="overview-protocols">
                  {overviewProtocols.map((protocol: any) => (
                    <div key={protocol.name} className="overview-protocol">
                      <div className="overview-protocol-header">
                        <h3>
                          <button
                            type="button"
                            className="folder-link overview-folder-link"
                            onClick={() => handleOverviewFolderClick(protocol.name)}
                          >
                            {protocol.name}
                          </button>
                        </h3>
                        <div className="overview-protocol-meta">
                          <span>Files {formatOverviewNumber(protocol.counts?.files || 0)}</span>
                          <span>Objects {formatOverviewNumber(protocol.counts?.objects || 0)}</span>
                          <span>
                            Overrides {formatOverviewNumber(protocol.counts?.overrides || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="overview-table-wrapper">
                        <table className="overview-table">
                          <thead>
                            <tr>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('vendor')}
                                >
                                  Vendor{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'vendor',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('files')}
                                >
                                  Files{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'files',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('overrides')}
                                >
                                  Overrides{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'overrides',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('objects')}
                                >
                                  Objects{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'objects',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('variables')}
                                >
                                  Variables{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'variables',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('evalObjects')}
                                >
                                  Eval{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'evalObjects',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('processorObjects')}
                                >
                                  Processor{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'processorObjects',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                              <th>
                                <button
                                  type="button"
                                  className="table-sort-button"
                                  onClick={() => toggleOverviewSort('literalObjects')}
                                >
                                  Literal{' '}
                                  {getSortIndicator(
                                    overviewVendorSort.key,
                                    'literalObjects',
                                    overviewVendorSort.direction,
                                  )}
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {(protocol.vendors || []).map((vendor: any) => (
                              <tr key={`${protocol.name}-${vendor.name}`}>
                                <td>
                                  <button
                                    type="button"
                                    className="folder-link overview-folder-link"
                                    onClick={() =>
                                      handleOverviewFolderClick(protocol.name, vendor.name)
                                    }
                                  >
                                    {vendor.name}
                                  </button>
                                </td>
                                <td>{formatOverviewNumber(vendor.counts?.files || 0)}</td>
                                <td>{formatOverviewNumber(vendor.counts?.overrides || 0)}</td>
                                <td>{formatOverviewNumber(vendor.counts?.objects || 0)}</td>
                                <td>{formatOverviewNumber(vendor.counts?.variables || 0)}</td>
                                <td>{formatOverviewNumber(vendor.counts?.evalObjects || 0)}</td>
                                <td>
                                  {formatOverviewNumber(vendor.counts?.processorObjects || 0)}
                                </td>
                                <td>{formatOverviewNumber(vendor.counts?.literalObjects || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!overviewLoading && !overviewData && !overviewError && (
            <div className="overview-empty">Overview data is not available yet.</div>
          )}
        </section>

        <section className="overview-card overview-card-pcom">
          <div className="overview-card-header">
            <div>
              <h2>PCOM Overview</h2>
              <p className="overview-subtitle">Work in progress.</p>
            </div>
          </div>
          <div className="overview-empty">PCOM reporting is coming soon.</div>
        </section>
      </div>
    </div>
  );
}
