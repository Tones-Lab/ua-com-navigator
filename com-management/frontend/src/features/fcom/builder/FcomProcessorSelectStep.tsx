import type { ReactNode } from 'react';
import type { ProcessorCatalogItem } from './types';

type FcomProcessorSelectStepProps = {
  processorCatalog: ProcessorCatalogItem[];
  processorType: string | null;
  handleBuilderSelect: (item: ProcessorCatalogItem, isEnabled: boolean) => void;
  renderProcessorHelp: (helpKey: string) => ReactNode;
};

export default function FcomProcessorSelectStep({
  processorCatalog,
  processorType,
  handleBuilderSelect,
  renderProcessorHelp,
}: FcomProcessorSelectStepProps) {
  return (
    <div className="processor-grid">
      {processorCatalog.map((item) => {
        const isSelected = processorType === item.id;
        const isEnabled = item.status !== 'planned';
        const buttonLabel = item.paletteLabel || item.label;
        return (
          <div key={item.id} className="processor-card">
            <button
              type="button"
              className={isSelected ? 'builder-card builder-card-selected' : 'builder-card'}
              onClick={() => handleBuilderSelect(item, isEnabled)}
              disabled={!isEnabled}
            >
              {buttonLabel}
            </button>
            {renderProcessorHelp(item.helpKey)}
          </div>
        );
      })}
    </div>
  );
}
