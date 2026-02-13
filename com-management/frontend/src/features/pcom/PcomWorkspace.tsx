import type { ComponentProps } from 'react';
import ActionRow from '../../components/ActionRow';
import ComFilePreview from '../../components/ComFilePreview';
import { FileTitleRow, ViewToggle } from '../../components/FileHeaderCommon';
import FcomBrowserPanel from '../fcom/FcomBrowserPanel';
import FcomRawPreview from '../fcom/FcomRawPreview';

type PcomWorkspaceProps = {
  comBrowserPanelProps: ComponentProps<typeof FcomBrowserPanel>;
  selectedFile: any | null;
  browseNode: string | null;
  isFavorite: (type: 'file' | 'folder', pathId: string) => boolean;
  toggleFavorite: (favorite: {
    type: 'file' | 'folder';
    pathId: string;
    label: string;
    node?: string;
  }) => void;
  formatDisplayPath: (pathId?: string | null) => string;
  viewMode: 'friendly' | 'preview';
  setViewMode: (mode: 'friendly' | 'preview') => void;
  pcomParsed: any | null;
  pcomObjectEntries: Array<{ key: string; name: string; obj: any }>;
  pcomSelectedObject: { key: string; name: string; obj: any } | null;
  setPcomSelectedObjectKey: (key: string | null) => void;
  formatPcomValue: (value: any) => string;
  editorText: string;
  searchHighlightActive: boolean;
  highlightQuery: string | null;
  rawMatchPositions: number[];
  rawMatchIndex: number;
  handlePrevRawMatch: () => void;
  handleNextRawMatch: () => void;
  renderRawHighlightedText: (text: string, query?: string) => any;
};

