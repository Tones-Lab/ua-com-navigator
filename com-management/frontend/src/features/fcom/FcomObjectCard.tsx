import type { ReactNode } from 'react';
import FcomEventAdditionalFields from './FcomEventAdditionalFields';

type FcomObjectCardProps = {
  obj: any;
  idx: number;
  objectKey: string;
  highlightObjectKeys: string[];
  searchHighlightActive: boolean;
  registerObjectRowRef: (key: string, node: HTMLDivElement | null) => void;
  matchPingKey: string | null;
  getOverrideFlags: (obj: any) => any;
  getOverrideTargets: (obj: any) => Set<string>;
  getProcessorTargets: (obj: any) => Set<string>;
  getProcessorFieldSummary: (obj: any, field: string) => string;
  getOverrideValueMap: (obj: any) => Map<string, any>;
  getEventOverrideFields: (obj: any) => string[];
  panelEditState: Record<string, boolean>;
  getPanelDirtyFields: (obj: any, panelKey: string) => string[];
  getBaseEventFields: (obj: any, panelKey: string) => string[];
  hasEditPermission: boolean;
  showTestControls: boolean;
  isTrapFileContext: boolean;
  openTrapComposerFromTest: (obj: any) => void;
  getObjectDescription: (obj: any) => string;
  isTestableObject: (obj: any) => boolean;
  startEventEdit: (obj: any, panelKey: string) => void;
  openRemoveAllOverridesModal: (obj: any, panelKey: string) => void;
  openAddFieldModal: (panelKey: string, obj: any) => void;
  builderTarget: { panelKey: string; field: string } | null;
  saveEventEdit: (obj: any, panelKey: string) => void;
  requestCancelEventEdit: (obj: any, panelKey: string) => void;
  isFieldHighlighted: (panelKey: string, field: string) => boolean;
  renderFieldBadges: (
    panelKey: string,
    field: string,
    obj: any,
    overrideTargets: Set<string>,
  ) => ReactNode;
  overrideTooltipHoverProps: any;
  openRemoveOverrideModal: (obj: any, field: string, panelKey: string) => void;
  renderOverrideSummaryCard: (
    obj: any,
    overrideValueMap: Map<string, any>,
    fields: string[],
    title: string,
  ) => ReactNode;
  isFieldDirty: (obj: any, panelKey: string, field: string) => boolean;
  isFieldPendingRemoval: (panelKey: string, field: string) => boolean;
  isFieldNew: (obj: any, field: string) => boolean;
  getStagedDirtyFields: (obj: any) => string[];
  isFieldStagedDirty: (obj: any, field: string) => boolean;
  isFieldStagedRemoved: (obj: any, field: string) => boolean;
  openBuilderForField: (obj: any, panelKey: string, field: string) => void;
  isFieldLockedByBuilder: (panelKey: string, field: string) => boolean;
  getEffectiveEventValue: (obj: any, field: string) => any;
  getEditableValue: (value: any) => { editable: boolean; display: any };
  panelDrafts: Record<string, any>;
  handleEventInputChange: (
    obj: any,
    panelKey: string,
    field: string,
    value: string,
    caret: number | null,
    inputType?: string,
  ) => void;
  renderSummary: (value: any, trapVars?: any[]) => ReactNode;
  renderValue: (value: any, trapVars?: any[], options?: any) => ReactNode;
  getAdditionalEventFields: (obj: any, panelKey: string) => string[];
  getEventFieldDescription: (field: string) => string;
  formatEventFieldLabel: (field: string) => string;
  getBaseEventDisplay: (obj: any, field: string) => string;
  renderTrapVariables: (vars: any) => ReactNode;
};

