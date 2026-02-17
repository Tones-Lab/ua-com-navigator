import type { FormEvent } from 'react';
import BrowsePanelHeader from '../../components/BrowsePanelHeader';
import MibActionsPanel from './MibActionsPanel';
import MibDetailsHeader from './MibDetailsHeader';
import MibObjectsPanel from './MibObjectsPanel';
import MibSupportSummary from './MibSupportSummary';

type MibWorkspaceProps = {
  isCompactPanel: boolean;
  mibPath: string;
  mibSearch: string;
  mibSearchScope: 'folder' | 'all';
  mibSearchMode: 'search' | 'browse';
  mibLoading: boolean;
  mibShowLoadingTimer: boolean;
  mibLoadingElapsed: number;
  mibError: string | null;
  mibEntries: any[];
  mibTotal: number | null;
  mibFilteredTotal: number | null;
  mibHasMore: boolean;
  mibSelectedFile: string | null;
  mibSelectedSupport: any | null;
  mibDefinitionCounts: { fcomCount: number; pcomCount: number };
  mib2FcomLoading: boolean;
  mibUseParent: boolean;
  mib2FcomError: string | null;
  mibOutput: string;
  mibOutputName: string;
  mibDefinitionSearch: string;
  mibObjectFilter: 'all' | 'fcom' | 'pcom';
  mibDetailsLoading: boolean;
  mibSelectedDefinition: any | null;
  filteredMibDefinitions: any[];
  mibSupportByPath: Record<string, any>;
  pcomAdvancedActive: boolean;
  pcomAdvancedSummary: string;
  pcomSnmpProfileLoading: boolean;
  pcomSnmpProfileError: string | null;
  pcomSnmpProfile: any | null;
  pcomDeviceIp: string;
  pcomDevicesLoading: boolean;
  pcomDeviceOptions: Array<{ value: string; label: string }>;
  pcomDeviceOptionsWithManual: Array<{ value: string; label: string }>;
  pcomActiveTarget: string | null;
  pcomPollLoading: boolean;
  pcomPollError: string | null;
  pcomPollOutput: string | null;
  pcomDevicesError: string | null;
  favoritesFolders: any[];
  favoritesFiles: any[];
  favoritesLoading: boolean;
  favoritesError: string | null;
  hasEditPermission: boolean;
  buildBreadcrumbsFromPath: (path: string) => Array<{ label: string; node: string | null }>;
  handleMibSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  handleMibClearSearch: () => void;
  loadMibPath: (path: string, options?: { append?: boolean }) => void | Promise<void>;
  loadMibSearch: (options?: { append?: boolean }) => void | Promise<void>;
  handleOpenMibEntry: (entry: any) => void;
  openMibFavorite: (favorite: any) => void;
  getMibSupportStatus: (support: any) => { status: 'ok' | 'warn' | 'unknown'; label: string };
  getSupportedCountLabel: (support: any, total: number) => string | number;
  getMibBaseName: (path: string) => string;
  runMib2Fcom: () => void;
  setMibUseParent: (value: boolean) => void;
  setMibOutput: (value: string) => void;
  setMibDefinitionSearch: (value: string) => void;
  setMibObjectFilter: (value: 'all' | 'fcom' | 'pcom') => void;
  setMibSelectedDefinition: (definition: any | null) => void;
  formatSnmpVersionLabel: (value: string) => string;
  formatSnmpProfileTooltip: (profile: any) => string;
  openPcomAdvancedModal: () => void;
  disablePcomAdvanced: () => void;
  runPcomPoll: () => void;
  setPcomDeviceIp: (value: string) => void;
  openTrapComposer: (definition: any, path: string | null) => void;
  isFavorite: (type: 'file' | 'folder', pathId: string) => boolean;
  toggleFavorite: (favorite: {
    type: 'file' | 'folder';
    pathId: string;
    label: string;
    node?: string;
  }) => void;
  setMibSearch: (value: string) => void;
  setMibSearchScope: (value: 'folder' | 'all') => void;
};

