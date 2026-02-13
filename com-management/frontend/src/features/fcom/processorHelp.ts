export type ProcessorHelpEntry = {
  title: string;
  description: string;
  example: string;
};

export const processorHelp: Record<string, ProcessorHelpEntry> = {
  append: {
    title: 'Append',
    description: 'Append a value to an array or concatenate text into a target field (planned).',
    example:
      '{"append": {"source": "Example Value", "array": [], "targetField": "$.event.NewArray"}}',
  },
  appendToOutputStream: {
    title: 'Append to Output Stream',
    description: 'Append data to a configured output stream (planned).',
    example:
      '{"appendToOutputStream": {"source": "$.trap", "output": "pulsar+ssl:///assure1/event/sink"}}',
  },
  break: {
    title: 'Break',
    description: 'Stop processing the current processor chain (planned).',
    example: '{"break": {}}',
  },
  convert: {
    title: 'Convert',
    description: 'Convert a value from one type/format to another (planned).',
    example:
      '{"convert": {"source": "$.event.Count", "type": "inttostring", "targetField": "$.event.CountString", "ignoreFailure": true}}',
  },
  copy: {
    title: 'Copy',
    description: 'Copy a value from one field to another (planned).',
    example: '{"copy": {"source": "$.event.Count", "targetField": "$.event.CopiedCount"}}',
  },
  discard: {
    title: 'Discard',
    description: 'Discard the event or processing result (planned).',
    example: '{"discard": {}}',
  },
  eval: {
    title: 'Eval',
    description: 'Evaluate a JavaScript expression and store the result (planned).',
    example: '{"eval": {"source": "<expression>", "targetField": "$.localmem.evalResult"}}',
  },
  foreach: {
    title: 'Foreach',
    description: 'Iterate over an array/object and run processors for each item (planned).',
    example:
      '{"foreach": {"source": "$.event.Details.trap.variables", "keyVal": "i", "valField": "v", "processors": []}}',
  },
  grok: {
    title: 'Grok',
    description: 'Parse text using Grok patterns and store extracted values (planned).',
    example:
      '{"grok": {"source": "$.syslog.datagram", "pattern": "%LINK-5-CHANGED: Interface %{VALUE:interface}, changed state to %{VALUE:status}", "targetField": "$.syslog.variables"}}',
  },
  if: {
    title: 'If',
    description: 'Conditionally run processors based on a single condition (planned).',
    example:
      '{"if": {"source": "$.event.EventCategory", "operator": "==", "value": 3, "processors": [], "else": []}}',
  },
  json: {
    title: 'JSON',
    description: 'Parse a JSON string and store the result (planned).',
    example: '{"json": {"source": "{\"key\":\"value\"}", "targetField": "$.localmem.json"}}',
  },
  log: {
    title: 'Log',
    description: 'Write a message to the processor log (planned).',
    example: '{"log": {"type": "info", "source": "Log message"}}',
  },
  lookup: {
    title: 'Lookup',
    description: 'Lookup data from a source and store it in a target field (planned).',
    example:
      '{"lookup": {"source": "db", "properties": {}, "fallback": {}, "targetField": "$.localmem.results"}}',
  },
  math: {
    title: 'Math',
    description: 'Apply arithmetic to a numeric source and store the result (planned).',
    example:
      '{"math": {"source": "$.event.Count", "operation": "*", "value": 2, "targetField": "$.localmem.CountTimesTwo"}}',
  },
  regex: {
    title: 'Regex',
    description:
      'Extract a value from text using a regular expression capture group and store it in a target field.',
    example:
      '{"regex": {"source": "Events are cleared", "pattern": "Events are (?<text>.*$)", "targetField": ""}}',
  },
  remove: {
    title: 'Remove',
    description: 'Remove a field from the payload (planned).',
    example: '{"remove": {"source": "$.trap.timeTicks"}}',
  },
  rename: {
    title: 'Rename',
    description: 'Rename or move a field to a new target (planned).',
    example: '{"rename": {"source": "$.event.Details", "targetField": "$.event.DetailsOld"}}',
  },
  replace: {
    title: 'Replace',
    description: 'Replace text in a source string (planned).',
    example:
      '{"replace": {"source": "This is a test", "pattern": "a test", "replacement": "not a test", "targetField": "$.localmem.example"}}',
  },
  set: {
    title: 'Set',
    description:
      'Set a target field to a literal value or another field path. Useful for overrides or copying values.',
    example:
      '{"set": {"source": "$.event.%s", "args": ["Details"], "targetField": "$.event.Details2"}}',
  },
  setOutputStream: {
    title: 'Set Output Stream',
    description: 'Change the output stream for the event (planned).',
    example: '{"setOutputStream": {"output": "pulsar+ssl:///assure1/event/sink"}}',
  },
  sort: {
    title: 'Sort',
    description: 'Sort an array or list and store it (planned).',
    example: '{"sort": {"source": "$.trap.variables", "targetField": "$.trap.sortedVariables"}}',
  },
  split: {
    title: 'Split',
    description: 'Split a string using a delimiter (planned).',
    example:
      '{"split": {"source": "1,2,3,4", "delimiter": ",", "targetField": "$.localmem.splitarr"}}',
  },
  strcase: {
    title: 'String Case',
    description: 'Change the case of a string (planned).',
    example:
      '{"strcase": {"source": "HELLO, WORLD", "type": "lower", "targetField": "$.localmem.lowercase"}}',
  },
  substr: {
    title: 'Substring',
    description: 'Extract a substring from a source value (planned).',
    example: '{"substr": {"source": "Hello", "start": 1, "targetField": "$.localmem.substr"}}',
  },
  switch: {
    title: 'Switch',
    description: 'Branch processors based on matching cases (planned).',
    example:
      '{"switch": {"source": "$.localmem.val1", "operator": "!=", "case": [{"match": 2, "then": [{"discard": {}}]}, {"match": 5, "operator": "==", "then": [{"discard": {}}]}], "default": [{"log": {"type": "info", "source": "Do nothing since none of the cases were met"}}]}}',
  },
  trim: {
    title: 'Trim',
    description: 'Trim characters from a source string (planned).',
    example: '{"trim": {"source": "Hello", "cutset": "H", "targetField": "$.localmem.trim"}}',
  },
};
