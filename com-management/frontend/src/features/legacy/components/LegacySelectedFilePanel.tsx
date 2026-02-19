type LegacySelectedFilePanelProps = {
  selectedEntryPath: string;
  selectedContent: string;
};

export default function LegacySelectedFilePanel({
  selectedEntryPath,
  selectedContent,
}: LegacySelectedFilePanelProps) {
  return (
    <div className="panel-section">
      <div className="panel-section-title">Selected File</div>
      <div className="muted">{selectedEntryPath}</div>
      <pre className="code-block">{selectedContent || 'Loading…'}</pre>
    </div>
  );
}
