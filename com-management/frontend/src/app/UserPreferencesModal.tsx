import Modal from '../components/Modal';

type CacheStatus = {
  isBuilding?: boolean;
  buildId?: string | number;
  isStale?: boolean;
  lastBuiltAt?: string;
  nextRefreshAt?: string;
  lastClearedAt?: string;
  counts?: { files?: number };
  entryCount?: number;
};

type CacheProgress = {
  phase?: string;
  processed: number;
  total: number;
  unit?: string;
};

type UserPreferencesModalProps = {
  open: boolean;
  overviewRebuildPending: boolean;
  overviewStatus: CacheStatus | null;
  overviewProgress?: CacheProgress;
  overviewProgressPercent: number;
  overviewCacheLabel: string;
  handleRefreshOverviewCache: () => Promise<boolean>;
  searchRebuildPending: boolean;
  searchStatus: CacheStatus | null;
  searchProgress?: CacheProgress;
  searchProgressPercent: number;
  searchCacheLabel: string;
  handleRefreshSearchCache: () => Promise<boolean>;
  folderRebuildPending: boolean;
  folderOverviewStatus: CacheStatus | null;
  folderProgress?: CacheProgress;
  folderProgressPercent: number;
  folderCacheLabel: string;
  handleRefreshFolderCache: () => Promise<boolean>;
  mibTranslateCacheLabel: string;
  refreshMibTranslateStatus: () => Promise<void>;
  cacheActionMessage: string | null;
  formatTime: (value?: string | null) => string;
  onClose: () => void;
};

