type SupportStatus = { status: 'ok' | 'warn' | 'unknown'; label: string };

type MibSupportSummaryProps = {
  fcomStatus: SupportStatus;
  pcomStatus: SupportStatus;
  fcomSupportedLabel: string | number;
  pcomSupportedLabel: string | number;
  fcomTotal: number;
  pcomTotal: number;
};

export default function MibSupportSummary({
  fcomStatus,
  pcomStatus,
  fcomSupportedLabel,
  pcomSupportedLabel,
  fcomTotal,
  pcomTotal,
}: MibSupportSummaryProps) {
  return (
    <div className="mib-overview">
      <div className="mib-summary-left">
        <div className="mib-summary-chip mib-summary-chip-fcom">
          <span className="mib-summary-tag">FCOM</span>
          <span className={`mib-support-status mib-support-status-${fcomStatus.status}`}>
            {fcomStatus.label}
          </span>
          <span className="mib-summary-count">
            {fcomSupportedLabel}/{fcomTotal}
          </span>
        </div>
        <div className="mib-summary-chip mib-summary-chip-pcom">
          <span className="mib-summary-tag">PCOM</span>
          <span className={`mib-support-status mib-support-status-${pcomStatus.status}`}>
            {pcomStatus.label}
          </span>
          <span className="mib-summary-count">
            {pcomSupportedLabel}/{pcomTotal}
          </span>
        </div>
      </div>
      <div className="mib-summary-meta">Supported / Total</div>
    </div>
  );
}
