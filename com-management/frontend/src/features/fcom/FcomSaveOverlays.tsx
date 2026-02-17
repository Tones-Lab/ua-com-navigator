type OverrideSaveStatusEntry = {
  objectName: string;
  fileName: string;
  status: 'queued' | 'saving' | 'retrying' | 'done' | 'failed';
};

type FcomSaveOverlaysProps = {
  saveLoading: boolean;
  saveElapsed: number;
  overrideSaveDisplayStatus: OverrideSaveStatusEntry[];
  redeployLoading: boolean;
  microserviceActionLabel: string | null;
  redeployElapsed: number;
};

export default function FcomSaveOverlays({
  saveLoading,
  saveElapsed,
  overrideSaveDisplayStatus,
  redeployLoading,
  microserviceActionLabel,
  redeployElapsed,
}: FcomSaveOverlaysProps) {
  return (
    <>
      {saveLoading && (
        <div className="save-overlay" aria-live="polite" aria-busy="true">
          <div className="save-overlay-card">
            <div className="save-overlay-main">
              <div className="save-spinner" aria-hidden="true" />
              <div>
                <div className="save-overlay-title">Saving changes…</div>
                <div className="save-overlay-subtitle">
                  Please wait{saveElapsed ? ` • ${saveElapsed}s` : ''}
                </div>
              </div>
            </div>
            {overrideSaveDisplayStatus.length > 0 && (
              <div className="save-overlay-status">
                <div className="save-overlay-status-header">
                  <span>Override files</span>
                  <span>
                    {
                      overrideSaveDisplayStatus.filter(
                        (entry) => entry.status === 'done',
                      ).length
                    }
                    /{overrideSaveDisplayStatus.length} complete
                  </span>
                </div>
                <div className="save-overlay-status-list">
                  {overrideSaveDisplayStatus.map((entry) => {
                    const label =
                      entry.status === 'done'
                        ? 'Done'
                        : entry.status === 'failed'
                          ? 'Failed'
                          : entry.status === 'retrying'
                            ? 'Retrying'
                            : entry.status === 'saving'
                              ? 'Saving'
                              : 'Queued';
                    return (
                      <div
                        key={`${entry.objectName}-${entry.fileName}`}
                        className="save-overlay-status-item"
                      >
                        <span className="save-overlay-status-name">{entry.fileName}</span>
                        <span
                          className={`save-overlay-status-pill save-overlay-status-pill-${entry.status}`}
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {redeployLoading && (
        <div className="save-overlay" aria-live="polite" aria-busy="true">
          <div className="save-overlay-card">
            <div className="save-spinner" aria-hidden="true" />
            <div>
              <div className="save-overlay-title">
                {microserviceActionLabel || 'Updating microservices…'}
              </div>
              <div className="save-overlay-subtitle">
                Please wait{redeployElapsed ? ` • ${redeployElapsed}s` : ''}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
