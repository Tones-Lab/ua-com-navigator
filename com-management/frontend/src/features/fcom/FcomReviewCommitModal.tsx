import type { Dispatch, ReactNode, SetStateAction } from 'react';
import Modal from '../../components/Modal';
import BuilderLink from '../../components/BuilderLink';
import Pill from '../../components/Pill';
import EmptyState from '../../components/EmptyState';

type ReviewStep = 'review' | 'commit';

type FcomReviewCommitModalProps = {
  open: boolean;
  reviewStep: ReviewStep;
  stagedDiff: any;
  expandedOriginals: Record<string, boolean>;
  setExpandedOriginals: Dispatch<SetStateAction<Record<string, boolean>>>;
  stagedSectionOpen: Record<string, boolean>;
  setStagedSectionOpen: Dispatch<SetStateAction<Record<string, boolean>>>;
  getFieldChangeLabel: (change: any) => string;
  getBaseObjectValue: (objectName: string, target: string) => any;
  renderInlineDiff: (beforeValue: any, afterValue: any, mode: 'after' | 'original') => ReactNode;
  getProcessorType: (processor: any) => string | null;
  getProcessorSummaryLines: (processor: any) => string[];
  saveLoading: boolean;
  hasEditPermission: boolean;
  onClose: () => void;
  onDiscardChanges: () => void;
  setReviewStep: (step: ReviewStep) => void;
  commitMessage: string;
  setCommitMessage: (message: string) => void;
  onCommit: (message: string) => void;
};

