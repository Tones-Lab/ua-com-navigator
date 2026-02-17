import type { ReactNode } from 'react';
import BuilderLink from '../../../components/BuilderLink';
import type { ProcessorFlowNode, ProcessorSwitchCase } from './types';

type FcomProcessorSwitchEditorProps = {
  cases: ProcessorSwitchCase[];
  builderNestedAddType: string;
  builderSwitchCaseAddType: Record<string, string>;
  setBuilderSwitchCaseAddType: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  builderSwitchDefaultAddType: string;
  setBuilderSwitchDefaultAddType: (value: string) => void;
  renderPaletteOptions: () => ReactNode;
  onUpdateCaseMatch: (caseId: string, value: string) => void;
  onUpdateCaseOperator: (caseId: string, value: string) => void;
  onAddCaseProcessor: (caseId: string) => void;
  onRemoveCase: (caseId: string) => void;
  onAddCase: () => void;
  onAddDefaultProcessor: () => void;
  renderCaseFlow: (caseId: string, processors: ProcessorFlowNode[]) => ReactNode;
  renderDefaultFlow: () => ReactNode;
};

export default function FcomProcessorSwitchEditor({
  cases,
  builderNestedAddType,
  builderSwitchCaseAddType,
  setBuilderSwitchCaseAddType,
  builderSwitchDefaultAddType,
  setBuilderSwitchDefaultAddType,
  renderPaletteOptions,
  onUpdateCaseMatch,
  onUpdateCaseOperator,
  onAddCaseProcessor,
  onRemoveCase,
  onAddCase,
  onAddDefaultProcessor,
  renderCaseFlow,
  renderDefaultFlow,
}: FcomProcessorSwitchEditorProps) {
  return (
    <div className="processor-row">
      <label className="builder-label">Cases</label>
      <div className="flow-switch-cases">
        {cases.map((item) => (
          <div key={item.id} className="flow-switch-case">
            <div className="flow-switch-case-row">
              <label className="builder-label">Match</label>
              <input
                className="builder-input"
                value={item.match ?? ''}
                onChange={(e) => onUpdateCaseMatch(item.id, e.target.value)}
              />
            </div>
            <div className="flow-switch-case-row">
              <label className="builder-label">Operator (optional)</label>
              <input
                className="builder-input"
                value={item.operator ?? ''}
                onChange={(e) => onUpdateCaseOperator(item.id, e.target.value)}
              />
            </div>
            <div className="flow-switch-case-row">
              <label className="builder-label">Processors</label>
              <div className="builder-inline-actions">
                <select
                  className="builder-select"
                  value={builderSwitchCaseAddType[item.id] || builderNestedAddType}
                  onChange={(e) =>
                    setBuilderSwitchCaseAddType((prev) => ({
                      ...prev,
                      [item.id]: e.target.value,
                    }))
                  }
                >
                  {renderPaletteOptions()}
                </select>
                <button
                  type="button"
                  className="builder-card"
                  onClick={() => onAddCaseProcessor(item.id)}
                >
                  Add processor
                </button>
              </div>
              {renderCaseFlow(item.id, Array.isArray(item.processors) ? item.processors : [])}
            </div>
            <div className="flow-switch-case-row">
              <BuilderLink onClick={() => onRemoveCase(item.id)}>
                Remove case
              </BuilderLink>
            </div>
          </div>
        ))}
        <BuilderLink onClick={onAddCase}>
          Add case
        </BuilderLink>
      </div>
      <div className="builder-hint">Drag processors to reorder cases or nested processors.</div>
      <label className="builder-label">Default processors</label>
      <div className="builder-inline-actions">
        <select
          className="builder-select"
          value={builderSwitchDefaultAddType}
          onChange={(e) => setBuilderSwitchDefaultAddType(e.target.value)}
        >
          {renderPaletteOptions()}
        </select>
        <button type="button" className="builder-card" onClick={onAddDefaultProcessor}>
          Add processor
        </button>
      </div>
      {renderDefaultFlow()}
    </div>
  );
}