export default function MibWorkspace({
  isCompactPanel,
  mibPath,
  mibSearch,
  mibSearchScope,
  mibSearchMode,
  mibLoading,
  mibShowLoadingTimer,
  mibLoadingElapsed,
  mibError,
  mibEntries,
  mibTotal,
  mibFilteredTotal,
  mibHasMore,
  mibSelectedFile,
  mibSelectedSupport,
  mibDefinitionCounts,
  mib2FcomLoading,
  mibUseParent,
  mib2FcomError,
  mibOutput,
  mibOutputName,
  mibDefinitionSearch,
  mibObjectFilter,
  mibDetailsLoading,
  mibSelectedDefinition,
  filteredMibDefinitions,
  mibSupportByPath,
  pcomAdvancedActive,
  pcomAdvancedSummary,
  pcomSnmpProfileLoading,
  pcomSnmpProfileError,
  pcomSnmpProfile,
  pcomDeviceIp,
  pcomDevicesLoading,
  pcomDeviceOptions,
  pcomDeviceOptionsWithManual,
  pcomActiveTarget,
  pcomPollLoading,
  pcomPollError,
  pcomPollOutput,
  pcomDevicesError,
  favoritesFolders,
  favoritesFiles,
  favoritesLoading,
  favoritesError,
  hasEditPermission,
  buildBreadcrumbsFromPath,
  handleMibSearchSubmit,
  handleMibClearSearch,
  loadMibPath,
  loadMibSearch,
  handleOpenMibEntry,
  openMibFavorite,
  getMibSupportStatus,
  getSupportedCountLabel,
  getMibBaseName,
  runMib2Fcom,
  setMibUseParent,
  setMibOutput,
  setMibDefinitionSearch,
  setMibObjectFilter,
  setMibSelectedDefinition,
  formatSnmpVersionLabel,
  formatSnmpProfileTooltip,
  openPcomAdvancedModal,
  disablePcomAdvanced,
  runPcomPoll,
  setPcomDeviceIp,
  openTrapComposer,
  isFavorite,
  toggleFavorite,
  setMibSearch,
  setMibSearchScope,
}: MibWorkspaceProps) {
  const filteredCounts = filteredMibDefinitions.reduce(
    (acc, definition) => {
      const kind = String(definition?.kind || '').toUpperCase();
      if (kind === 'NOTIFICATION-TYPE' || kind === 'TRAP-TYPE') {
        acc.fcom += 1;
      } else if (kind === 'OBJECT-TYPE') {
        acc.pcom += 1;
      }
      return acc;
    },
    { fcom: 0, pcom: 0 },
  );
  const totalCount = filteredMibDefinitions.length;
  return (
    <div className="split-layout">
      <div className="panel">
        <div className="panel-scroll">
          <BrowsePanelHeader
            title="MIB Browser"
            actions={
              <button
                type="button"
                className="ghost-button"
                onClick={() => loadMibPath(mibPath)}
              >
                Refresh
              </button>
            }
            breadcrumbs={buildBreadcrumbsFromPath(mibPath).map((crumb) => ({
              label: crumb.label,
              value: crumb.node,
            }))}
            onCrumbSelect={(index) => {
              const target = buildBreadcrumbsFromPath(mibPath)[index];
              const targetPath = target?.node ? `/${target.node}` : '/';
              loadMibPath(targetPath);
            }}
            search={{
              placeholder: 'Search MIBs',
              query: mibSearch,
              onQueryChange: setMibSearch,
              onSubmit: handleMibSearchSubmit,
              scopes: [
                { value: 'folder', label: 'Folder' },
                { value: 'all', label: 'All' },
              ],
              scopeValue: mibSearchScope,
              onScopeChange: (value) => setMibSearchScope(value as 'folder' | 'all'),
              isLoading: mibLoading,
              helperContent: (
                <>
                  <span>Scope: {mibSearchScope === 'all' ? 'All' : 'Folder'}</span>
                  {mibSearch.trim() && (
                    <span className="search-helper-query">
                      {mibSearchMode === 'search'
                        ? `Searching all MIBs for “${mibSearch.trim()}”.`
                        : `Filtering current folder for “${mibSearch.trim()}”.`}
                    </span>
                  )}
                </>
              ),
              actions: (
                <button
                  type="button"
                  className="link-button"
                  onClick={handleMibClearSearch}
                  disabled={!mibSearch}
                >
                  Clear
                </button>
              ),
            }}
            favorites={{
              folders: favoritesFolders,
              files: favoritesFiles,
              loading: favoritesLoading,
              error: favoritesError,
              onOpenFolder: (fav) => openMibFavorite(fav),
              onOpenFile: (fav) => openMibFavorite(fav),
            }}
            isCompact={isCompactPanel}
          />
          {mibError && <div className="error">{mibError}</div>}
          {mibLoading ? (
            <div className="mib-list-loading" aria-busy="true">
              <span className="mib-loading-spinner" aria-hidden="true" />
              <span>Loading MIBs…</span>
              {mibShowLoadingTimer && (
                <span className="mib-loading-timer">{mibLoadingElapsed}s</span>
              )}
            </div>
          ) : (
            <div className="browse-results mib-browse-results">
              {mibEntries.length === 0 ? (
                <div className="empty-state guided-empty">
                  <div className="guided-empty-title">No MIBs in this folder.</div>
                  <div className="guided-empty-text">
                    Try a different folder, switch scope to All, or clear the search.
                  </div>
                </div>
              ) : (
                <ul className="browse-list mib-browse-list">
                  {mibEntries.map((entry) => {
                    const entrySupport = entry?.path ? mibSupportByPath[entry.path] : null;
                    const fcomStatus = getMibSupportStatus(entrySupport?.fcom ?? null);
                    const pcomStatus = getMibSupportStatus(entrySupport?.pcom ?? null);
                    return (
                      <li
                        key={entry.path || entry.name}
                        className={
                          entry.isDir
                            ? 'mib-browse-item'
                            : 'mib-browse-item mib-browse-item-file'
                        }
                      >
                        <div className="mib-browse-row">
                          <button
                            type="button"
                            className={entry.isDir ? 'browse-link' : 'browse-link file-link'}
                            onClick={() => handleOpenMibEntry(entry)}
                          >
                            <span className="browse-icon" aria-hidden="true">
                              {entry.isDir ? '📁' : '📄'}
                            </span>
                            <span className="mib-entry-name">{entry.name}</span>
                            {!entry.isDir && entry.size ? (
                              <span className="mib-entry-size-inline">
                                ({Math.round(entry.size / 1024)} KB)
                              </span>
                            ) : null}
                          </button>
                          {!entry.isDir && (
                            <div className="mib-entry-meta">
                              <span className="mib-support-badge mib-support-badge-fcom">
                                FCOM
                              </span>
                              <span
                                className={`mib-support-status mib-support-status-${fcomStatus.status}`}
                                title={
                                  fcomStatus.status === 'ok'
                                    ? 'FCOM support found'
                                    : fcomStatus.status === 'warn'
                                      ? 'FCOM support not found'
                                      : 'FCOM support unknown'
                                }
                              >
                                {fcomStatus.label}
                              </span>
                              <span className="mib-support-badge mib-support-badge-pcom">
                                PCOM
                              </span>
                              <span
                                className={`mib-support-status mib-support-status-${pcomStatus.status}`}
                                title={
                                  pcomStatus.status === 'ok'
                                    ? 'PCOM support found'
                                    : pcomStatus.status === 'warn'
                                      ? 'PCOM support not found'
                                      : 'PCOM support unknown'
                                }
                              >
                                {pcomStatus.label}
                              </span>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {(mibTotal !== null || mibFilteredTotal !== null) && (
                <div className="muted">
                  Showing {mibEntries.length} of{' '}
                  {mibFilteredTotal ?? mibTotal ?? mibEntries.length}
                  {mibSearch.trim() ? ' matches' : ' items'}.
                  {mibSearchMode === 'search' && mibHasMore && ' (more matches available)'}
                </div>
              )}
              {mibHasMore && (
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => {
                    if (mibSearchScope === 'all' && mibSearch.trim()) {
                      void loadMibSearch({ append: true });
                    } else {
                      void loadMibPath(mibPath, { append: true });
                    }
                  }}
                  disabled={mibLoading}
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="panel">
        <div className="panel-scroll">
          <div className="panel-header">
            <h2>MIB Details</h2>
          </div>
          {!mibSelectedFile ? (
            <div className="empty-state guided-empty">
              <div className="guided-empty-title">Start with a MIB file.</div>
              <ol className="guided-empty-steps">
                <li>Select a file on the left to load its objects.</li>
                <li>Use search and filters to narrow the object list.</li>
                <li>Run MIB2FCOM or test poll when ready.</li>
              </ol>
            </div>
          ) : (
            <div className="mib-details">
              <MibDetailsHeader
                selectedFile={mibSelectedFile}
                title={getMibBaseName(mibSelectedFile) || mibSelectedFile}
                favoriteActive={isFavorite('file', mibSelectedFile)}
                onToggleFavorite={() =>
                  toggleFavorite({
                    type: 'file',
                    pathId: mibSelectedFile,
                    label: getMibBaseName(mibSelectedFile) || mibSelectedFile,
                  })
                }
              />
              <MibSupportSummary
                fcomStatus={getMibSupportStatus(mibSelectedSupport?.fcom ?? null)}
                pcomStatus={getMibSupportStatus(mibSelectedSupport?.pcom ?? null)}
                fcomSupportedLabel={getSupportedCountLabel(
                  mibSelectedSupport?.fcom ?? null,
                  mibDefinitionCounts.fcomCount,
                )}
                pcomSupportedLabel={getSupportedCountLabel(
                  mibSelectedSupport?.pcom ?? null,
                  mibDefinitionCounts.pcomCount,
                )}
                fcomTotal={mibDefinitionCounts.fcomCount}
                pcomTotal={mibDefinitionCounts.pcomCount}
              />
              <MibActionsPanel
                hasEditPermission={hasEditPermission}
                mib2FcomLoading={mib2FcomLoading}
                mibUseParent={mibUseParent}
                mib2FcomError={mib2FcomError}
                mibOutput={mibOutput}
                mibOutputName={mibOutputName}
                runMib2Fcom={runMib2Fcom}
                setMibUseParent={setMibUseParent}
                setMibOutput={setMibOutput}
              />
              <MibObjectsPanel
                mibDefinitionSearch={mibDefinitionSearch}
                mibObjectFilter={mibObjectFilter}
                totalCount={totalCount}
                filteredCounts={filteredCounts}
                mibDetailsLoading={mibDetailsLoading}
                filteredMibDefinitions={filteredMibDefinitions}
                mibSelectedDefinition={mibSelectedDefinition}
                mibSelectedSupport={mibSelectedSupport}
                setMibDefinitionSearch={setMibDefinitionSearch}
                setMibObjectFilter={setMibObjectFilter}
                setMibSelectedDefinition={setMibSelectedDefinition}
                getMibSupportStatus={getMibSupportStatus}
                pcomAdvancedActive={pcomAdvancedActive}
                pcomAdvancedSummary={pcomAdvancedSummary}
                pcomSnmpProfileLoading={pcomSnmpProfileLoading}
                pcomSnmpProfileError={pcomSnmpProfileError}
                pcomSnmpProfile={pcomSnmpProfile}
                formatSnmpVersionLabel={formatSnmpVersionLabel}
                formatSnmpProfileTooltip={formatSnmpProfileTooltip}
                pcomDeviceIp={pcomDeviceIp}
                setPcomDeviceIp={setPcomDeviceIp}
                pcomDevicesLoading={pcomDevicesLoading}
                pcomDeviceOptions={pcomDeviceOptions}
                pcomDeviceOptionsWithManual={pcomDeviceOptionsWithManual}
                pcomDevicesError={pcomDevicesError}
                openPcomAdvancedModal={openPcomAdvancedModal}
                disablePcomAdvanced={disablePcomAdvanced}
                runPcomPoll={runPcomPoll}
                pcomPollLoading={pcomPollLoading}
                pcomActiveTarget={pcomActiveTarget}
                pcomPollError={pcomPollError}
                pcomPollOutput={pcomPollOutput}
                openTrapComposer={openTrapComposer}
                mibSelectedFile={mibSelectedFile}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
