import FcomBuilderHeader from './builder/FcomBuilderHeader';
import FcomBuilderLiteralSection from './builder/FcomBuilderLiteralSection';
import FcomBuilderProcessorSection from './builder/FcomBuilderProcessorSection';
import FcomBuilderTypeSelector from './builder/FcomBuilderTypeSelector';
import FcomBuilderEvalSection from './builder/FcomBuilderEvalSection';
import {
  FcomBuilderContextProvider,
  type FcomBuilderContextValue,
} from './builder/FcomBuilderContext';

type FcomBuilderSidebarProps = {
  isAnyPanelEditing: boolean;
  contextValue: FcomBuilderContextValue;
};

export default function FcomBuilderSidebar({
  isAnyPanelEditing,
  contextValue,
}: FcomBuilderSidebarProps) {
  if (!isAnyPanelEditing) {
    return null;
  }
  const { builderOpen, builderFocus } = contextValue;

  return (
    <FcomBuilderContextProvider value={contextValue}>
      <aside className={`builder-sidebar${builderOpen ? '' : ' builder-sidebar-collapsed'}`}>
        <FcomBuilderHeader />
        {builderOpen && (
          <div className="builder-body">
            <FcomBuilderTypeSelector />
            {builderFocus === 'literal' && <FcomBuilderLiteralSection />}
            {builderFocus === 'eval' && <FcomBuilderEvalSection />}
            {builderFocus === 'processor' && <FcomBuilderProcessorSection />}
          </div>
        )}
      </aside>
    </FcomBuilderContextProvider>
  );
}
