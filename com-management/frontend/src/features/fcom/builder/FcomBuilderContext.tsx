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
  ProcessorPayload,
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
  builderPatchPreview: ProcessorPayload | null;
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
  createConditionNode: () => BuilderCondition['condition'];
  createGroupNode: () => BuilderCondition['condition'];
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
  processorPayload: ProcessorPayload | null;
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
  getProcessorSummaryLines: (payload: unknown) => string[];
  showProcessorJson: boolean;
  setShowProcessorJson: Dispatch<SetStateAction<boolean>>;
  applyProcessor: () => void;
  nextSwitchCaseId: () => string;
};

export type FcomBuilderViewContextValue = Pick<
  FcomBuilderContextValue,
  | 'builderOpen'
  | 'builderTarget'
  | 'builderOverrideVersion'
  | 'builderDirty'
  | 'canUndoBuilder'
  | 'canRedoBuilder'
  | 'builderFocus'
  | 'builderPatchMode'
  | 'builderPatchPreview'
  | 'isBuilderTargetReady'
  | 'builderTypeLocked'
  | 'builderLiteralText'
  | 'literalDirty'
  | 'builderMode'
  | 'hasEditPermission'
  | 'builderConditions'
  | 'builderElseResult'
  | 'friendlyPreview'
  | 'builderRegularText'
  | 'processorStep'
  | 'processorType'
  | 'processorPayload'
  | 'processorCatalog'
  | 'builderProcessorConfig'
  | 'builderNestedAddType'
  | 'builderPaletteItems'
  | 'builderSwitchCaseAddType'
  | 'builderSwitchDefaultAddType'
  | 'showProcessorJson'
>;

export type FcomBuilderActionsContextValue = Omit<
  FcomBuilderContextValue,
  keyof FcomBuilderViewContextValue
>;

const FcomBuilderViewContext = createContext<FcomBuilderViewContextValue | null>(null);
const FcomBuilderActionsContext = createContext<FcomBuilderActionsContextValue | null>(null);

export function FcomBuilderContextProvider({
  value,
  children,
}: {
  value: FcomBuilderContextValue;
  children: ReactNode;
}) {
  const viewValue: FcomBuilderViewContextValue = {
    builderOpen: value.builderOpen,
    builderTarget: value.builderTarget,
    builderOverrideVersion: value.builderOverrideVersion,
    builderDirty: value.builderDirty,
    canUndoBuilder: value.canUndoBuilder,
    canRedoBuilder: value.canRedoBuilder,
    builderFocus: value.builderFocus,
    builderPatchMode: value.builderPatchMode,
    builderPatchPreview: value.builderPatchPreview,
    isBuilderTargetReady: value.isBuilderTargetReady,
    builderTypeLocked: value.builderTypeLocked,
    builderLiteralText: value.builderLiteralText,
    literalDirty: value.literalDirty,
    builderMode: value.builderMode,
    hasEditPermission: value.hasEditPermission,
    builderConditions: value.builderConditions,
    builderElseResult: value.builderElseResult,
    friendlyPreview: value.friendlyPreview,
    builderRegularText: value.builderRegularText,
    processorStep: value.processorStep,
    processorType: value.processorType,
    processorPayload: value.processorPayload,
    processorCatalog: value.processorCatalog,
    builderProcessorConfig: value.builderProcessorConfig,
    builderNestedAddType: value.builderNestedAddType,
    builderPaletteItems: value.builderPaletteItems,
    builderSwitchCaseAddType: value.builderSwitchCaseAddType,
    builderSwitchDefaultAddType: value.builderSwitchDefaultAddType,
    showProcessorJson: value.showProcessorJson,
  };

  const actionsValue: FcomBuilderActionsContextValue = {
    handleBuilderUndo: value.handleBuilderUndo,
    handleBuilderRedo: value.handleBuilderRedo,
    setShowBuilderHelpModal: value.setShowBuilderHelpModal,
    requestCancelBuilder: value.requestCancelBuilder,
    setBuilderSwitchModal: value.setBuilderSwitchModal,
    applyBuilderTypeSwitch: value.applyBuilderTypeSwitch,
    handleLiteralInputChange: value.handleLiteralInputChange,
    applyLiteralValue: value.applyLiteralValue,
    setBuilderMode: value.setBuilderMode,
    setAdvancedProcessorScope: value.setAdvancedProcessorScope,
    setShowAdvancedProcessorModal: value.setShowAdvancedProcessorModal,
    setBuilderConditions: value.setBuilderConditions,
    updateBuilderCondition: value.updateBuilderCondition,
    handleFriendlyConditionInputChange: value.handleFriendlyConditionInputChange,
    handleFriendlyResultInputChange: value.handleFriendlyResultInputChange,
    handleFriendlyElseResultInputChange: value.handleFriendlyElseResultInputChange,
    removeBuilderRow: value.removeBuilderRow,
    addBuilderRow: value.addBuilderRow,
    createConditionNode: value.createConditionNode,
    createGroupNode: value.createGroupNode,
    nextBuilderId: value.nextBuilderId,
    renderConditionNode: value.renderConditionNode,
    applyFriendlyEval: value.applyFriendlyEval,
    formatEvalReadableList: value.formatEvalReadableList,
    handleRegularEvalInputChange: value.handleRegularEvalInputChange,
    clearRegularEval: value.clearRegularEval,
    applyRegularEval: value.applyRegularEval,
    applyBuilderTemplate: value.applyBuilderTemplate,
    openAdvancedFlowModal: value.openAdvancedFlowModal,
    setProcessorStep: value.setProcessorStep,
    handleBuilderSelect: value.handleBuilderSelect,
    setBuilderProcessorConfig: value.setBuilderProcessorConfig,
    setBuilderNestedAddType: value.setBuilderNestedAddType,
    setBuilderSwitchCaseAddType: value.setBuilderSwitchCaseAddType,
    setBuilderSwitchDefaultAddType: value.setBuilderSwitchDefaultAddType,
    createFlowNodeFromPaletteValue: value.createFlowNodeFromPaletteValue,
    renderProcessorHelp: value.renderProcessorHelp,
    renderProcessorConfigFields: value.renderProcessorConfigFields,
    renderFlowList: value.renderFlowList,
    getProcessorCatalogLabel: value.getProcessorCatalogLabel,
    getProcessorSummaryLines: value.getProcessorSummaryLines,
    setShowProcessorJson: value.setShowProcessorJson,
    applyProcessor: value.applyProcessor,
    nextSwitchCaseId: value.nextSwitchCaseId,
  };

  return (
    <FcomBuilderViewContext.Provider value={viewValue}>
      <FcomBuilderActionsContext.Provider value={actionsValue}>
        {children}
      </FcomBuilderActionsContext.Provider>
    </FcomBuilderViewContext.Provider>
  );
}

export function useFcomBuilderContext() {
  const viewContext = useContext(FcomBuilderViewContext);
  const actionsContext = useContext(FcomBuilderActionsContext);
  if (!viewContext || !actionsContext) {
    throw new Error('useFcomBuilderContext must be used within FcomBuilderContextProvider');
  }
  return { ...viewContext, ...actionsContext };
}

export function useFcomBuilderViewContext() {
  const context = useContext(FcomBuilderViewContext);
  if (!context) {
    throw new Error('useFcomBuilderViewContext must be used within FcomBuilderContextProvider');
  }
  return context;
}

export function useFcomBuilderActionsContext() {
  const context = useContext(FcomBuilderActionsContext);
  if (!context) {
    throw new Error(
      'useFcomBuilderActionsContext must be used within FcomBuilderContextProvider',
    );
  }
  return context;
}