export default function UserPreferencesModal({
  open,
  overviewRebuildPending,
  overviewStatus,
  overviewProgress,
  overviewProgressPercent,
  overviewCacheLabel,
  handleRefreshOverviewCache,
  searchRebuildPending,
  searchStatus,
  searchProgress,
  searchProgressPercent,
  searchCacheLabel,
  handleRefreshSearchCache,
  folderRebuildPending,
  folderOverviewStatus,
  folderProgress,
  folderProgressPercent,
  folderCacheLabel,
  handleRefreshFolderCache,
  mibTranslateCacheLabel,
  refreshMibTranslateStatus,
  cacheActionMessage,
  formatTime,
  onClose,
}: UserPreferencesModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal ariaLabel="User Preferences & Configuration">
      <h3>User Preferences & Configuration</h3>
      <div className="cache-section">
        <div className="cache-section-header">Overview Cache</div>
        {overviewRebuildPending || overviewStatus?.isBuilding ? (
          <>
            <span className="muted">
              {overviewProgress?.phase || 'Cache refreshing…'}
              {overviewStatus?.buildId ? ` · Build ${overviewStatus.buildId}` : ''}
              {overviewProgress?.total
                ? ` · ${overviewProgress.processed} / ${overviewProgress.total} ${overviewProgress.unit || 'items'}`
                : ''}
            </span>
            <div className="trap-progress" aria-hidden="true">
              <div
                className={`trap-progress-bar${overviewProgress?.total ? '' : ' indeterminate'}`}
                style={{ width: overviewProgress?.total ? `${overviewProgressPercent}%` : '35%' }}
              />
            </div>
          </>
        ) : overviewStatus?.lastBuiltAt ? (
          <span className="muted">
            {overviewStatus.isStale ? 'Stale · ' : ''}
            Last refresh {formatTime(overviewStatus.lastBuiltAt)}
            {overviewCacheLabel ? ` · Cache ${overviewCacheLabel}` : ''}
            {overviewStatus.nextRefreshAt
              ? ` · Next refresh ${formatTime(overviewStatus.nextRefreshAt)}`
              : ''}
          </span>
        ) : (
          <span className="muted">Cache not loaded yet.</span>
        )}
        <div className="cache-action-row">
          <button type="button" className="link-button" onClick={handleRefreshOverviewCache}>
            Refresh Cache
          </button>
        </div>
      </div>

      <div className="cache-section">
        <div className="cache-section-header">Search Index Cache</div>
        {searchRebuildPending || searchStatus?.isBuilding ? (
          <>
            <span className="muted">
              {searchProgress?.phase || 'Cache refreshing…'}
              {searchStatus?.buildId ? ` · Build ${searchStatus.buildId}` : ''}
              {searchProgress?.total
                ? ` · ${searchProgress.processed} / ${searchProgress.total} ${searchProgress.unit || 'items'}`
                : ''}
            </span>
            <div className="trap-progress" aria-hidden="true">
              <div
                className={`trap-progress-bar${searchProgress?.total ? '' : ' indeterminate'}`}
                style={{ width: searchProgress?.total ? `${searchProgressPercent}%` : '35%' }}
              />
            </div>
          </>
        ) : searchStatus?.lastBuiltAt ? (
          <span className="muted">
            {searchStatus.isStale ? 'Stale · ' : ''}
            Indexed {searchStatus.counts?.files || 0} files · Last refresh{' '}
            {formatTime(searchStatus.lastBuiltAt)}
            {searchCacheLabel ? ` · Cache ${searchCacheLabel}` : ''}
            {searchStatus.nextRefreshAt ? ` · Next refresh ${formatTime(searchStatus.nextRefreshAt)}` : ''}
          </span>
        ) : (
          <span className="muted">Cache not loaded yet.</span>
        )}
        <div className="cache-action-row">
          <button type="button" className="link-button" onClick={handleRefreshSearchCache}>
            Refresh Cache
          </button>
        </div>
      </div>

      <div className="cache-section">
        <div className="cache-section-header">Folder Cache</div>
        {folderRebuildPending || folderOverviewStatus?.isBuilding ? (
          <>
            <span className="muted">
              {folderProgress?.phase || 'Cache refreshing…'}
              {folderOverviewStatus?.buildId ? ` · Build ${folderOverviewStatus.buildId}` : ''}
              {folderProgress?.total
                ? ` · ${folderProgress.processed} / ${folderProgress.total} ${folderProgress.unit || 'items'}`
                : ''}
            </span>
            <div className="trap-progress" aria-hidden="true">
              <div
                className={`trap-progress-bar${folderProgress?.total ? '' : ' indeterminate'}`}
                style={{ width: folderProgress?.total ? `${folderProgressPercent}%` : '35%' }}
              />
            </div>
          </>
        ) : folderOverviewStatus?.lastBuiltAt ? (
          <span className="muted">
            {folderOverviewStatus.isStale ? 'Stale · ' : ''}
            {folderCacheLabel
              ? `Cache ${folderCacheLabel} · `
              : `${folderOverviewStatus.entryCount || 0} entries · `}
            Last refresh {formatTime(folderOverviewStatus.lastBuiltAt)}
            {folderOverviewStatus.nextRefreshAt
              ? ` · Next refresh ${formatTime(folderOverviewStatus.nextRefreshAt)}`
              : ''}
          </span>
        ) : folderOverviewStatus?.lastClearedAt ? (
          <span className="muted">
            Cleared · Last refresh {formatTime(folderOverviewStatus.lastClearedAt)}
          </span>
        ) : (
          <span className="muted">Cache not loaded yet.</span>
        )}
        <div className="cache-action-row">
          <button type="button" className="link-button" onClick={handleRefreshFolderCache}>
            Refresh Cache
          </button>
        </div>
      </div>

      <div className="cache-section">
        <div className="cache-section-header">MIB Translate Cache</div>
        {mibTranslateCacheLabel ? (
          <span className="muted">Cache {mibTranslateCacheLabel}</span>
        ) : (
          <span className="muted">Cache not loaded yet.</span>
        )}
        <div className="cache-action-row">
          <button type="button" className="link-button" onClick={refreshMibTranslateStatus}>
            Refresh Stats
          </button>
        </div>
      </div>

      {cacheActionMessage && (
        <div className="success" style={{ marginTop: '1rem' }}>
          {cacheActionMessage}
        </div>
      )}
      <p className="muted" style={{ fontSize: '0.85rem', marginTop: '1rem' }}>
        Rebuilds run on the server and can take a few minutes.
      </p>
      <div className="modal-actions">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
