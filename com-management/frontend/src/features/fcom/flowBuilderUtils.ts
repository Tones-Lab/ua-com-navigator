import type { FlowNode } from './flowUtils';

type NormalizeSourcePath = (value: string) => string;
type ProcessorPayload = Record<string, unknown>;
type ProcessorConfig = Record<string, unknown>;
type SwitchCaseConfig = {
  match?: unknown;
  operator?: unknown;
  processors?: FlowNode[];
};

type BuildNested = (nodes: FlowNode[]) => ProcessorPayload[];

const asFlowNodeArray = (value: unknown): FlowNode[] =>
  Array.isArray(value) ? (value as FlowNode[]) : [];

const asSwitchCaseArray = (value: unknown): SwitchCaseConfig[] =>
  Array.isArray(value) ? (value as SwitchCaseConfig[]) : [];

export const parseJsonValue = <T,>(value: string | undefined, fallback: T): T => {
  if (!value || !value.trim()) {
    return fallback;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const buildProcessorPayloadFromConfig = (
  processorType: string,
  config: ProcessorConfig,
  normalizeSourcePath: NormalizeSourcePath,
  buildNested?: BuildNested,
): ProcessorPayload => {
  if (processorType === 'set') {
    const sourceValue =
      config.sourceType === 'path'
        ? normalizeSourcePath(String(config.source || ''))
        : config.source;
    let argsValue: unknown[] | undefined;
    if (typeof config.argsText === 'string' && config.argsText.trim()) {
      try {
        const parsed = JSON.parse(config.argsText);
        if (Array.isArray(parsed)) {
          argsValue = parsed;
        }
      } catch {
        argsValue = undefined;
      }
    }
    return {
      set: {
        source: sourceValue,
        ...(argsValue ? { args: argsValue } : {}),
        targetField: config.targetField || '',
      },
    };
  }
  if (processorType === 'regex') {
    const sourceValue =
      config.sourceType === 'literal'
        ? String(config.source || '')
        : normalizeSourcePath(String(config.source || ''));
    const groupNumber = Number(config.group);
    const hasGroup = Number.isFinite(groupNumber) && String(config.group).trim() !== '';
    return {
      regex: {
        source: sourceValue,
        pattern: config.pattern || '',
        ...(hasGroup ? { group: groupNumber } : {}),
        targetField: config.targetField || '',
      },
    };
  }
  if (processorType === 'append') {
    return {
      append: {
        source: config.source ?? '',
        array: parseJsonValue(config.arrayText as string | undefined, [] as unknown[]),
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'appendToOutputStream') {
    return {
      appendToOutputStream: {
        source: config.source ?? '',
        output: config.output ?? '',
      },
    };
  }
  if (processorType === 'break') {
    return { break: {} };
  }
  if (processorType === 'convert') {
    return {
      convert: {
        source: config.source ?? '',
        type: config.type ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'copy') {
    return {
      copy: {
        source: config.source ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'discard') {
    return { discard: {} };
  }
  if (processorType === 'eval') {
    return {
      eval: {
        source: config.source ?? '',
        ...(config.targetField ? { targetField: config.targetField } : {}),
      },
    };
  }
  if (processorType === 'foreach') {
    const nestedNodes = asFlowNodeArray(config.processors);
    return {
      foreach: {
        source: config.source ?? '',
        ...(config.keyVal ? { keyVal: config.keyVal } : {}),
        ...(config.valField ? { valField: config.valField } : {}),
        processors: buildNested ? buildNested(nestedNodes) : nestedNodes,
      },
    };
  }
  if (processorType === 'grok') {
    return {
      grok: {
        source: config.source ?? '',
        pattern: config.pattern ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'json') {
    return {
      json: {
        source: config.source ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'log') {
    return {
      log: {
        type: config.type ?? '',
        source: config.source ?? '',
      },
    };
  }
  if (processorType === 'lookup') {
    return {
      lookup: {
        source: config.source ?? '',
        properties: parseJsonValue(config.propertiesText as string | undefined, {}),
        fallback: parseJsonValue(config.fallbackText as string | undefined, {}),
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'math') {
    return {
      math: {
        source: config.source ?? '',
        operation: config.operation ?? '',
        value: config.value ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'remove') {
    return {
      remove: {
        source: config.source ?? '',
      },
    };
  }
  if (processorType === 'rename') {
    return {
      rename: {
        source: config.source ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'replace') {
    return {
      replace: {
        source: config.source ?? '',
        pattern: config.pattern ?? '',
        replacement: config.replacement ?? '',
        ...(typeof config.regex === 'boolean' ? { regex: config.regex } : {}),
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'setOutputStream') {
    return {
      setOutputStream: {
        output: config.output ?? '',
      },
    };
  }
  if (processorType === 'sort') {
    return {
      sort: {
        source: config.source ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'split') {
    return {
      split: {
        source: config.source ?? '',
        delimiter: config.delimiter ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'strcase') {
    return {
      strcase: {
        source: config.source ?? '',
        type: config.type ?? '',
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'substr') {
    const startValue = config.start ?? '';
    const endValue = config.end ?? '';
    return {
      substr: {
        source: config.source ?? '',
        ...(String(startValue).trim() ? { start: Number(startValue) } : {}),
        ...(String(endValue).trim() ? { end: Number(endValue) } : {}),
        targetField: config.targetField ?? '',
      },
    };
  }
  if (processorType === 'switch') {
    const cases = asSwitchCaseArray(config.cases);
    const defaultProcessors = asFlowNodeArray(config.defaultProcessors);
    return {
      switch: {
        source: config.source ?? '',
        operator: config.operator ?? '',
        case: cases.map((item) => ({
          match: item.match ?? '',
          ...(item.operator ? { operator: item.operator } : {}),
          then: buildNested ? buildNested(asFlowNodeArray(item.processors)) : [],
        })),
        default: buildNested ? buildNested(defaultProcessors) : [],
      },
    };
  }
  if (processorType === 'trim') {
    return {
      trim: {
        source: config.source ?? '',
        ...(config.cutset ? { cutset: config.cutset } : {}),
        targetField: config.targetField ?? '',
      },
    };
  }
  return {
    [processorType]: config || {},
  };
};

export const buildFlowProcessor = (
  node: FlowNode,
  normalizeSourcePath: NormalizeSourcePath,
  buildNested?: BuildNested,
): ProcessorPayload => {
  if (node.kind === 'if') {
    return {
      if: {
        source: node.condition.property,
        operator: node.condition.operator,
        value: node.condition.value,
        processors: buildNested ? buildNested(node.then) : [],
        else: buildNested ? buildNested(node.else) : [],
      },
    };
  }
  return buildProcessorPayloadFromConfig(
    node.processorType,
    node.config || {},
    normalizeSourcePath,
    buildNested,
  );
};

export const buildFlowProcessors = (
  nodes: FlowNode[],
  normalizeSourcePath: NormalizeSourcePath,
): ProcessorPayload[] =>
  nodes.map((node) => buildFlowProcessor(node, normalizeSourcePath, (items) => buildFlowProcessors(items, normalizeSourcePath)));
