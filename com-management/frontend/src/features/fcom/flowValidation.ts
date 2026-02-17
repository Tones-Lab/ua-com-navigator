import { processorConfigSpecs } from './processorConfig';
import type { FlowNode } from './flowUtils';

export type FlowValidationResult = {
  fieldErrors: Record<string, string[]>;
  nodeErrors: string[];
};

export type FlowNodeErrorMap = Record<string, string[]>;

export type FocusMatch = {
  lane: 'object' | 'pre' | 'post';
  processor: Record<string, unknown>;
};

export type FlowLane = 'object' | 'pre' | 'post';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasEventPath = (value: unknown): boolean => {
  if (value == null) {
    return false;
  }
  if (typeof value === 'string') {
    return value.includes('$.event');
  }
  if (Array.isArray(value)) {
    return value.some((entry) => hasEventPath(entry));
  }
  if (typeof value === 'object') {
    return Object.values(value).some((entry) => hasEventPath(entry));
  }
  return false;
};

const isFieldOptional = (label?: string) => Boolean(label && /optional/i.test(label));

const processorRequiredFields: Record<string, string[]> = {
  set: ['sourceType', 'source', 'targetField'],
  regex: ['sourceType', 'source', 'pattern', 'targetField'],
  append: ['source', 'array', 'targetField'],
  appendToOutputStream: ['source', 'output'],
  convert: ['source', 'type', 'targetField'],
  copy: ['source', 'targetField'],
  eval: ['source'],
  foreach: ['source', 'keyVal', 'valField'],
  grok: ['source', 'pattern', 'targetField'],
  json: ['source', 'targetField'],
  log: ['type', 'source'],
  lookup: ['source', 'properties', 'targetField'],
  math: ['source', 'operation', 'value', 'targetField'],
  remove: ['source'],
  rename: ['source', 'targetField'],
  replace: ['source', 'pattern', 'replacement', 'targetField'],
  setOutputStream: ['output'],
  sort: ['source', 'targetField'],
  split: ['source', 'delimiter', 'targetField'],
  strcase: ['source', 'type', 'targetField'],
  substr: ['source', 'targetField'],
  switch: ['source', 'operator'],
  trim: ['source', 'targetField'],
};

const getProcessorRequiredFields = (processorType: string) => {
  if (processorRequiredFields[processorType]) {
    return processorRequiredFields[processorType];
  }
  const specs = processorConfigSpecs[processorType] || [];
  return specs.filter((spec) => !isFieldOptional(spec.label)).map((spec) => spec.key);
};

export const validateProcessorConfig = (
  processorType: string,
  config: Record<string, unknown>,
  lane: 'object' | 'pre' | 'post',
): FlowValidationResult => {
  const requiredKeys = new Set(getProcessorRequiredFields(processorType));
  const fieldErrors: Record<string, string[]> = {};
  const nodeErrors: string[] = [];
  (processorConfigSpecs[processorType] || []).forEach((spec) => {
    const isJsonField = spec.type === 'json';
    const valueKey = isJsonField ? `${spec.key}Text` : spec.key;
    const rawValue = config?.[valueKey];
    const stringValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
    const isRequired = requiredKeys.has(spec.key);
    if (isRequired) {
      if (stringValue === '' || stringValue === undefined || stringValue === null) {
        fieldErrors[spec.key] = [...(fieldErrors[spec.key] || []), `${spec.label} is required.`];
      }
    }
    if (isJsonField && typeof rawValue === 'string' && rawValue.trim()) {
      try {
        const parsed = JSON.parse(rawValue);
        if (lane === 'pre' && hasEventPath(parsed)) {
          fieldErrors[spec.key] = [
            ...(fieldErrors[spec.key] || []),
            'Pre scope cannot reference $.event.*.',
          ];
        }
      } catch {
        fieldErrors[spec.key] = [
          ...(fieldErrors[spec.key] || []),
          `${spec.label} must be valid JSON.`,
        ];
      }
    }
    if (
      lane === 'pre' &&
      !isJsonField &&
      typeof rawValue === 'string' &&
      rawValue.includes('$.event')
    ) {
      fieldErrors[spec.key] = [
        ...(fieldErrors[spec.key] || []),
        'Pre scope cannot reference $.event.*.',
      ];
    }
  });
  if (processorType === 'switch') {
    const cases = Array.isArray(config.cases) ? config.cases : [];
    if (cases.length === 0) {
      nodeErrors.push('Switch must include at least one case.');
    }
    if (cases.some((entry) => !String((isRecord(entry) ? entry.match : undefined) ?? '').trim())) {
      nodeErrors.push('All switch cases must include a match value.');
    }
  }
  if (processorType === 'foreach' && !String(config.source ?? '').trim()) {
    fieldErrors.source = [...(fieldErrors.source || []), 'Source is required.'];
  }
  if (processorType === 'if') {
    if (!String(config.source ?? '').trim()) {
      fieldErrors.source = [...(fieldErrors.source || []), 'Source is required.'];
    }
    if (!String(config.value ?? '').trim()) {
      fieldErrors.value = [...(fieldErrors.value || []), 'Value is required.'];
    }
  }
  return { fieldErrors, nodeErrors };
};

