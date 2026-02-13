import type { FormEvent } from 'react';
import BrowsePanelHeader from '../../components/BrowsePanelHeader';
import { FileTitleRow } from '../../components/FileHeaderCommon';

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
            <div className="browse-results">
              {mibEntries.length === 0 ? (
                <div className="empty-state">No MIB files found.</div>
              ) : (
                <ul className="browse-list">
                  {mibEntries.map((entry) => {
                    const entrySupport = entry?.path ? mibSupportByPath[entry.path] : null;
                    const fcomStatus = getMibSupportStatus(entrySupport?.fcom ?? null);
                    const pcomStatus = getMibSupportStatus(entrySupport?.pcom ?? null);
                    return (
                      <li key={entry.path || entry.name}>
                        <button
                          type="button"
                          className={entry.isDir ? 'browse-link' : 'browse-link file-link'}
                          onClick={() => handleOpenMibEntry(entry)}
                        >
                          <span className="browse-icon" aria-hidden="true">
                            {entry.isDir ? '📁' : '📄'}
                          </span>
                          {entry.name}
                        </button>
                        {!entry.isDir && (
                          <div className="mib-entry-meta">
                            <span className="mib-support-badge mib-support-badge-fcom">FCOM</span>
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
                            <span className="mib-support-badge mib-support-badge-pcom">PCOM</span>
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
                            <span className="browse-meta">
                              {entry.size ? `${Math.round(entry.size / 1024)} KB` : ''}
                            </span>
                          </div>
                        )}
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
            <div className="empty-state">Select a MIB file to inspect.</div>
          ) : (
            <div className="mib-details">
              <FileTitleRow
                title={getMibBaseName(mibSelectedFile) || mibSelectedFile}
                path={mibSelectedFile}
                favorite={
                  mibSelectedFile
                    ? {
                        active: isFavorite('file', mibSelectedFile),
                        onToggle: () =>
                          toggleFavorite({
                            type: 'file',
                            pathId: mibSelectedFile,
                            label: getMibBaseName(mibSelectedFile) || mibSelectedFile,
                          }),
                      }
                    : null
                }
              />
              <div className="mib-overview">
                {(() => {
                  const fcomStatus = getMibSupportStatus(mibSelectedSupport?.fcom ?? null);
                  const pcomStatus = getMibSupportStatus(mibSelectedSupport?.pcom ?? null);
                  const fcomSupportedLabel = getSupportedCountLabel(
                    mibSelectedSupport?.fcom ?? null,
                    mibDefinitionCounts.fcomCount,
                  );
                  const pcomSupportedLabel = getSupportedCountLabel(
                    mibSelectedSupport?.pcom ?? null,
                    mibDefinitionCounts.pcomCount,
                  );
                  return (
                    <>
                      <div className="mib-summary-left">
                        <div className="mib-summary-chip mib-summary-chip-fcom">
                          <span className="mib-summary-tag">FCOM</span>
                          <span
                            className={`mib-support-status mib-support-status-${fcomStatus.status}`}
                          >
                            {fcomStatus.label}
                          </span>
                          <span className="mib-summary-count">
                            {fcomSupportedLabel}/{mibDefinitionCounts.fcomCount}
                          </span>
                        </div>
                        <div className="mib-summary-chip mib-summary-chip-pcom">
                          <span className="mib-summary-tag">PCOM</span>
                          <span
                            className={`mib-support-status mib-support-status-${pcomStatus.status}`}
                          >
                            {pcomStatus.label}
                          </span>
                          <span className="mib-summary-count">
                            {pcomSupportedLabel}/{mibDefinitionCounts.pcomCount}
                          </span>
                        </div>
                      </div>
                      <div className="mib-summary-meta">Supported / Total</div>
                    </>
                  );
                })()}
              </div>
              <div className="mib-actions">
                <button
                  type="button"
                  className="action-link"
                  onClick={runMib2Fcom}
                  disabled={!hasEditPermission || mib2FcomLoading}
                  title={hasEditPermission ? '' : 'Read-only access'}
                >
                  {mib2FcomLoading ? 'Running…' : 'Run MIB2FCOM'}
                </button>
                <label className="mib-checkbox">
                  <input
                    type="checkbox"
                    checked={mibUseParent}
                    onChange={(e) => setMibUseParent(e.target.checked)}
                    disabled={!hasEditPermission}
                  />
                  Use parent MIBs
                </label>
              </div>
              {mib2FcomError && <div className="error">{mib2FcomError}</div>}
              {mibOutput && (
                <div className="panel-section">
                  <div className="panel-section-title">
                    MIB2FCOM Output{mibOutputName ? ` (${mibOutputName})` : ''}
                  </div>
                  <textarea
                    className="mib-output"
                    value={mibOutput}
                    onChange={(e) => setMibOutput(e.target.value)}
                    disabled={!hasEditPermission}
                  />
                </div>
              )}
              <div className="mib-main-split">
                <div className="mib-main-left">
                  <div className="panel-section-title">Objects</div>
                  <div className="mib-object-toolbar">
                    <input
                      type="text"
                      placeholder="Search objects"
                      value={mibDefinitionSearch}
                      onChange={(e) => setMibDefinitionSearch(e.target.value)}
                    />
                    <div className="mib-filter-toggle" role="tablist">
                      <button
                        type="button"
                        className={
                          mibObjectFilter === 'all'
                            ? 'mib-filter-pill active'
                            : 'mib-filter-pill'
                        }
                        onClick={() => setMibObjectFilter('all')}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className={
                          mibObjectFilter === 'fcom'
                            ? 'mib-filter-pill active'
                            : 'mib-filter-pill'
                        }
                        onClick={() => setMibObjectFilter('fcom')}
                      >
                        FCOM
                      </button>
                      <button
                        type="button"
                        className={
                          mibObjectFilter === 'pcom'
                            ? 'mib-filter-pill active'
                            : 'mib-filter-pill'
                        }
                        onClick={() => setMibObjectFilter('pcom')}
                      >
                        PCOM
                      </button>
                    </div>
                  </div>
                  <div className="mib-definition-list">
                    {mibDetailsLoading ? (
                      <div className="mib-definition-loading" aria-busy="true">
                        <span className="mib-loading-spinner" aria-hidden="true" />
                        <span>Loading definitions…</span>
                      </div>
                    ) : filteredMibDefinitions.length === 0 ? (
                      <div className="empty-state">No definitions found.</div>
                    ) : (
                      filteredMibDefinitions.map((definition) => (
                        <button
                          key={`${definition.name}-${definition.oid || definition.kind}`}
                          type="button"
                          className={
                            mibSelectedDefinition?.name === definition.name
                              ? 'mib-definition-item mib-definition-item-active'
                              : 'mib-definition-item'
                          }
                          onClick={() => setMibSelectedDefinition(definition)}
                        >
                          {(() => {
                            const kind = String(definition?.kind || '').toUpperCase();
                            const isFcom =
                              kind === 'NOTIFICATION-TYPE' || kind === 'TRAP-TYPE';
                            const isPcom = kind === 'OBJECT-TYPE';
                            const support = isFcom
                              ? mibSelectedSupport?.fcom ?? null
                              : isPcom
                                ? mibSelectedSupport?.pcom ?? null
                                : null;
                            const status = getMibSupportStatus(support);
                            return (
                              <>
                                <div className="mib-definition-main">
                                  <span className="mib-definition-name">{definition.name}</span>
                                  <span className="mib-definition-kind">{definition.kind}</span>
                                  <span className="mib-definition-oid">
                                    {definition.fullOid || definition.oid || 'OID pending'}
                                  </span>
                                </div>
                                <div className="mib-definition-flags">
                                  {isFcom && (
                                    <span className="mib-support-badge mib-support-badge-fcom">
                                      FCOM
                                    </span>
                                  )}
                                  {isPcom && (
                                    <span className="mib-support-badge mib-support-badge-pcom">
                                      PCOM
                                    </span>
                                  )}
                                  {(isFcom || isPcom) && (
                                    <span
                                      className={`mib-support-status mib-support-status-${status.status}`}
                                      title={
                                        status.status === 'ok'
                                          ? 'Support found'
                                          : status.status === 'warn'
                                            ? 'Support not found'
                                            : 'Support unknown'
                                      }
                                    >
                                      {status.label}
                                    </span>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="mib-main-right">
                  {!mibSelectedDefinition ? (
                    <div className="empty-state">Select an object to view details.</div>
                  ) : (
                    (() => {
                      const kind = String(mibSelectedDefinition.kind || '').toUpperCase();
                      const isFault = kind === 'NOTIFICATION-TYPE' || kind === 'TRAP-TYPE';
                      const isPerf = kind === 'OBJECT-TYPE';
                      const activeTab = isFault ? 'fault' : isPerf ? 'performance' : 'fault';
                      const actionTitle =
                        activeTab === 'fault' ? 'Fault Actions' : 'Performance Actions';
                      const actionSubtitle =
                        activeTab === 'fault'
                          ? 'Draft your fault pipeline and correlate events.'
                          : 'Draft performance handling and metric tags.';
                      return (
                        <div className="mib-definition-details">
                          <div className="mib-definition-header">
                            <div className="mib-definition-title">
                              {mibSelectedDefinition.name}
                            </div>
                            <span className="mib-definition-pill">
                              {activeTab === 'fault' ? 'Fault' : 'Performance'}
                            </span>
                          </div>
                          <div className="mib-definition-meta">
                            <span>Kind: {mibSelectedDefinition.kind}</span>
                            <span>
                              OID (numeric): {mibSelectedDefinition.fullOid || '—'}
                            </span>
                            <span>OID (symbolic): {mibSelectedDefinition.oid || '—'}</span>
                          </div>
                          <div className="mib-definition-meta">
                            {mibSelectedDefinition.module && (
                              <span>Module: {mibSelectedDefinition.module}</span>
                            )}
                            {mibSelectedDefinition.syntax && (
                              <span>Syntax: {mibSelectedDefinition.syntax}</span>
                            )}
                            {mibSelectedDefinition.access && (
                              <span>Access: {mibSelectedDefinition.access}</span>
                            )}
                            {mibSelectedDefinition.status && (
                              <span>Status: {mibSelectedDefinition.status}</span>
                            )}
                            {mibSelectedDefinition.defval && (
                              <span>Default: {mibSelectedDefinition.defval}</span>
                            )}
                            {mibSelectedDefinition.index && (
                              <span>Index: {mibSelectedDefinition.index}</span>
                            )}
                          </div>
                          {mibSelectedDefinition.description && (
                            <div className="mib-definition-description">
                              {mibSelectedDefinition.description}
                            </div>
                          )}
                          {isPerf && (
                            <div className="mib-action-card">
                              <div className="mib-action-header">
                                <div>
                                  <div className="mib-action-title">
                                    PCOM SNMP Config (temporary)
                                  </div>
                                  <div className="mib-action-subtitle">
                                    Draft device targeting for SNMP polling.
                                  </div>
                                  <div className="mib-action-hint">
                                    Uses device IP only when polling.
                                  </div>
                                </div>
                              </div>
                              <div className="mib-snmp-profile-meta">
                                {pcomAdvancedActive ? (
                                  <span className="muted">
                                    Advanced settings override the device dropdown.
                                  </span>
                                ) : pcomSnmpProfileLoading ? (
                                  <span className="muted">Loading SNMP profile...</span>
                                ) : pcomSnmpProfileError ? (
                                  <span className="error">{pcomSnmpProfileError}</span>
                                ) : pcomSnmpProfile ? (
                                  <>
                                    <span className="muted">
                                      SNMP profile: {pcomSnmpProfile.description || 'Profile'} (
                                      {formatSnmpVersionLabel(pcomSnmpProfile.version)})
                                      {pcomSnmpProfile.community
                                        ? ` · Community: ${pcomSnmpProfile.community}`
                                        : ''}
                                      {pcomSnmpProfile.zoneName
                                        ? ` · Zone: ${pcomSnmpProfile.zoneName}`
                                        : ''}
                                    </span>
                                    <button
                                      type="button"
                                      className="info-button"
                                      title={formatSnmpProfileTooltip(pcomSnmpProfile)}
                                    >
                                      ?
                                    </button>
                                  </>
                                ) : (
                                  <span className="muted">
                                    Select a device to load its SNMP profile.
                                  </span>
                                )}
                              </div>
                              <div className="mib-action-results">
                                <div className="mib-trap-grid mib-trap-grid-compact">
                                  <label className="mib-field">
                                    Device
                                    <select
                                      value={pcomDeviceIp}
                                      onChange={(e) => setPcomDeviceIp(e.target.value)}
                                      disabled={pcomDevicesLoading || pcomAdvancedActive}
                                    >
                                      <option value="">Select a device</option>
                                      {pcomDevicesLoading ? (
                                        <option value="" disabled>
                                          Loading devices…
                                        </option>
                                      ) : pcomDeviceOptions.length === 0 ? (
                                        <option value="" disabled>
                                          No devices available
                                        </option>
                                      ) : (
                                        pcomDeviceOptionsWithManual.map((device) => (
                                          <option key={device.value} value={device.value}>
                                            {device.label}
                                          </option>
                                        ))
                                      )}
                                    </select>
                                  </label>
                                  <div className="mib-field mib-field-action">
                                    <div className="action-row">
                                      <button
                                        type="button"
                                        className="mib-action-button-secondary"
                                        onClick={openPcomAdvancedModal}
                                      >
                                        Advanced
                                      </button>
                                      {pcomAdvancedActive && (
                                        <button
                                          type="button"
                                          className="mib-action-button-secondary"
                                          onClick={disablePcomAdvanced}
                                        >
                                          Use basic
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mib-field mib-field-action">
                                    <button
                                      type="button"
                                      className="mib-action-button"
                                      onClick={runPcomPoll}
                                      disabled={
                                        pcomPollLoading ||
                                        !pcomActiveTarget ||
                                        !(mibSelectedDefinition?.fullOid ||
                                          mibSelectedDefinition?.oid)
                                      }
                                    >
                                      {pcomPollLoading ? 'Running…' : 'Test Poll'}
                                    </button>
                                  </div>
                                </div>
                                {pcomDevicesError && <div className="error">{pcomDevicesError}</div>}
                              </div>
                            </div>
                          )}
                          <div className="mib-action-card">
                            <div className="mib-action-header">
                              <div>
                                <div className="mib-action-title">
                                  {isPerf ? 'Test Poll Output' : actionTitle}
                                </div>
                                <div className="mib-action-subtitle">
                                  {isPerf
                                    ? 'SNMP walk response from the selected device.'
                                    : actionSubtitle}
                                </div>
                                {!isPerf && (
                                  <div className="mib-action-hint">
                                    Stub generation is coming next.
                                  </div>
                                )}
                              </div>
                            </div>
                            <div
                              className={`mib-action-results${
                                isPerf ? ' mib-action-results-full' : ''
                              }`}
                            >
                              {isPerf ? (
                                pcomPollError || pcomPollOutput ? (
                                  <div className="mib-poll-output">
                                    {pcomPollError && (
                                      <div className="mib-poll-output-error">{pcomPollError}</div>
                                    )}
                                    {pcomPollOutput && (
                                      <pre className="mib-poll-output-body">{pcomPollOutput}</pre>
                                    )}
                                  </div>
                                ) : (
                                  <div className="mib-action-results-empty">
                                    Run Test Poll to see output here.
                                  </div>
                                )
                              ) : (
                                <div className="mib-action-results-empty">
                                  No actions configured yet.
                                </div>
                              )}
                            </div>
                          </div>
                          {!isPerf && (
                            <button
                              type="button"
                              className="action-link"
                              onClick={() => openTrapComposer(mibSelectedDefinition, mibSelectedFile)}
                            >
                              Compose Trap
                            </button>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
