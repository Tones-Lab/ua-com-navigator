import type { Dispatch, SetStateAction } from 'react';
import type {
  FlowPaletteItem,
  ProcessorBuilderConfig,
  ProcessorFlowNode,
  ProcessorSwitchCase,
  RenderFlowList,
} from './types';

type UseProcessorConfigureParams = {
  builderProcessorConfig: ProcessorBuilderConfig;
  setBuilderProcessorConfig: Dispatch<SetStateAction<ProcessorBuilderConfig>>;
  builderPaletteItems: FlowPaletteItem[];
  builderNestedAddType: string;
  builderSwitchCaseAddType: Record<string, string>;
  setBuilderSwitchCaseAddType: Dispatch<SetStateAction<Record<string, string>>>;
  builderSwitchDefaultAddType: string;
  createFlowNodeFromPaletteValue: (value: string) => ProcessorFlowNode;
  nextSwitchCaseId: () => string;
  renderFlowList: RenderFlowList;
};

export default function useProcessorConfigure({
  builderProcessorConfig,
  setBuilderProcessorConfig,
  builderPaletteItems,
  builderNestedAddType,
  builderSwitchCaseAddType,
  setBuilderSwitchCaseAddType,
  builderSwitchDefaultAddType,
  createFlowNodeFromPaletteValue,
  nextSwitchCaseId,
  renderFlowList,
}: UseProcessorConfigureParams) {
  const toArray = (value: unknown): ProcessorFlowNode[] =>
    Array.isArray(value) ? (value as ProcessorFlowNode[]) : [];

  const toCaseArray = (value: unknown): ProcessorSwitchCase[] =>
    Array.isArray(value) ? (value as ProcessorSwitchCase[]) : [];

  const toPaletteValue = (item: FlowPaletteItem) =>
    item.nodeKind === 'if' ? 'if' : (item.processorType as string);

  const renderPaletteOptions = () =>
    builderPaletteItems.map((item) => (
      <option key={`${item.nodeKind}-${item.processorType || 'if'}`} value={toPaletteValue(item)}>
        {item.label}
      </option>
    ));

  const updateBuilderConfig = (
    updater: (prev: ProcessorBuilderConfig) => ProcessorBuilderConfig,
  ) => {
    setBuilderProcessorConfig((prev) => updater(prev ?? {}));
  };

  const updateCases = (
    updater: (cases: ProcessorSwitchCase[]) => ProcessorSwitchCase[],
  ) => {
    updateBuilderConfig((prev) => ({
      ...prev,
      cases: updater(toCaseArray(prev.cases)),
    }));
  };

  const updateCaseEntry = (
    caseId: string,
    updater: (entry: ProcessorSwitchCase) => ProcessorSwitchCase,
  ) => {
    updateCases((cases) => cases.map((entry) => (entry.id === caseId ? updater(entry) : entry)));
  };

  const updateProcessorsField = (
    field: 'processors' | 'defaultProcessors',
    next: ProcessorFlowNode[],
  ) => {
    updateBuilderConfig((prev) => ({
      ...prev,
      [field]: next,
    }));
  };

  const onAddForeachProcessor = () => {
    const node = createFlowNodeFromPaletteValue(builderNestedAddType);
    updateBuilderConfig((prev) => ({
      ...prev,
      processors: [...toArray(prev.processors), node],
    }));
  };

  const renderForeachFlow =
    renderFlowList(
      toArray(builderProcessorConfig.processors),
      { kind: 'root' },
      (updater) => {
        const current = toArray(builderProcessorConfig.processors);
        const next =
          typeof updater === 'function'
            ? (updater as (items: ProcessorFlowNode[]) => ProcessorFlowNode[])(current)
            : updater;
        updateProcessorsField('processors', next);
      },
      'object',
      'object',
    );

  const onUpdateCaseMatch = (caseId: string, value: string) => {
    updateCaseEntry(caseId, (entry) => ({ ...entry, match: value }));
  };

  const onUpdateCaseOperator = (caseId: string, value: string) => {
    updateCaseEntry(caseId, (entry) => ({ ...entry, operator: value }));
  };

  const onAddCaseProcessor = (caseId: string) => {
    const choice = builderSwitchCaseAddType[caseId] || builderNestedAddType;
    const node = createFlowNodeFromPaletteValue(choice);
    updateCaseEntry(caseId, (entry) => ({
      ...entry,
      processors: [...toArray(entry.processors), node],
    }));
  };

  const onRemoveCase = (caseId: string) => {
    updateCases((cases) => cases.filter((entry) => entry.id !== caseId));
    setBuilderSwitchCaseAddType((prev) => {
      const next = { ...prev };
      delete next[caseId];
      return next;
    });
  };

  const onAddCase = () => {
    updateCases((cases) => [
      ...cases,
      {
        id: nextSwitchCaseId(),
        match: '',
        operator: '',
        processors: [],
      },
    ]);
  };

  const onAddDefaultProcessor = () => {
    const node = createFlowNodeFromPaletteValue(builderSwitchDefaultAddType);
    updateBuilderConfig((prev) => ({
      ...prev,
      defaultProcessors: [...toArray(prev.defaultProcessors), node],
    }));
  };

  const renderCaseFlow = (caseId: string, processors: ProcessorFlowNode[]) =>
    renderFlowList(
      toArray(processors),
      { kind: 'root' },
      (updater) => {
        const current = toArray(processors);
        const next =
          typeof updater === 'function'
            ? (updater as (items: ProcessorFlowNode[]) => ProcessorFlowNode[])(current)
            : updater;
        updateCaseEntry(caseId, (entry) => ({
          ...entry,
          processors: next,
        }));
      },
      'object',
      'object',
    );

  const renderDefaultFlow = () =>
    renderFlowList(
      toArray(builderProcessorConfig.defaultProcessors),
      { kind: 'root' },
      (updater) => {
        const current = toArray(builderProcessorConfig.defaultProcessors);
        const next =
          typeof updater === 'function'
            ? (updater as (items: ProcessorFlowNode[]) => ProcessorFlowNode[])(current)
            : updater;
        updateProcessorsField('defaultProcessors', next);
      },
      'object',
      'object',
    );

  return {
    toArray,
    renderPaletteOptions,
    onAddForeachProcessor,
    renderForeachFlow,
    onUpdateCaseMatch,
    onUpdateCaseOperator,
    onAddCaseProcessor,
    onRemoveCase,
    onAddCase,
    onAddDefaultProcessor,
    renderCaseFlow,
    renderDefaultFlow,
  };
}
