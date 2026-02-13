import PanelHeader from '../../components/PanelHeader';

export default function LegacyWorkspace() {
  return (
    <div className="panel">
      <div className="panel-scroll">
        <PanelHeader title="Legacy Conversion">
          <div className="panel-section">
            <div className="panel-section-title">Purpose</div>
            <div className="muted">
              Upload legacy rules, analyze them, and convert to PCOM or FCOM as much as possible.
            </div>
          </div>
          <div className="panel-section">
            <div className="panel-section-title">Integration</div>
            <ul>
              <li>UA assistant/chatbot-assisted conversion workflow.</li>
              <li>Standalone script option for batch conversion.</li>
            </ul>
          </div>
          <div className="panel-section">
            <div className="panel-section-title">Status</div>
            <div className="empty-state">Stub only (upload + conversion coming soon).</div>
          </div>
        </PanelHeader>
      </div>
    </div>
  );
}
