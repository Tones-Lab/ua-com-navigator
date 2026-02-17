type SupportStatus = { status: 'ok' | 'warn' | 'unknown'; label: string };

type DefinitionFilter = 'all' | 'fcom' | 'pcom';

type MibObjectsPanelProps = {
  mibDefinitionSearch: string;
  mibObjectFilter: DefinitionFilter;
  totalCount: number;
  filteredCounts: { fcom: number; pcom: number };
  mibDetailsLoading: boolean;
  filteredMibDefinitions: any[];
  mibSelectedDefinition: any | null;
  mibSelectedSupport: any | null;
  setMibDefinitionSearch: (value: string) => void;
  setMibObjectFilter: (value: DefinitionFilter) => void;
  setMibSelectedDefinition: (definition: any | null) => void;
  getMibSupportStatus: (support: any) => SupportStatus;
  pcomAdvancedActive: boolean;
  pcomAdvancedSummary: string;
  pcomSnmpProfileLoading: boolean;
  pcomSnmpProfileError: string | null;
  pcomSnmpProfile: any | null;
  formatSnmpVersionLabel: (value: string) => string;
  formatSnmpProfileTooltip: (profile: any) => string;
  pcomDeviceIp: string;
  setPcomDeviceIp: (value: string) => void;
  pcomDevicesLoading: boolean;
  pcomDeviceOptions: Array<{ value: string; label: string }>;
  pcomDeviceOptionsWithManual: Array<{ value: string; label: string }>;
  pcomDevicesError: string | null;
  openPcomAdvancedModal: () => void;
  disablePcomAdvanced: () => void;
  runPcomPoll: () => void;
  pcomPollLoading: boolean;
  pcomActiveTarget: string | null;
  pcomPollError: string | null;
  pcomPollOutput: string | null;
  openTrapComposer: (definition: any, path: string | null) => void;
  mibSelectedFile: string | null;
};

