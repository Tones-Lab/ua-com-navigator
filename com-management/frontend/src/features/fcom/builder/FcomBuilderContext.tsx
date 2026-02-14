import {
  createContext,
  useContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type {
  BuilderCondition,
  BuilderMode,
  BuilderOverrideVersion,
  BuilderSwitchModalState,
  FlowPaletteItem,
  ProcessorCatalogItem,
  ProcessorBuilderConfig,
  ProcessorFlowNode,
  BuilderTarget,
  BuilderType,
  OpenAdvancedFlowModal,
  ProcessorStep,
  RenderConditionNode,
  RenderFlowList,
  RenderProcessorConfigFields,
} from './types';

export type FcomBuilderContextValue = {
  builderOpen: boolean;
  builderTarget: BuilderTarget;
  builderOverrideVersion: BuilderOverrideVersion;
  builderDirty: boolean;
  canUndoBuilder: boolean;
  canRedoBuilder: boolean;
  handleBuilderUndo: () => void;
  handleBuilderRedo: () => void;
  setShowBuilderHelpModal: (open: boolean) => void;
  requestCancelBuilder: () => void;
  builderFocus: BuilderType | null;
  builderPatchMode: boolean;
  builderPatchPreview: any | null;
  isBuilderTargetReady: boolean;
  builderTypeLocked: BuilderType | null;
  setBuilderSwitchModal: Dispatch<SetStateAction<BuilderSwitchModalState>>;
  applyBuilderTypeSwitch: (type: BuilderType) => void;
  builderLiteralText: string;
  handleLiteralInputChange: (value: string, caret: number | null, inputType?: string) => void;
  literalDirty: boolean;
  applyLiteralValue: () => void;
  builderMode: BuilderMode;
  setBuilderMode: (mode: BuilderMode) => void;
  hasEditPermission: boolean;
  setAdvancedProcessorScope: (scope: 'object' | 'global') => void;
  setShowAdvancedProcessorModal: (open: boolean) => void;
  builderConditions: BuilderCondition[];
  setBuilderConditions: Dispatch<SetStateAction<BuilderCondition[]>>;
  updateBuilderCondition: (
    rowId: string,
    conditionId: string,
    key: 'left' | 'operator' | 'right',
    value: string,
  ) => void;
  handleFriendlyConditionInputChange: (
    rowId: string,
    conditionId: string,
    key: 'left' | 'right',
    value: string,
    caret: number | null,
    inputType?: string,
  ) => void;
  handleFriendlyResultInputChange: (
    rowId: string,
    value: string,
    caret: number | null,
    inputType?: string,
  ) => void;
  handleFriendlyElseResultInputChange: (
    value: string,
    caret: number | null,
    inputType?: string,
  ) => void;
  removeBuilderRow: (rowId: string) => void;
  addBuilderRow: () => void;
  createConditionNode: () => any;
  createGroupNode: () => any;
  nextBuilderId: () => string;
  renderConditionNode: RenderConditionNode;
  builderElseResult: string;
  friendlyPreview: string;
  applyFriendlyEval: () => void;
  formatEvalReadableList: (value: string) => string[];
  builderRegularText: string;
  handleRegularEvalInputChange: (value: string, caret: number | null, inputType?: string) => void;
  clearRegularEval: () => void;
  applyRegularEval: () => void;
  applyBuilderTemplate: (template: string) => void;
  openAdvancedFlowModal: OpenAdvancedFlowModal;
  processorStep: ProcessorStep;
  setProcessorStep: (step: ProcessorStep) => void;
  processorType: string | null;
  processorPayload: any;
  processorCatalog: ProcessorCatalogItem[];
  handleBuilderSelect: (item: ProcessorCatalogItem, isEnabled: boolean) => void;
  builderProcessorConfig: ProcessorBuilderConfig;
  setBuilderProcessorConfig: Dispatch<SetStateAction<ProcessorBuilderConfig>>;
  builderNestedAddType: string;
  setBuilderNestedAddType: (value: string) => void;
  builderPaletteItems: FlowPaletteItem[];
  builderSwitchCaseAddType: Record<string, string>;
  setBuilderSwitchCaseAddType: Dispatch<SetStateAction<Record<string, string>>>;
  builderSwitchDefaultAddType: string;
  setBuilderSwitchDefaultAddType: (value: string) => void;
  createFlowNodeFromPaletteValue: (value: string) => ProcessorFlowNode;
  renderProcessorHelp: (helpKey: string) => ReactNode;
  renderProcessorConfigFields: RenderProcessorConfigFields;
  renderFlowList: RenderFlowList;
  getProcessorCatalogLabel: (processorType: string) => string;
  getProcessorSummaryLines: (payload: any) => string[];
  showProcessorJson: boolean;
  setShowProcessorJson: Dispatch<SetStateAction<boolean>>;
  applyProcessor: () => void;
  nextSwitchCaseId: () => string;
};

const FcomBuilderContext = createContext<FcomBuilderContextValue | null>(null);

export function FcomBuilderContextProvider({
  value,
  children,
}: {
  value: FcomBuilderContextValue;
  children: ReactNode;
}) {
  return <FcomBuilderContext.Provider value={value}>{children}</FcomBuilderContext.Provider>;
}

export function useFcomBuilderContext() {
  const context = useContext(FcomBuilderContext);
  if (!context) {
    throw new Error('useFcomBuilderContext must be used within FcomBuilderContextProvider');
  }
  return context;
}