export default function FcomObjectCard({
  obj,
  idx,
  objectKey,
  highlightObjectKeys,
  searchHighlightActive,
  registerObjectRowRef,
  matchPingKey,
  getOverrideFlags,
  getOverrideTargets,
  getProcessorTargets,
  getProcessorFieldSummary,
  getOverrideValueMap,
  getEventOverrideFields,
  panelEditState,
  getPanelDirtyFields,
  getBaseEventFields,
  hasEditPermission,
  showTestControls,
  isTrapFileContext,
  openTrapComposerFromTest,
  getObjectDescription,
  isTestableObject,
  startEventEdit,
  openRemoveAllOverridesModal,
  openAddFieldModal,
  builderTarget,
  saveEventEdit,
  requestCancelEventEdit,
  isFieldHighlighted,
  renderFieldBadges,
  overrideTooltipHoverProps,
  openRemoveOverrideModal,
  renderOverrideSummaryCard,
  isFieldDirty,
  isFieldPendingRemoval,
  isFieldNew,
  getStagedDirtyFields,
  isFieldStagedDirty,
  isFieldStagedRemoved,
  openBuilderForField,
  isFieldLockedByBuilder,
  getEffectiveEventValue,
  getEditableValue,
  panelDrafts,
  handleEventInputChange,
  renderSummary,
  renderValue,
  getAdditionalEventFields,
  getEventFieldDescription,
  formatEventFieldLabel,
  getBaseEventDisplay,
  renderTrapVariables,
}: FcomObjectCardProps) {
  const processorFieldKeys = (() => {
    if (!obj || typeof obj !== 'object') {
      return [] as string[];
    }
    const keys = Object.keys(obj).filter((key) => /processor/i.test(key));
    if (keys.length === 0) {
      return [] as string[];
    }
    const preferredOrder = [
      'preProcessors',
      'preprocessors',
      'postProcessors',
      'postprocessors',
      'processors',
      'processor',
    ];
    const ordered: string[] = [];
    preferredOrder.forEach((key) => {
      if (keys.includes(key)) {
        ordered.push(key);
      }
    });
    keys.forEach((key) => {
      if (!ordered.includes(key)) {
        ordered.push(key);
      }
    });
    return ordered;
  })();

  const overrideFlags = getOverrideFlags(obj);
  const overrideTargets = getOverrideTargets(obj);
  const processorTargets = getProcessorTargets(obj);
  const overrideValueMap = getOverrideValueMap(obj);
  const eventPanelKey = `${objectKey}:event`;
  const eventOverrideFields = getEventOverrideFields(obj);
  const panelDirtyFields = panelEditState[eventPanelKey]
    ? getPanelDirtyFields(obj, eventPanelKey)
    : [];
  const stagedDirtyFields = panelEditState[eventPanelKey] ? [] : getStagedDirtyFields(obj);
  const unsavedCount = panelEditState[eventPanelKey]
    ? panelDirtyFields.length
    : stagedDirtyFields.length;
  const baseFields = getBaseEventFields(obj, eventPanelKey);
  const additionalFields = getAdditionalEventFields(obj, eventPanelKey);
  const eventFields = [...baseFields, ...additionalFields];
  const objectDescription = getObjectDescription(obj);
  const trapVars = obj?.trap?.variables;

  const methodPanels = (() => {
    if (!obj || typeof obj !== 'object') {
      return [] as ReactNode[];
    }
    const sections = [
      { key: 'trap', label: 'Trap', data: obj?.trap, exclude: new Set(['variables']) },
      { key: 'syslog', label: 'Syslog', data: obj?.syslog },
      { key: 'webhook', label: 'Webhook', data: obj?.webhook },
      { key: 'corba', label: 'Corba', data: obj?.corba },
      { key: 'rca', label: 'RCA', data: obj?.rca },
      { key: 'vmware', label: 'VMware', data: obj?.vmware },
    ];
    return sections
      .map((section) => {
        if (!section.data || typeof section.data !== 'object') {
          return null;
        }
        if (section.key === 'trap') {
          const trapName = (section.data as any)?.name;
          const trapOid = (section.data as any)?.oid;
          const hasTrapFields = trapName !== undefined || trapOid !== undefined;
          if (!hasTrapFields) {
            return null;
          }
          return (
            <div key={`${objectKey}:${section.key}`} className="object-panel">
              <div className="object-panel-header">
                <span className="object-panel-title">{section.label}</span>
              </div>
              <div className="object-panel-body">
                <div className="object-row object-row-tertiary">
                  <div>
                    <div className="field-header">
                      <div className="field-header-main">
                        <span className="label">Name</span>
                      </div>
                    </div>
                    <span className="value">{renderValue(trapName, trapVars)}</span>
                  </div>
                  <div>
                    <div className="field-header">
                      <div className="field-header-main">
                        <span className="label">OID</span>
                      </div>
                    </div>
                    <span className="value">{renderValue(trapOid, trapVars)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        }
        const entries = Object.keys(section.data)
          .filter((key) => !(section.exclude && section.exclude.has(key)))
          .sort((a, b) => a.localeCompare(b))
          .map((key) => [key, (section.data as any)[key]] as [string, any]);
        if (entries.length === 0) {
          return null;
        }
        return (
          <div key={`${objectKey}:${section.key}`} className="object-panel">
            <div className="object-panel-header">
              <span className="object-panel-title">{section.label}</span>
            </div>
            <div className="object-panel-body">
              <div className="object-row object-row-tertiary">
                {entries.map(([key, value]) => (
                  <div key={`${objectKey}:${section.key}:${key}`}>
                    <div className="field-header">
                      <div className="field-header-main">
                        <span className="label">{key}</span>
                      </div>
                    </div>
                    <span className="value">{renderValue(value, trapVars)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })
      .filter(Boolean) as ReactNode[];
  })();

  const renderProcessorList = (value: any) => {
    if (!Array.isArray(value) || value.length === 0) {
      return <span className="muted">No processors</span>;
    }
    const formatSummary = (processor: any) => {
      if (!processor || typeof processor !== 'object') {
        return {
          type: 'processor',
          action: 'Processor',
          items: [] as Array<{ label: string; value: string }>,
        };
      }
      const type = Object.keys(processor || {})[0] || 'processor';
      const payload = (processor as any)[type] || {};
      const items: Array<{ label: string; value: string }> = [];
      let action = type;
      const target = payload.targetField ? String(payload.targetField) : '';
      const source = payload.source !== undefined ? String(payload.source) : '';
      const pattern = payload.pattern !== undefined ? String(payload.pattern) : '';
      ['source', 'targetField', 'pattern', 'operator', 'match', 'key', 'value'].forEach((key) => {
        if (payload[key] !== undefined) {
          items.push({ label: key, value: String(payload[key]) });
        }
      });
      if (type === 'set') {
        action = target
          ? source.startsWith('$.') || source.startsWith('$v')
            ? `Set ${target} from ${source}`
            : `Set ${target} to ${source}`
          : 'Set value';
      }
      if (type === 'interpolate') {
        action = target ? `Interpolate into ${target}` : 'Interpolate values';
      }
      if (type === 'remove') {
        action = source ? `Remove ${source}` : 'Remove value';
      }
      if (type === 'grok') {
        action = target
          ? `Extract ${target} from ${source || 'source'} with grok pattern`
          : 'Grok extract';
      }
      if (type === 'regex') {
        action = target
          ? `Regex into ${target} from ${source || 'source'}`
          : 'Regex extract';
      }
      if (type === 'rename') {
        action = target && source ? `Rename ${source} to ${target}` : 'Rename value';
      }
      if (type === 'copy') {
        action = target && source ? `Copy ${source} to ${target}` : 'Copy value';
      }
      if (type === 'switch') {
        action = source ? `Switch on ${source}` : 'Switch';
      }
      if (type === 'foreach') {
        action = source ? `For each item in ${source}` : 'For each item';
      }
      if (type === 'if') {
        action = 'If condition matches';
      }
      if (type === 'if') {
        const thenCount = Array.isArray(payload.processors) ? payload.processors.length : 0;
        const elseCount = Array.isArray(payload.else) ? payload.else.length : 0;
        items.push({ label: 'then', value: `${thenCount} step(s)` });
        items.push({ label: 'else', value: `${elseCount} step(s)` });
      }
      if (type === 'switch') {
        const caseCount = Array.isArray(payload.case) ? payload.case.length : 0;
        const defaultCount = Array.isArray(payload.default) ? payload.default.length : 0;
        items.push({ label: 'cases', value: String(caseCount) });
        items.push({ label: 'default', value: `${defaultCount} step(s)` });
      }
      if (type === 'foreach') {
        const procCount = Array.isArray(payload.processors) ? payload.processors.length : 0;
        items.push({ label: 'processors', value: String(procCount) });
      }
      if (type === 'interpolate' && source && target) {
        items.unshift({ label: 'template', value: source });
      }
      if (type === 'regex' && pattern) {
        items.unshift({ label: 'pattern', value: pattern });
      }
      return { type, action, items };
    };

    const renderConditionLabel = (payload: any) => {
      if (!payload || typeof payload !== 'object') {
        return 'condition';
      }
      if (payload.source || payload.operator || payload.value !== undefined) {
        const left = payload.source ?? 'value';
        const operator = payload.operator ?? '';
        const right = payload.value ?? '';
        return `${left} ${operator} ${right}`.trim();
      }
      const groups = payload.conditions?.and || payload.conditions?.or;
      if (Array.isArray(groups) && groups.length > 0) {
        const joiner = Array.isArray(payload.conditions?.and) ? ' AND ' : ' OR ';
        const parts = groups
          .map((item: any) => {
            if (!item || typeof item !== 'object') {
              return '';
            }
            const left = item.property ?? item.source ?? 'value';
            const operator = item.operator ?? '';
            const right = item.value ?? '';
            return `${left} ${operator} ${right}`.trim();
          })
          .filter(Boolean);
        if (parts.length > 0) {
          return parts.join(joiner);
        }
      }
      return 'condition';
    };

    const renderSteps = (steps: any[], depth = 0) => {
      if (!Array.isArray(steps) || steps.length === 0) {
        return <span className="muted">No steps</span>;
      }
      return (
        <div className="processor-steps">
          {steps.map((step, idx) => {
            const summary = formatSummary(step);
            const key = `${summary.type}-${depth}-${idx}`;
            return (
              <div className="processor-step" key={key} style={{ marginLeft: depth * 14 }}>
                <div className="processor-step-title">{summary.action}</div>
                {summary.items.length > 0 && (
                  <div className="processor-step-meta">
                    {summary.items.map((item) => (
                      <span key={`${key}-${item.label}`}>
                        {item.label}: {item.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <div className="processor-list">
        {value.map((processor: any, index: number) => {
          const summary = formatSummary(processor);
          const payload = processor?.[summary.type] || {};
          return (
            <div className="processor-card" key={`${objectKey}-proc-${index}`}>
              <div className="processor-title">{summary.type}</div>
              <div className="processor-action">{summary.action}</div>
              {summary.items.length > 0 ? (
                <div className="object-row object-row-tertiary processor-summary">
                  {summary.items.map((item) => (
                    <div key={`${summary.type}-${item.label}-${index}`}>
                      <div className="field-header">
                        <div className="field-header-main">
                          <span className="label">{item.label}</span>
                        </div>
                      </div>
                      <span className="value">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="muted">No summary fields</div>
              )}
              {summary.type === 'if' && (
                <div className="processor-nested">
                  <div className="processor-nested-title">If {renderConditionLabel(payload)}</div>
                  <div className="processor-nested-block">
                    <span className="processor-nested-label">Then</span>
                    {renderSteps(Array.isArray(payload.processors) ? payload.processors : [], 1)}
                  </div>
                  <div className="processor-nested-block">
                    <span className="processor-nested-label">Else</span>
                    {renderSteps(Array.isArray(payload.else) ? payload.else : [], 1)}
                  </div>
                </div>
              )}
              {summary.type === 'foreach' && (
                <div className="processor-nested">
                  <div className="processor-nested-title">Steps</div>
                  {renderSteps(Array.isArray(payload.processors) ? payload.processors : [], 1)}
                </div>
              )}
              {summary.type === 'switch' && (
                <div className="processor-nested">
                  <div className="processor-nested-title">Cases</div>
                  <div className="processor-switch">
                    {(Array.isArray(payload.case) ? payload.case : []).map(
                      (entry: any, caseIndex: number) => (
                        <div
                          className="processor-nested-block"
                          key={`case-${caseIndex}-${entry?.match || 'case'}`}
                        >
                          <span className="processor-nested-label">
                            Case {entry?.match ?? ''}
                          </span>
                          {renderSteps(Array.isArray(entry?.then) ? entry.then : [], 1)}
                        </div>
                      ),
                    )}
                    <div className="processor-nested-block">
                      <span className="processor-nested-label">Default</span>
                      {renderSteps(Array.isArray(payload.default) ? payload.default : [], 1)}
                    </div>
                  </div>
                </div>
              )}
              <details className="processor-json">
                <summary>View JSON</summary>
                <pre className="code-block">{JSON.stringify(processor, null, 2)}</pre>
              </details>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={(node) => registerObjectRowRef(objectKey, node)}
      className={`object-card${
        highlightObjectKeys.includes(objectKey) ? ' object-card-highlight' : ''
      }${
        searchHighlightActive &&
        highlightObjectKeys.length > 0 &&
        !highlightObjectKeys.includes(objectKey)
          ? ' object-card-dim'
          : ''
      }${matchPingKey === objectKey ? ' object-card-ping' : ''}`}
    >
      <div className="object-header">
        <div className="object-header-main">
          <div className="object-title">
            <span className="object-name">{obj?.['@objectName'] || `Object ${idx + 1}`}</span>
            {obj?.certification && <span className="pill">{obj.certification}</span>}
            {overrideFlags.any && <span className="pill override-pill">Override</span>}
            {overrideFlags.advancedFlow && (
              <span className="pill" title="Advanced Flow configured for this object">
                Advanced Flow
              </span>
            )}
            {highlightObjectKeys.includes(objectKey) && (
              <span className="pill match-pill">Match</span>
            )}
          </div>
          {objectDescription && <div className="object-description">{objectDescription}</div>}
        </div>
        <div className="object-actions">
          {showTestControls && (
            <button
              type="button"
              className="panel-edit-button"
              onClick={() => openTrapComposerFromTest(obj)}
              disabled={!isTestableObject(obj)}
              title={
                isTestableObject(obj)
                  ? 'Send a test trap for this object'
                  : 'No test command found in this object'
              }
            >
              Test trap
            </button>
          )}
        </div>
      </div>
      <div
        className={`object-panel${panelEditState[eventPanelKey] ? ' object-panel-editing' : ''}`}
      >
        <div className="object-panel-header">
          <div className="panel-title-group">
            <span className="object-panel-title">Event</span>
            {eventOverrideFields.length > 0 && (
              <span className="pill override-pill">Overrides ({eventOverrideFields.length})</span>
            )}
            {unsavedCount > 0 && (
              <span className="pill unsaved-pill">Unsaved ({unsavedCount})</span>
            )}
          </div>
          {hasEditPermission && !panelEditState[eventPanelKey] && (
            <button
              type="button"
              className="panel-edit-button"
              onClick={() => startEventEdit(obj, eventPanelKey)}
            >
              Edit
            </button>
          )}
          {hasEditPermission && panelEditState[eventPanelKey] && (
            <div className="panel-edit-actions">
              {eventOverrideFields.length > 1 && (
                <button
                  type="button"
                  className="override-remove-all-button"
                  onClick={() => openRemoveAllOverridesModal(obj, eventPanelKey)}
                >
                  Remove All Overrides
                </button>
              )}
              <button
                type="button"
                className="panel-edit-button"
                onClick={() => openAddFieldModal(eventPanelKey, obj)}
                disabled={builderTarget?.panelKey === eventPanelKey}
                title={
                  builderTarget?.panelKey === eventPanelKey
                    ? 'Finish or cancel the builder to add fields'
                    : ''
                }
              >
                Add Field
              </button>
              <button
                type="button"
                className="panel-edit-button"
                onClick={() => saveEventEdit(obj, eventPanelKey)}
                disabled={panelDirtyFields.length === 0}
                title={panelDirtyFields.length === 0 ? 'No changes to save' : ''}
              >
                Save
              </button>
              <button
                type="button"
                className="panel-edit-button"
                onClick={() => requestCancelEventEdit(obj, eventPanelKey)}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="object-grid">
          <FcomEventAdditionalFields
            additionalFields={eventFields}
            eventPanelKey={eventPanelKey}
            obj={obj}
            overrideTargets={overrideTargets}
            processorTargets={processorTargets}
            getProcessorFieldSummary={getProcessorFieldSummary}
            overrideValueMap={overrideValueMap}
            panelEditState={panelEditState}
            hasEditPermission={hasEditPermission}
            isFieldHighlighted={isFieldHighlighted}
            renderFieldBadges={renderFieldBadges}
            overrideTooltipHoverProps={overrideTooltipHoverProps}
            openRemoveOverrideModal={openRemoveOverrideModal}
            renderOverrideSummaryCard={renderOverrideSummaryCard}
            isFieldDirty={isFieldDirty}
            isFieldPendingRemoval={isFieldPendingRemoval}
            isFieldNew={isFieldNew}
            isFieldStagedDirty={isFieldStagedDirty}
            isFieldStagedRemoved={isFieldStagedRemoved}
            openBuilderForField={openBuilderForField}
            isFieldLockedByBuilder={isFieldLockedByBuilder}
            panelDrafts={panelDrafts}
            handleEventInputChange={handleEventInputChange}
            renderValue={renderValue}
            getEventFieldDescription={getEventFieldDescription}
            formatEventFieldLabel={formatEventFieldLabel}
            getBaseEventDisplay={getBaseEventDisplay}
          />
        </div>
      </div>
      {methodPanels}
      {processorFieldKeys.map((key) => (
        <div
          key={`${objectKey}:${key}`}
          className={`object-panel${
            panelEditState[`${objectKey}:${key}`] ? ' object-panel-editing' : ''
          }`}
        >
          <div className="object-panel-header">
            <span className="object-panel-title">{key}</span>
          </div>
          <div className="object-panel-body">
            {Array.isArray((obj as any)?.[key])
              ? renderProcessorList((obj as any)?.[key])
              : renderValue((obj as any)?.[key])}
          </div>
        </div>
      ))}
      {Array.isArray(obj?.trap?.variables) && obj.trap.variables.length > 0 ? (
        <div
          className={`object-panel${
            panelEditState[`${objectKey}:trap`] ? ' object-panel-editing' : ''
          }`}
        >
          <div className="object-panel-header">
            <span className="object-panel-title">Trap Variables</span>
          </div>
          <div className="object-panel-body">{renderTrapVariables(obj?.trap?.variables)}</div>
        </div>
      ) : null}
    </div>
  );
}
