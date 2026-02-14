import type { ReactNode } from 'react';

type FcomProcessorForeachEditorProps = {
  builderNestedAddType: string;
  setBuilderNestedAddType: (value: string) => void;
  renderPaletteOptions: () => ReactNode;
  onAddProcessor: () => void;
  processorsFlow: ReactNode;
};

export default function FcomProcessorForeachEditor({
  builderNestedAddType,
  setBuilderNestedAddType,
  renderPaletteOptions,
  onAddProcessor,
  processorsFlow,
}: FcomProcessorForeachEditorProps) {
  return (
    <div className="processor-row">
      <label className="builder-label">Per-item processors</label>
      <div className="builder-hint">Add processors to run for each item.</div>
      <div className="builder-inline-actions">
        <select
          className="builder-select"
          value={builderNestedAddType}
          onChange={(e) => setBuilderNestedAddType(e.target.value)}
        >
          {renderPaletteOptions()}
        </select>
        <button type="button" className="builder-card" onClick={onAddProcessor}>
          Add processor
        </button>
      </div>
      {processorsFlow}
    </div>
  );
}