export default function FcomReviewCommitModal({
  open,
  reviewStep,
  stagedDiff,
  expandedOriginals,
  setExpandedOriginals,
  stagedSectionOpen,
  setStagedSectionOpen,
  getFieldChangeLabel,
  getBaseObjectValue,
  renderInlineDiff,
  getProcessorType,
  getProcessorSummaryLines,
  saveLoading,
  hasEditPermission,
  onClose,
  onDiscardChanges,
  setReviewStep,
  commitMessage,
  setCommitMessage,
  onCommit,
}: FcomReviewCommitModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal className="modal-wide" ariaLabel="Review staged changes">
      {reviewStep === 'review' ? (
        <>
          <div className="staged-review-header">
            <h3>Review staged changes</h3>
            <div className="staged-review-actions">
              <BuilderLink
                onClick={() => {
                  const shouldExpand = Object.values(expandedOriginals).some(Boolean) === false;
                  if (!shouldExpand) {
                    setExpandedOriginals({});
                    return;
                  }
                  const next: Record<string, boolean> = {};
                  stagedDiff.sections.forEach((section: any) => {
                    section.fieldChanges.forEach((change: any) => {
                      const changeKey = `${section.title}-${change.target}-${change.action}`;
                      next[changeKey] = true;
                    });
                  });
                  setExpandedOriginals(next);
                }}
                disabled={stagedDiff.totalChanges === 0}
              >
                {Object.values(expandedOriginals).some(Boolean)
                  ? 'Collapse all originals'
                  : 'Expand all originals'}
              </BuilderLink>
            </div>
          </div>
          {stagedDiff.totalChanges === 0 ? (
            <EmptyState>No staged changes.</EmptyState>
          ) : (
            <div className="staged-changes">
              {stagedDiff.sections.map((section: any) => (
                <div key={section.title} className="staged-section">
                  {(() => {
                    const sectionKey = section.title;
                    const isOpen = stagedSectionOpen[sectionKey] ?? false;
                    const fieldCount = section.fieldChanges.length;
                    const processorCount = section.processorChanges.length;
                    return (
                      <>
                        <div className="staged-section-header">
                          <div className="staged-section-title">{section.title}</div>
                          <div className="staged-section-meta">
                            <span>
                              {fieldCount} field change{fieldCount === 1 ? '' : 's'}
                            </span>
                            <span>
                              {processorCount} processor change{processorCount === 1 ? '' : 's'}
                            </span>
                          </div>
                          <BuilderLink
                            onClick={() =>
                              setStagedSectionOpen((prev) => ({
                                ...prev,
                                [sectionKey]: !isOpen,
                              }))
                            }
                          >
                            {isOpen ? 'Collapse' : 'Expand'}
                          </BuilderLink>
                        </div>
                        {!isOpen && (
                          <div className="staged-section-summary">
                            <div className="staged-summary-list">
                              {section.fieldChanges.slice(0, 4).map((change: any) => (
                                <div
                                  key={`${sectionKey}-${change.target}-${change.action}`}
                                  className="staged-summary-item"
                                >
                                  <Pill className={`change-pill change-pill-${change.action}`}>
                                    {getFieldChangeLabel(change)}
                                  </Pill>
                                  <span className="staged-summary-label">{change.target}</span>
                                </div>
                              ))}
                              {section.processorChanges.slice(0, 2).map((change: any, idx: number) => (
                                <div
                                  key={`${sectionKey}-proc-${idx}-${change.action}`}
                                  className="staged-summary-item"
                                >
                                  <Pill className={`change-pill change-pill-${change.action}`}>
                                    {change.action}
                                  </Pill>
                                  <span className="staged-summary-label">
                                    {getProcessorType(change.processor) || 'processor'}
                                  </span>
                                </div>
                              ))}
                              {fieldCount + processorCount > 6 && (
                                <div className="staged-summary-more">+{fieldCount + processorCount - 6} more</div>
                              )}
                            </div>
                          </div>
                        )}
                        {isOpen && (
                          <>
                            {section.fieldChanges.length > 0 && (
                              <div className="staged-group">
                                <div className="staged-group-title">Field changes</div>
                                {section.fieldChanges.map((change: any) => {
                                  const changeKey = `${section.title}-${change.target}-${change.action}`;
                                  const hasOverrideOriginal = change.before !== undefined;
                                  const baseOriginal = getBaseObjectValue(section.objectName, change.target);
                                  const originalValue = hasOverrideOriginal ? change.before : baseOriginal;
                                  const hasOriginal = hasOverrideOriginal || baseOriginal !== undefined;
                                  const isExpanded = Boolean(expandedOriginals[changeKey]);
                                  const originalLabel = hasOverrideOriginal
                                    ? 'Original (override)'
                                    : 'Original (base value)';
                                  return (
                                    <div
                                      key={`${section.title}-${change.target}-${change.action}`}
                                      className="staged-change"
                                    >
                                      <div className="staged-change-header">
                                        <span className="staged-change-label">{change.target}</span>
                                        <Pill className={`change-pill change-pill-${change.action}`}>
                                          {getFieldChangeLabel(change)}
                                        </Pill>
                                      </div>
                                      <div className="staged-change-body">
                                        {change.after !== undefined && (
                                          <div className="staged-change-column">
                                            <div className="staged-change-subtitle">After</div>
                                            <pre className="code-block diff-block">
                                              {renderInlineDiff(originalValue, change.after, 'after')}
                                            </pre>
                                          </div>
                                        )}
                                        {hasOriginal && (
                                          <div className="staged-change-column">
                                            <button
                                              type="button"
                                              className="staged-change-toggle"
                                              onClick={() => {
                                                setExpandedOriginals((prev) => ({
                                                  ...prev,
                                                  [changeKey]: !prev[changeKey],
                                                }));
                                              }}
                                            >
                                              {isExpanded ? 'Hide original' : 'Show original'}
                                            </button>
                                            {isExpanded && (
                                              <>
                                                <div className="staged-change-subtitle">{originalLabel}</div>
                                                {originalValue === undefined ? (
                                                  <div className="staged-change-empty">Not set</div>
                                                ) : (
                                                  <pre className="code-block diff-block">
                                                    {renderInlineDiff(originalValue, change.after, 'original')}
                                                  </pre>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {section.processorChanges.length > 0 && (
                              <div className="staged-group">
                                <div className="staged-group-title">Processor flow changes</div>
                                {section.processorChanges.map((change: any, idx: number) => (
                                  <div
                                    key={`${section.title}-proc-${idx}-${change.action}`}
                                    className="staged-change"
                                  >
                                    <div className="staged-change-header">
                                      <span className="staged-change-label">
                                        {getProcessorType(change.processor) || 'processor'}
                                      </span>
                                      <Pill className={`change-pill change-pill-${change.action}`}>
                                        {change.action}
                                      </Pill>
                                    </div>
                                    <div className="staged-change-body">
                                      <div className="staged-change-column">
                                        <div className="staged-change-subtitle">Summary</div>
                                        <div className="builder-preview-lines">
                                          {getProcessorSummaryLines(change.processor).map((line, lineIdx) => (
                                            <span key={`${line}-${lineIdx}`}>{line}</span>
                                          ))}
                                        </div>
                                        <pre className="code-block">
                                          {JSON.stringify(change.processor, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Close
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={onDiscardChanges}
              disabled={saveLoading}
            >
              Discard changes
            </button>
            <button
              type="button"
              className="builder-card builder-card-primary"
              onClick={() => setReviewStep('commit')}
              disabled={stagedDiff.totalChanges === 0 || !hasEditPermission}
            >
              Continue to Commit
            </button>
          </div>
        </>
      ) : (
        <>
          <h3>Commit message</h3>
          <input
            type="text"
            placeholder="Enter commit message here"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') {
                return;
              }
              e.preventDefault();
              if (saveLoading || !hasEditPermission) {
                return;
              }
              onCommit(commitMessage);
            }}
            disabled={!hasEditPermission}
          />
          <div className="modal-actions">
            <button type="button" onClick={() => setReviewStep('review')}>
              Back to Review
            </button>
            <button
              type="button"
              className="builder-card builder-card-primary"
              onClick={() => {
                onCommit(commitMessage);
              }}
              disabled={saveLoading || !hasEditPermission}
            >
              {saveLoading ? 'Saving…' : 'Commit Changes'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
