export type ProcessorConfigSpec = {
  key: string;
  label: string;
  type: 'text' | 'json' | 'boolean' | 'select';
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
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

export const processorConfigSpecs: Record<string, ProcessorConfigSpec[]> = {
  set: [
    {
      key: 'sourceType',
      label: 'Interpret as',
      type: 'select',
      options: [
        { label: 'Literal', value: 'literal' },
        { label: 'Path', value: 'path' },
      ],
    },
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Node' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.NewField' },
    { key: 'args', label: 'Args (JSON array, optional)', type: 'json', placeholder: '[]' },
  ],
  regex: [
    {
      key: 'sourceType',
      label: 'Interpret as',
      type: 'select',
      options: [
        { label: 'Literal', value: 'literal' },
        { label: 'Path', value: 'path' },
      ],
    },
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Summary' },
    { key: 'pattern', label: 'Pattern', type: 'text', placeholder: '(.*)' },
    { key: 'group', label: 'Group (optional)', type: 'text', placeholder: '1' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.Matched' },
  ],
  append: [
    { key: 'source', label: 'Source', type: 'text', placeholder: 'Example Value' },
    { key: 'array', label: 'Array (JSON)', type: 'json', placeholder: '[]' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.NewArray' },
  ],
  appendToOutputStream: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap' },
    {
      key: 'output',
      label: 'Output',
      type: 'text',
      placeholder: 'pulsar+ssl:///assure1/event/sink',
    },
  ],
  break: [],
  convert: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
    { key: 'type', label: 'Type', type: 'text', placeholder: 'inttostring' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.CountString' },
  ],
  copy: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.CopiedCount' },
  ],
  discard: [],
  eval: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '<expression>' },
    {
      key: 'targetField',
      label: 'Target (optional)',
      type: 'text',
      placeholder: '$.localmem.evalResult',
    },
  ],
  foreach: [
    {
      key: 'source',
      label: 'Source',
      type: 'text',
      placeholder: '$.event.Details.trap.variables',
    },
    { key: 'keyVal', label: 'Key', type: 'text', placeholder: 'i' },
    { key: 'valField', label: 'Value', type: 'text', placeholder: 'v' },
  ],
  grok: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.syslog.datagram' },
    {
      key: 'pattern',
      label: 'Pattern',
      type: 'text',
      placeholder:
        '%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}',
    },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.syslog.variables' },
  ],
  json: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '{"key":"value"}' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.json' },
  ],
  log: [
    { key: 'type', label: 'Type', type: 'text', placeholder: 'info' },
    { key: 'source', label: 'Source', type: 'text', placeholder: 'Log message' },
  ],
  lookup: [
    { key: 'source', label: 'Source', type: 'text', placeholder: 'db' },
    { key: 'properties', label: 'Properties (JSON)', type: 'json', placeholder: '{}' },
    { key: 'fallback', label: 'Fallback (JSON)', type: 'json', placeholder: '{}' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.results' },
  ],
  math: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Count' },
    { key: 'operation', label: 'Operation', type: 'text', placeholder: '*' },
    { key: 'value', label: 'Value', type: 'text', placeholder: '2' },
    {
      key: 'targetField',
      label: 'Target',
      type: 'text',
      placeholder: '$.localmem.CountTimesTwo',
    },
  ],
  remove: [{ key: 'source', label: 'Source', type: 'text', placeholder: '$.trap.timeTicks' }],
  rename: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.event.Details' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.event.DetailsOld' },
  ],
  replace: [
    { key: 'source', label: 'Source', type: 'text', placeholder: 'This is a test' },
    { key: 'pattern', label: 'Pattern', type: 'text', placeholder: 'a test' },
    { key: 'replacement', label: 'Replacement', type: 'text', placeholder: 'not a test' },
    { key: 'regex', label: 'Regex', type: 'boolean' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.example' },
  ],
  setOutputStream: [
    {
      key: 'output',
      label: 'Output',
      type: 'text',
      placeholder: 'pulsar+ssl:///assure1/event/sink',
    },
  ],
  sort: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.trap.variables[0]' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.trap.sortedVariables' },
  ],
  split: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '1,2,3,4' },
    { key: 'delimiter', label: 'Delimiter', type: 'text', placeholder: ',' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.splitarr' },
  ],
  strcase: [
    { key: 'source', label: 'Source', type: 'text', placeholder: 'HELLO, WORLD' },
    { key: 'type', label: 'Type', type: 'text', placeholder: 'lower' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.lowercase' },
  ],
  substr: [
    { key: 'source', label: 'Source', type: 'text', placeholder: 'Hello' },
    { key: 'start', label: 'Start (optional)', type: 'text', placeholder: '1' },
    { key: 'end', label: 'End (optional)', type: 'text', placeholder: '' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.substr' },
  ],
  switch: [
    { key: 'source', label: 'Source', type: 'text', placeholder: '$.localmem.val1' },
    { key: 'operator', label: 'Operator', type: 'text', placeholder: '!=' },
  ],
  trim: [
    { key: 'source', label: 'Source', type: 'text', placeholder: 'Hello' },
    { key: 'cutset', label: 'Cutset', type: 'text', placeholder: 'H' },
    { key: 'targetField', label: 'Target', type: 'text', placeholder: '$.localmem.trim' },
  ],
};

export const getProcessorRequiredFields = (processorType: string) => {
  if (processorRequiredFields[processorType]) {
    return processorRequiredFields[processorType];
  }
  const specs = processorConfigSpecs[processorType] || [];
  return specs.filter((spec) => !isFieldOptional(spec.label)).map((spec) => spec.key);
};