export default function PcomWorkspace({
  comBrowserPanelProps,
  selectedFile,
  browseNode,
  isFavorite,
  toggleFavorite,
  formatDisplayPath,
  viewMode,
  setViewMode,
  pcomParsed,
  pcomObjectEntries,
  pcomSelectedObject,
  setPcomSelectedObjectKey,
  formatPcomValue,
  editorText,
  searchHighlightActive,
  highlightQuery,
  rawMatchPositions,
  rawMatchIndex,
  handlePrevRawMatch,
  handleNextRawMatch,
  renderRawHighlightedText,
}: PcomWorkspaceProps) {
  return (
    <div className="split-layout">
      <FcomBrowserPanel {...comBrowserPanelProps} />
      <div className="panel">
        <div className="panel-scroll">
          <div className="file-details">
            <FileTitleRow
              title={selectedFile?.PathName ? selectedFile.PathName : 'Select a PCOM file'}
              path={selectedFile?.PathID ? formatDisplayPath(selectedFile.PathID) : null}
              favorite={
                selectedFile
                  ? {
                      active: isFavorite('file', selectedFile.PathID),
                      onToggle: () =>
                        toggleFavorite({
                          type: 'file',
                          pathId: selectedFile.PathID,
                          label: selectedFile.PathName,
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
                <div className="friendly-view pcom-friendly-view">
                  {!pcomParsed ? (
                    <div className="empty-state">No PCOM data loaded.</div>
                  ) : (
                    <>
                      <div className="pcom-card pcom-summary-card">
                        <div className="pcom-section-title">Vendor Summary</div>
                        <div className="pcom-summary-grid">
                          <div className="pcom-summary-item">
                            <div className="pcom-summary-label">Vendor</div>
                            <div className="pcom-summary-value">
                              {formatPcomValue(pcomParsed['@vendor'])}
                            </div>
                          </div>
                          <div className="pcom-summary-item">
                            <div className="pcom-summary-label">MIBs</div>
                            <div className="pcom-summary-value">{formatPcomValue(pcomParsed.mibs)}</div>
                          </div>
                          <div className="pcom-summary-item">
                            <div className="pcom-summary-label">Enterprise OIDs</div>
                            <div className="pcom-summary-value">
                              {formatPcomValue(pcomParsed.enterpriseOids)}
                            </div>
                          </div>
                          <div className="pcom-summary-item">
                            <div className="pcom-summary-label">Aliases</div>
                            <div className="pcom-summary-value">
                              {formatPcomValue(pcomParsed.aliases)}
                            </div>
                          </div>
                          <div className="pcom-summary-item">
                            <div className="pcom-summary-label">Notes</div>
                            <div className="pcom-summary-value">{formatPcomValue(pcomParsed.notes)}</div>
                          </div>
                          <div className="pcom-summary-item">
                            <div className="pcom-summary-label">Objects</div>
                            <div className="pcom-summary-value">{pcomObjectEntries.length}</div>
                          </div>
                        </div>
                      </div>
                      <div className="pcom-friendly-layout">
                        <div className="pcom-friendly-column">
                          <div className="pcom-card pcom-object-card">
                            <div className="pcom-section-title">
                              Objects ({pcomObjectEntries.length})
                            </div>
                            <div className="pcom-object-list">
                              {pcomObjectEntries.length === 0 ? (
                                <div className="empty-state">No objects found.</div>
                              ) : (
                                pcomObjectEntries.map((entry) => (
                                  <button
                                    key={entry.key}
                                    type="button"
                                    className={`pcom-object-row${
                                      entry.key === pcomSelectedObject?.key
                                        ? ' pcom-object-row-active'
                                        : ''
                                    }`}
                                    onClick={() => setPcomSelectedObjectKey(entry.key)}
                                  >
                                    <div className="pcom-object-row-title">{entry.name}</div>
                                    <div className="pcom-object-row-meta">
                                      {entry.obj?.class && (
                                        <span className="pill">{entry.obj.class}</span>
                                      )}
                                      {entry.obj?.subClass && (
                                        <span className="pill">{entry.obj.subClass}</span>
                                      )}
                                      {entry.obj?.certification && (
                                        <span className="pill">{entry.obj.certification}</span>
                                      )}
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="pcom-friendly-column">
                          <div className="pcom-card pcom-detail-card">
                            <div className="pcom-section-title">Object Details</div>
                            {!pcomSelectedObject ? (
                              <div className="empty-state">Select an object to view details.</div>
                            ) : (
                              (() => {
                                const obj = pcomSelectedObject.obj || {};
                                const snmp = obj.snmp || {};
                                const values = Array.isArray(snmp.values) ? snmp.values : [];
                                const discovery = snmp.discovery || {};
                                const filterLabel = Array.isArray(snmp.filter)
                                  ? `${snmp.filter.length} filter(s)`
                                  : formatPcomValue(snmp.filter);
                                return (
                                  <>
                                    <div className="pcom-detail-title">{pcomSelectedObject.name}</div>
                                    <div className="pcom-detail-grid">
                                      <div className="pcom-detail-label">Class</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(obj.class)}
                                      </div>
                                      <div className="pcom-detail-label">SubClass</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(obj.subClass)}
                                      </div>
                                      <div className="pcom-detail-label">Certification</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(obj.certification)}
                                      </div>
                                      <div className="pcom-detail-label">Weight</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(obj.weight)}
                                      </div>
                                      <div className="pcom-detail-label">Domain</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(obj.domain)}
                                      </div>
                                      <div className="pcom-detail-label">Method</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(obj.method)}
                                      </div>
                                      <div className="pcom-detail-label">Description</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(obj.description)}
                                      </div>
                                    </div>
                                    <div className="pcom-section-subtitle">SNMP</div>
                                    <div className="pcom-detail-grid">
                                      <div className="pcom-detail-label">Discovery Name</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(discovery.name)}
                                      </div>
                                      <div className="pcom-detail-label">Discovery OID</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(discovery.oid)}
                                      </div>
                                      <div className="pcom-detail-label">Instance</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(snmp.instance)}
                                      </div>
                                      <div className="pcom-detail-label">Factor</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(snmp.factor)}
                                      </div>
                                      <div className="pcom-detail-label">Maximum</div>
                                      <div className="pcom-detail-value">
                                        {formatPcomValue(snmp.maximum)}
                                      </div>
                                      <div className="pcom-detail-label">Filter</div>
                                      <div className="pcom-detail-value">{filterLabel}</div>
                                      <div className="pcom-detail-label">Values</div>
                                      <div className="pcom-detail-value">{values.length}</div>
                                    </div>
                                    <div className="pcom-section-subtitle">Values</div>
                                    <div className="pcom-values-list">
                                      {values.length === 0 ? (
                                        <div className="empty-state">No values defined.</div>
                                      ) : (
                                        values.map((value: any, index: number) => {
                                          const title =
                                            value?.name ||
                                            value?.metricType ||
                                            `Value ${index + 1}`;
                                          return (
                                            <div key={`${title}-${index}`} className="pcom-value-row">
                                              <div className="pcom-value-title">{title}</div>
                                              <div className="pcom-value-meta">
                                                <span>
                                                  Metric: {formatPcomValue(value?.metricType)}
                                                </span>
                                                <span>
                                                  Type: {formatPcomValue(value?.valueType)}
                                                </span>
                                                {value?.oid && (
                                                  <span>OID: {formatPcomValue(value?.oid)}</span>
                                                )}
                                                {value?.eval && <span>Eval</span>}
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>
                                  </>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
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
