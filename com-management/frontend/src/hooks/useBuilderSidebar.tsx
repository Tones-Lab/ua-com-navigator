import { useMemo } from 'react';
import FcomBuilderSidebar from '../features/fcom/FcomBuilderSidebar';
import type { FcomBuilderContextValue } from '../features/fcom/builder/FcomBuilderContext';

type UseBuilderSidebarArgs = {
  isAnyPanelEditing: boolean;
  contextValue: FcomBuilderContextValue;
};

export default function useBuilderSidebar({
  isAnyPanelEditing,
  contextValue,
}: UseBuilderSidebarArgs) {
  return useMemo(
    () => (
      <FcomBuilderSidebar
        isAnyPanelEditing={isAnyPanelEditing}
        contextValue={contextValue}
      />
    ),
    [isAnyPanelEditing, contextValue],
  );
}