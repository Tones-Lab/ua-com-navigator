type LegacyFolderFileSummaryPanelProps = {
  folderSummaries: any[];
  fileSummaries: any[];
};

export default function LegacyFolderFileSummaryPanel({
  folderSummaries,
  fileSummaries,
}: LegacyFolderFileSummaryPanelProps) {
  if (folderSummaries.length === 0 && fileSummaries.length === 0) {
    return null;
  }

  return (
    <div className="legacy-summary-panel">
      <div className="legacy-report-title">Folder & File Summary</div>
      {folderSummaries.length > 0 && (
        <div className="legacy-summary-table">
          <div className="legacy-summary-row legacy-summary-header">
            <div>Folder</div>
            <div>Total</div>
            <div>Fault</div>
            <div>Perf</div>
            <div>Unknown</div>
          </div>
          {folderSummaries.slice(0, 8).map((entry: any) => (
            <div key={entry.folder} className="legacy-summary-row">
              <div className="legacy-summary-path">{entry.folder}</div>
              <div>{entry.totalObjects}</div>
              <div>{entry.faultObjects}</div>
              <div>{entry.performanceObjects}</div>
              <div>{entry.unknownObjects}</div>
            </div>
          ))}
        </div>
      )}
      {fileSummaries.length > 0 && (
        <div className="legacy-summary-table">
          <div className="legacy-summary-row legacy-summary-header">
            <div>File</div>
            <div>Total</div>
            <div>Fault</div>
            <div>Perf</div>
            <div>Unknown</div>
          </div>
          {fileSummaries.slice(0, 8).map((entry: any) => (
            <div key={entry.filePath} className="legacy-summary-row">
              <div className="legacy-summary-path">{entry.filePath}</div>
              <div>{entry.totalObjects}</div>
              <div>{entry.faultObjects}</div>
              <div>{entry.performanceObjects}</div>
              <div>{entry.unknownObjects}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
