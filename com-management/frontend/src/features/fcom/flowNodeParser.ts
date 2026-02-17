import type { FlowIfNode, FlowNode, FlowProcessorNode } from './flowUtils';

type UnknownRecord = Record<string, unknown>;

type BuildFlowNodesOptions = {
  nextFlowId: () => string;
  nextSwitchCaseId: () => string;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const buildFlowNodesFromProcessors = (
  processors: unknown[],
  options: BuildFlowNodesOptions,
): FlowNode[] => {
  const parseProcessor = (processor: unknown): FlowNode | null => {
    if (!isRecord(processor)) {
      return null;
    }
    const type = Object.keys(processor || {})[0];
    if (!type) {
      return null;
    }
    const payload = isRecord(processor[type]) ? (processor[type] as UnknownRecord) : {};
    if (type === 'if') {
      return {
        id: options.nextFlowId(),
        kind: 'if',
        condition: {
          property: String(payload.source ?? ''),
          operator: String(payload.operator ?? '=='),
          value: String(payload.value ?? ''),
        },
        then: buildFlowNodesFromProcessors(
          Array.isArray(payload.processors) ? payload.processors : [],
          options,
        ),
        else: buildFlowNodesFromProcessors(Array.isArray(payload.else) ? payload.else : [], options),
      } as FlowIfNode;
    }
    if (type === 'foreach') {
      return {
        id: options.nextFlowId(),
        kind: 'processor',
        processorType: 'foreach',
        config: {
          source: payload.source ?? '',
          keyVal: payload.key ?? '',
          valField: payload.value ?? '',
          processors: buildFlowNodesFromProcessors(
            Array.isArray(payload.processors) ? payload.processors : [],
            options,
          ),
        },
      } as FlowProcessorNode;
    }
    if (type === 'switch') {
      const cases = Array.isArray(payload.case) ? payload.case : [];
      return {
        id: options.nextFlowId(),
        kind: 'processor',
        processorType: 'switch',
        config: {
          source: payload.source ?? '',
          operator: payload.operator ?? '',
          cases: cases.map((item) => {
            const caseItem = isRecord(item) ? item : {};
            return {
              id: options.nextSwitchCaseId(),
              match: caseItem.match ?? '',
              operator: caseItem.operator ?? '',
              processors: buildFlowNodesFromProcessors(
                Array.isArray(caseItem.then) ? caseItem.then : [],
                options,
              ),
            };
          }),
          defaultProcessors: buildFlowNodesFromProcessors(
            Array.isArray(payload.default) ? payload.default : [],
            options,
          ),
        },
      } as FlowProcessorNode;
    }
    const config: Record<string, unknown> = { ...(payload || {}) };
    if (type === 'set') {
      const sourceValue = payload.source;
      config.sourceType =
        typeof sourceValue === 'string' && sourceValue.startsWith('$.') ? 'path' : 'literal';
      if (Array.isArray(payload.args)) {
        config.argsText = JSON.stringify(payload.args, null, 2);
      }
    }
    if (type === 'append' && Array.isArray(payload.array)) {
      config.arrayText = JSON.stringify(payload.array, null, 2);
    }
    if (type === 'lookup' && payload.properties && typeof payload.properties === 'object') {
      config.propertiesText = JSON.stringify(payload.properties, null, 2);
    }
    if (type === 'lookup' && payload.fallback && typeof payload.fallback === 'object') {
      config.fallbackText = JSON.stringify(payload.fallback, null, 2);
    }
    return {
      id: options.nextFlowId(),
      kind: 'processor',
      processorType: type,
      config,
    } as FlowProcessorNode;
  };

  return (processors || []).map(parseProcessor).filter((node): node is FlowNode => Boolean(node));
};
