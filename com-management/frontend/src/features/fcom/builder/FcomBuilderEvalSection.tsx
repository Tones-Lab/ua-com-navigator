import { useFcomBuilderContext } from './FcomBuilderContext';

export default function FcomBuilderEvalSection() {
  const {
    builderMode,
    setBuilderMode,
    hasEditPermission,
    setAdvancedProcessorScope,
    setShowAdvancedProcessorModal,
    builderConditions,
    setBuilderConditions,
    updateBuilderCondition,
    handleFriendlyConditionInputChange,
    handleFriendlyResultInputChange,
    handleFriendlyElseResultInputChange,
    removeBuilderRow,
    addBuilderRow,
    createConditionNode,
    createGroupNode,
    nextBuilderId,
    renderConditionNode,
    builderElseResult,
    friendlyPreview,
    applyFriendlyEval,
    formatEvalReadableList,
    builderRegularText,
    handleRegularEvalInputChange,
    clearRegularEval,
    applyRegularEval,
    applyBuilderTemplate,
    isBuilderTargetReady,
  } = useFcomBuilderContext();
  return (
    <div className="builder-section">
      <div className="builder-section-title">Eval Builder</div>
      <div className="builder-mode-row">
        <div className="builder-mode-toggle">
          <button
            type="button"
            className={
              builderMode === 'friendly'
                ? 'builder-mode-button builder-mode-button-active'
                : 'builder-mode-button'
            }
            onClick={() => setBuilderMode('friendly')}
          >
            Friendly
          </button>
          <button
            type="button"
            className={
              builderMode === 'regular'
                ? 'builder-mode-button builder-mode-button-active'
                : 'builder-mode-button'
            }
            onClick={() => setBuilderMode('regular')}
          >
            Regular
          </button>
        </div>
        <button
          type="button"
          className="builder-link"
          onClick={() => {
            if (!hasEditPermission) {
              return;
            }
            setAdvancedProcessorScope('object');
            setShowAdvancedProcessorModal(true);
          }}
          disabled={!hasEditPermission}
        >
          Advanced Processors
        </button>
      </div>
      {builderMode === 'friendly' ? (
        <div className="builder-friendly">
          <div className="builder-friendly-rows">
            {builderConditions.map((row) => (
              <div className="builder-condition-block" key={row.id}>
                {row.condition.type === 'condition' ? (
                  <>
                    <div className="builder-friendly-row">
                      <input
                        className="builder-input"
                        value={row.condition.left}
                        onChange={(e) =>
                          handleFriendlyConditionInputChange(
                            row.id,
                            row.condition.id,
                            'left',
                            e.target.value,
                            e.target.selectionStart,
                            (e.nativeEvent as InputEvent | undefined)?.inputType,
                          )
                        }
                        placeholder="$v1"
                        disabled={!isBuilderTargetReady}
                        title={row.condition.left}
                      />
                      <select
                        className="builder-select"
                        value={row.condition.operator}
                        onChange={(e) =>
                          updateBuilderCondition(row.id, row.condition.id, 'operator', e.target.value)
                        }
                        disabled={!isBuilderTargetReady}
                      >
                        <option value="==">==</option>
                        <option value="!=">!=</option>
                        <option value=">">&gt;</option>
                        <option value=">=">&gt;=</option>
                        <option value="<">&lt;</option>
                        <option value="<=">&lt;=</option>
                      </select>
                      <input
                        className="builder-input"
                        value={row.condition.right}
                        onChange={(e) =>
                          handleFriendlyConditionInputChange(
                            row.id,
                            row.condition.id,
                            'right',
                            e.target.value,
                            e.target.selectionStart,
                            (e.nativeEvent as InputEvent | undefined)?.inputType,
                          )
                        }
                        placeholder="1"
                        disabled={!isBuilderTargetReady}
                        title={row.condition.right}
                      />
                      <span className="builder-friendly-arrow">→</span>
                      <input
                        className="builder-input builder-input-result"
                        value={row.result}
                        onChange={(e) =>
                          handleFriendlyResultInputChange(
                            row.id,
                            e.target.value,
                            e.target.selectionStart,
                            (e.nativeEvent as InputEvent | undefined)?.inputType,
                          )
                        }
                        placeholder="result"
                        disabled={!isBuilderTargetReady}
                        title={row.result}
                      />
                      <button
                        type="button"
                        className="builder-remove"
                        onClick={() => removeBuilderRow(row.id)}
                        disabled={!isBuilderTargetReady || builderConditions.length === 1}
                        aria-label="Remove condition"
                      >
                        ×
                      </button>
                    </div>
                    <div className="builder-group-actions">
                      <button
                        type="button"
                        className="builder-link"
                        onClick={() => {
                          const newChild = createConditionNode();
                          setBuilderConditions((prev) =>
                            prev.map((item) =>
                              item.id === row.id
                                ? {
                                    ...item,
                                    condition: {
                                      id: nextBuilderId(),
                                      type: 'group',
                                      operator: 'AND',
                                      children: [item.condition, newChild],
                                    },
                                  }
                                : item,
                            ),
                          );
                        }}
                        disabled={!isBuilderTargetReady}
                      >
                        Add condition
                      </button>
                      <button
                        type="button"
                        className="builder-link"
                        onClick={() => {
                          const newGroup = createGroupNode();
                          setBuilderConditions((prev) =>
                            prev.map((item) =>
                              item.id === row.id
                                ? {
                                    ...item,
                                    condition: {
                                      id: nextBuilderId(),
                                      type: 'group',
                                      operator: 'AND',
                                      children: [item.condition, newGroup],
                                    },
                                  }
                                : item,
                            ),
                          );
                        }}
                        disabled={!isBuilderTargetReady}
                      >
                        Add group
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="builder-group-row">
                    {renderConditionNode(row.id, row.condition, 0, false, 1)}
                    <div className="builder-group-result">
                      <span className="builder-friendly-arrow">→</span>
                      <input
                        className="builder-input builder-input-result"
                        value={row.result}
                        onChange={(e) =>
                          handleFriendlyResultInputChange(
                            row.id,
                            e.target.value,
                            e.target.selectionStart,
                            (e.nativeEvent as InputEvent | undefined)?.inputType,
                          )
                        }
                        placeholder="result"
                        disabled={!isBuilderTargetReady}
                        title={row.result}
                      />
                      <button
                        type="button"
                        className="builder-remove"
                        onClick={() => removeBuilderRow(row.id)}
                        disabled={!isBuilderTargetReady || builderConditions.length === 1}
                        aria-label="Remove condition"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="builder-link" onClick={addBuilderRow} disabled={!isBuilderTargetReady}>
            Add condition
          </button>
          <div className="builder-friendly-else">
            <span className="builder-friendly-label">Else</span>
            <input
              className="builder-input"
              value={builderElseResult}
              onChange={(e) =>
                handleFriendlyElseResultInputChange(
                  e.target.value,
                  e.target.selectionStart,
                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                )
              }
              placeholder="0"
              disabled={!isBuilderTargetReady}
            />
          </div>
          <div className="builder-friendly-actions">
            <button
              type="button"
              className="builder-card builder-card-primary"
              disabled={!isBuilderTargetReady || !friendlyPreview}
              onClick={applyFriendlyEval}
            >
              Apply
            </button>
          </div>
          {isBuilderTargetReady && !friendlyPreview && (
            <div className="builder-hint builder-hint-warning">
              Complete each condition and the Else value to enable Apply.
            </div>
          )}
          <div className="builder-preview">
            <div className="builder-preview-label">Preview</div>
            <div className="builder-preview-value">{friendlyPreview || '—'}</div>
            {friendlyPreview && (
              <details className="builder-preview-details">
                <summary>Expanded view</summary>
                <div className="builder-preview-lines">
                  {formatEvalReadableList(friendlyPreview).map((line, idx) => (
                    <span key={`${line}-${idx}`}>{line}</span>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      ) : (
        <div className="builder-regular">
          <div className="builder-regular-input">
            <textarea
              className="builder-textarea"
              placeholder="Enter raw eval expression"
              value={builderRegularText}
              onChange={(e) =>
                handleRegularEvalInputChange(
                  e.target.value,
                  e.target.selectionStart,
                  (e.nativeEvent as InputEvent | undefined)?.inputType,
                )
              }
              disabled={!isBuilderTargetReady}
            />
            {builderRegularText && (
              <button
                type="button"
                className="builder-clear"
                onClick={clearRegularEval}
                aria-label="Clear eval"
              >
                ×
              </button>
            )}
          </div>
          <div className="builder-regular-actions">
            <button
              type="button"
              className="builder-card builder-card-primary"
              disabled={!isBuilderTargetReady || !builderRegularText.trim()}
              onClick={applyRegularEval}
            >
              Apply
            </button>
          </div>
          {isBuilderTargetReady && !builderRegularText.trim() && (
            <div className="builder-hint builder-hint-warning">
              Enter an expression to enable Apply.
            </div>
          )}
          <div className="builder-regular-templates">
            <div className="builder-example-title">Templates</div>
            <button
              type="button"
              className="builder-card"
              disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
              onClick={() => applyBuilderTemplate('($v1==1) ? 1 : 0')}
            >
              Ternary (if/else)
            </button>
            <button
              type="button"
              className="builder-card"
              disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
              onClick={() => applyBuilderTemplate('($v1==1) ? 1 : (($v1==2) ? 2 : 0)')}
            >
              Else-if chain
            </button>
            <button
              type="button"
              className="builder-card"
              disabled={!isBuilderTargetReady || Boolean(builderRegularText.trim())}
              onClick={() => applyBuilderTemplate('$v1')}
            >
              Variable ($vN)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