export default function MibObjectsPanel({
  mibDefinitionSearch,
  mibObjectFilter,
  totalCount,
  filteredCounts,
  mibDetailsLoading,
  filteredMibDefinitions,
  mibSelectedDefinition,
  mibSelectedSupport,
  setMibDefinitionSearch,
  setMibObjectFilter,
  setMibSelectedDefinition,
  getMibSupportStatus,
  pcomAdvancedActive,
  pcomAdvancedSummary,
  pcomSnmpProfileLoading,
  pcomSnmpProfileError,
  pcomSnmpProfile,
  formatSnmpVersionLabel,
  formatSnmpProfileTooltip,
  pcomDeviceIp,
  setPcomDeviceIp,
  pcomDevicesLoading,
  pcomDeviceOptions,
  pcomDeviceOptionsWithManual,
  pcomDevicesError,
  openPcomAdvancedModal,
  disablePcomAdvanced,
  runPcomPoll,
  pcomPollLoading,
  pcomActiveTarget,
  pcomPollError,
  pcomPollOutput,
  openTrapComposer,
  mibSelectedFile,
}: MibObjectsPanelProps) {
  return (
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
              className={mibObjectFilter === 'all' ? 'mib-facet-chip active' : 'mib-facet-chip'}
              onClick={() => setMibObjectFilter('all')}
            >
              <span className="mib-facet-label">All</span>
              <span className="mib-facet-count">{totalCount}</span>
            </button>
            <button
              type="button"
              className={
                mibObjectFilter === 'fcom'
                  ? 'mib-facet-chip mib-facet-fcom active'
                  : 'mib-facet-chip mib-facet-fcom'
              }
              onClick={() => setMibObjectFilter('fcom')}
            >
              <span className="mib-facet-label">FCOM</span>
              <span className="mib-facet-count">{filteredCounts.fcom}</span>
            </button>
            <button
              type="button"
              className={
                mibObjectFilter === 'pcom'
                  ? 'mib-facet-chip mib-facet-pcom active'
                  : 'mib-facet-chip mib-facet-pcom'
              }
              onClick={() => setMibObjectFilter('pcom')}
            >
              <span className="mib-facet-label">PCOM</span>
              <span className="mib-facet-count">{filteredCounts.pcom}</span>
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
            <div className="empty-state guided-empty">
              <div className="guided-empty-title">No objects match.</div>
              <div className="guided-empty-text">Try clearing the search or switching the filter.</div>
            </div>
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
                  const isFcom = kind === 'NOTIFICATION-TYPE' || kind === 'TRAP-TYPE';
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
                        {isFcom && <span className="mib-support-badge mib-support-badge-fcom">FCOM</span>}
                        {isPcom && <span className="mib-support-badge mib-support-badge-pcom">PCOM</span>}
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
          <div className="empty-state guided-empty">
            <div className="guided-empty-title">Pick an object.</div>
            <div className="guided-empty-text">
              Select an object to see details, actions, and test output.
            </div>
          </div>
        ) : (
          (() => {
            const kind = String(mibSelectedDefinition.kind || '').toUpperCase();
            const isFault = kind === 'NOTIFICATION-TYPE' || kind === 'TRAP-TYPE';
            const isPerf = kind === 'OBJECT-TYPE';
            const activeTab = isFault ? 'fault' : isPerf ? 'performance' : 'fault';
            const actionTitle = activeTab === 'fault' ? 'Fault Actions' : 'Performance Actions';
            const actionSubtitle =
              activeTab === 'fault'
                ? 'Draft your fault pipeline and correlate events.'
                : 'Draft performance handling and metric tags.';
            return (
              <div className="mib-definition-details">
                <div className="mib-definition-header">
                  <div className="mib-definition-title">{mibSelectedDefinition.name}</div>
                  <span className="mib-definition-pill">
                    {activeTab === 'fault' ? 'Fault' : 'Performance'}
                  </span>
                </div>
                <div className="mib-definition-meta">
                  <span>Kind: {mibSelectedDefinition.kind}</span>
                  <span>OID (numeric): {mibSelectedDefinition.fullOid || '—'}</span>
                  <span>OID (symbolic): {mibSelectedDefinition.oid || '—'}</span>
                </div>
                <div className="mib-definition-meta">
                  {mibSelectedDefinition.module && <span>Module: {mibSelectedDefinition.module}</span>}
                  {mibSelectedDefinition.syntax && <span>Syntax: {mibSelectedDefinition.syntax}</span>}
                  {mibSelectedDefinition.access && <span>Access: {mibSelectedDefinition.access}</span>}
                  {mibSelectedDefinition.status && <span>Status: {mibSelectedDefinition.status}</span>}
                  {mibSelectedDefinition.defval && <span>Default: {mibSelectedDefinition.defval}</span>}
                  {mibSelectedDefinition.index && <span>Index: {mibSelectedDefinition.index}</span>}
                </div>
                {mibSelectedDefinition.description && (
                  <div className="mib-definition-description">{mibSelectedDefinition.description}</div>
                )}
                {isPerf && (
                  <div className="mib-action-card">
                    <div className="mib-action-header">
                      <div>
                        <div className="mib-action-title">PCOM SNMP Config (temporary)</div>
                        <div className="mib-action-subtitle">Draft device targeting for SNMP polling.</div>
                        <div className="mib-action-hint">Uses device IP only when polling.</div>
                      </div>
                    </div>
                    <div className="mib-snmp-profile-meta">
                      {pcomAdvancedActive ? (
                        <span className="muted">Advanced settings override the device dropdown.</span>
                      ) : pcomSnmpProfileLoading ? (
                        <span className="muted">Loading SNMP profile...</span>
                      ) : pcomSnmpProfileError ? (
                        <span className="error">{pcomSnmpProfileError}</span>
                      ) : pcomSnmpProfile ? (
                        <>
                          <span className="muted">
                            SNMP profile: {pcomSnmpProfile.description || 'Profile'} ({formatSnmpVersionLabel(pcomSnmpProfile.version)})
                            {pcomSnmpProfile.community ? ` · Community: ${pcomSnmpProfile.community}` : ''}
                            {pcomSnmpProfile.zoneName ? ` · Zone: ${pcomSnmpProfile.zoneName}` : ''}
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
                        <span className="muted">Select a device to load its SNMP profile.</span>
                      )}
                    </div>
                    {pcomAdvancedActive && pcomAdvancedSummary && (
                      <div className="mib-advanced-summary">
                        <span className="mib-advanced-label">Advanced active:</span>
                        <span className="mib-advanced-text">{pcomAdvancedSummary}</span>
                      </div>
                    )}
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
                              {pcomAdvancedActive ? 'Edit advanced' : 'Advanced settings'}
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
                              !(mibSelectedDefinition?.fullOid || mibSelectedDefinition?.oid)
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
                      <div className="mib-action-title">{isPerf ? 'Test Poll Output' : actionTitle}</div>
                      <div className="mib-action-subtitle">
                        {isPerf
                          ? 'SNMP walk response from the selected device.'
                          : actionSubtitle}
                      </div>
                      {!isPerf && <div className="mib-action-hint">Stub generation is coming next.</div>}
                    </div>
                  </div>
                  <div className={`mib-action-results${isPerf ? ' mib-action-results-full' : ''}`}>
                    {isPerf ? (
                      pcomPollError || pcomPollOutput ? (
                        <div className="mib-poll-output">
                          {pcomPollError && <div className="mib-poll-output-error">{pcomPollError}</div>}
                          {pcomPollOutput && <pre className="mib-poll-output-body">{pcomPollOutput}</pre>}
                        </div>
                      ) : (
                        <div className="mib-action-results-empty">Run Test Poll to see output here.</div>
                      )
                    ) : (
                      <div className="mib-action-results-empty">No actions configured yet.</div>
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
  );
}
