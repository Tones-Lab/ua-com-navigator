import Pill from '../../components/Pill';
import EmptyState from '../../components/EmptyState';

type PcomObjectEntry = {
  key: string;
  name: string;
  obj: any;
};

type PcomFriendlyViewProps = {
  pcomParsed: any;
  pcomObjectEntries: PcomObjectEntry[];
  pcomSelectedObject: PcomObjectEntry | null;
  setPcomSelectedObjectKey: (key: string) => void;
  formatPcomValue: (value: any) => string;
};

export default function PcomFriendlyView({
  pcomParsed,
  pcomObjectEntries,
  pcomSelectedObject,
  setPcomSelectedObjectKey,
  formatPcomValue,
}: PcomFriendlyViewProps) {
  return (
    <div className="friendly-view pcom-friendly-view">
      {!pcomParsed ? (
        <EmptyState>No PCOM data loaded.</EmptyState>
      ) : (
        <>
          <div className="pcom-card pcom-summary-card">
            <div className="pcom-section-title">Vendor Summary</div>
            <div className="pcom-summary-grid">
              <div className="pcom-summary-item">
                <div className="pcom-summary-label">Vendor</div>
                <div className="pcom-summary-value">{formatPcomValue(pcomParsed['@vendor'])}</div>
              </div>
              <div className="pcom-summary-item">
                <div className="pcom-summary-label">MIBs</div>
                <div className="pcom-summary-value">{formatPcomValue(pcomParsed.mibs)}</div>
              </div>
              <div className="pcom-summary-item">
                <div className="pcom-summary-label">Enterprise OIDs</div>
                <div className="pcom-summary-value">{formatPcomValue(pcomParsed.enterpriseOids)}</div>
              </div>
              <div className="pcom-summary-item">
                <div className="pcom-summary-label">Aliases</div>
                <div className="pcom-summary-value">{formatPcomValue(pcomParsed.aliases)}</div>
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
                <div className="pcom-section-title">Objects ({pcomObjectEntries.length})</div>
                <div className="pcom-object-list">
                  {pcomObjectEntries.length === 0 ? (
                    <EmptyState>No objects found.</EmptyState>
                  ) : (
                    pcomObjectEntries.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        className={`pcom-object-row${
                          entry.key === pcomSelectedObject?.key ? ' pcom-object-row-active' : ''
                        }`}
                        onClick={() => setPcomSelectedObjectKey(entry.key)}
                      >
                        <div className="pcom-object-row-title">{entry.name}</div>
                        <div className="pcom-object-row-meta">
                          {entry.obj?.class && <Pill>{entry.obj.class}</Pill>}
                          {entry.obj?.subClass && <Pill>{entry.obj.subClass}</Pill>}
                          {entry.obj?.certification && <Pill>{entry.obj.certification}</Pill>}
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
                  <EmptyState>Select an object to view details.</EmptyState>
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
                          <div className="pcom-detail-value">{formatPcomValue(obj.class)}</div>
                          <div className="pcom-detail-label">SubClass</div>
                          <div className="pcom-detail-value">{formatPcomValue(obj.subClass)}</div>
                          <div className="pcom-detail-label">Certification</div>
                          <div className="pcom-detail-value">{formatPcomValue(obj.certification)}</div>
                          <div className="pcom-detail-label">Weight</div>
                          <div className="pcom-detail-value">{formatPcomValue(obj.weight)}</div>
                          <div className="pcom-detail-label">Domain</div>
                          <div className="pcom-detail-value">{formatPcomValue(obj.domain)}</div>
                          <div className="pcom-detail-label">Method</div>
                          <div className="pcom-detail-value">{formatPcomValue(obj.method)}</div>
                          <div className="pcom-detail-label">Description</div>
                          <div className="pcom-detail-value">{formatPcomValue(obj.description)}</div>
                        </div>
                        <div className="pcom-section-subtitle">SNMP</div>
                        <div className="pcom-detail-grid">
                          <div className="pcom-detail-label">Discovery Name</div>
                          <div className="pcom-detail-value">{formatPcomValue(discovery.name)}</div>
                          <div className="pcom-detail-label">Discovery OID</div>
                          <div className="pcom-detail-value">{formatPcomValue(discovery.oid)}</div>
                          <div className="pcom-detail-label">Instance</div>
                          <div className="pcom-detail-value">{formatPcomValue(snmp.instance)}</div>
                          <div className="pcom-detail-label">Factor</div>
                          <div className="pcom-detail-value">{formatPcomValue(snmp.factor)}</div>
                          <div className="pcom-detail-label">Maximum</div>
                          <div className="pcom-detail-value">{formatPcomValue(snmp.maximum)}</div>
                          <div className="pcom-detail-label">Filter</div>
                          <div className="pcom-detail-value">{filterLabel}</div>
                          <div className="pcom-detail-label">Values</div>
                          <div className="pcom-detail-value">{values.length}</div>
                        </div>
                        <div className="pcom-section-subtitle">Values</div>
                        <div className="pcom-values-list">
                          {values.length === 0 ? (
                            <EmptyState>No values defined.</EmptyState>
                          ) : (
                            values.map((value: any, index: number) => {
                              const title = value?.name || value?.metricType || `Value ${index + 1}`;
                              return (
                                <div key={`${title}-${index}`} className="pcom-value-row">
                                  <div className="pcom-value-title">{title}</div>
                                  <div className="pcom-value-meta">
                                    <span>Metric: {formatPcomValue(value?.metricType)}</span>
                                    <span>Type: {formatPcomValue(value?.valueType)}</span>
                                    {value?.oid && <span>OID: {formatPcomValue(value?.oid)}</span>}
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
  );
}