export const validateFlowNode = (
  node: FlowNode,
  lane: 'object' | 'pre' | 'post',
  map: FlowNodeErrorMap,
) => {
  if (node.kind === 'if') {
    const errors: string[] = [];
    if (!String(node.condition.property || '').trim()) {
      errors.push('Condition property is required.');
    }
    if (!String(node.condition.value || '').trim()) {
      errors.push('Condition value is required.');
    }
    if (node.then.length === 0 && node.else.length === 0) {
      errors.push('If must include at least one processor in Then or Else.');
    }
    if (lane === 'pre' && (node.condition.property || '').includes('$.event')) {
      errors.push('Pre scope cannot reference $.event.* in condition property.');
    }
    if (lane === 'pre' && (node.condition.value || '').includes('$.event')) {
      errors.push('Pre scope cannot reference $.event.* in condition value.');
    }
    if (errors.length > 0) {
      map[node.id] = errors;
    }
    node.then.forEach((child) => validateFlowNode(child, lane, map));
    node.else.forEach((child) => validateFlowNode(child, lane, map));
    return;
  }
  const { fieldErrors, nodeErrors } = validateProcessorConfig(node.processorType, node.config || {}, lane);
  const flatErrors = [...Object.values(fieldErrors).flat(), ...nodeErrors];
  if (flatErrors.length > 0) {
    map[node.id] = flatErrors;
  }
  if (node.processorType === 'foreach') {
    const processors = Array.isArray(node.config?.processors) ? node.config.processors : [];
    processors.forEach((child: FlowNode) => validateFlowNode(child, lane, map));
  }
  if (node.processorType === 'switch') {
    const cases = Array.isArray(node.config?.cases) ? node.config.cases : [];
    cases.forEach((entry) => {
      const processors = isRecord(entry) && Array.isArray(entry.processors) ? entry.processors : [];
      processors.forEach((child: FlowNode) => validateFlowNode(child, lane, map));
    });
    const defaults = Array.isArray(node.config?.defaultProcessors) ? node.config.defaultProcessors : [];
    defaults.forEach((child: FlowNode) => validateFlowNode(child, lane, map));
  }
};

export const validateFlowNodes = (
  nodes: FlowNode[],
  lane: FlowLane,
): FlowNodeErrorMap => {
  const map: FlowNodeErrorMap = {};
  nodes.forEach((node) => validateFlowNode(node, lane, map));
  return map;
};

export const validateFlowEditorDraft = (
  draft: FlowNode | null,
  lane: FlowLane,
): FlowValidationResult => {
  if (!draft) {
    return { fieldErrors: {}, nodeErrors: [] };
  }
  if (draft.kind === 'processor') {
    return validateProcessorConfig(draft.processorType, draft.config || {}, lane);
  }
  if (draft.kind === 'if') {
    return {
      fieldErrors: {},
      nodeErrors: validateFlowNodes([draft], lane)[draft.id] || [],
    };
  }
  return { fieldErrors: {}, nodeErrors: [] };
};

export const collectFocusMatches = (
  payloads: unknown[],
  targetField: string,
  lane: FocusMatch['lane'],
  getProcessorTargetField: (processor: unknown) => string | null,
): FocusMatch[] => {
  const matches: FocusMatch[] = [];
  const walk = (items: unknown[]) => {
    (items || []).forEach((item) => {
      if (!isRecord(item)) {
        return;
      }
      const ifPayload = isRecord(item.if) ? item.if : null;
      if (ifPayload) {
        walk(Array.isArray(ifPayload.processors) ? ifPayload.processors : []);
        walk(Array.isArray(ifPayload.else) ? ifPayload.else : []);
        return;
      }
      const foreachPayload = isRecord(item.foreach) ? item.foreach : null;
      if (foreachPayload?.processors) {
        walk(Array.isArray(foreachPayload.processors) ? foreachPayload.processors : []);
      }
      const switchPayload = isRecord(item.switch) ? item.switch : null;
      if (Array.isArray(switchPayload?.case)) {
        switchPayload.case.forEach((entry) => {
          if (isRecord(entry)) {
            walk(Array.isArray(entry.then) ? entry.then : []);
          }
        });
      }
      if (Array.isArray(switchPayload?.default)) {
        walk(switchPayload.default);
      }
      if (getProcessorTargetField(item) === targetField) {
        matches.push({ lane, processor: item });
      }
    });
  };
  walk(payloads);
  return matches;
};
