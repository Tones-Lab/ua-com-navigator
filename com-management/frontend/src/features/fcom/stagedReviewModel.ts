export type StagedChangeAction = 'added' | 'updated' | 'removed';

export type StagedFieldChange = {
  target: string;
  action: StagedChangeAction;
  before?: unknown;
  after?: unknown;
  origin: 'event' | 'processor';
};

export type StagedProcessorChange = { action: 'added' | 'removed'; processor: unknown };

export type StagedDiffSection = {
  title: string;
  objectName?: string;
  scope?: string;
  fieldChanges: StagedFieldChange[];
  processorChanges: StagedProcessorChange[];
};

export type StagedDiffResult = {
  sections: StagedDiffSection[];
  totalChanges: number;
  editedObjects: string[];
};

type DiffDeps = {
  getBaseObjectValue: (objectName: string | undefined, target: string) => unknown;
  getOverrideEventMap: (entry: unknown) => Record<string, unknown>;
  getOverrideTargetMap: (processors: unknown[]) => Map<string, unknown>;
  getPatchTargetField: (processor: unknown) => string | null;
  getProcessorTargetField: (processor: unknown) => string | null;
  getProcessorType: (processor: unknown) => string | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const stringifyProcessor = (processor: unknown) => {
  try {
    return JSON.stringify(processor || {});
  } catch {
    return '';
  }
};

export const buildStagedReviewDiff = (
  baseOverrides: unknown[],
  stagedOverrides: unknown[],
  deps: DiffDeps,
): StagedDiffResult => {
  const indexOverrides = (overrides: unknown[]) => {
    const map = new Map<
      string,
      { entry: Record<string, unknown>; objectName?: string; scope?: string; method?: string }
    >();
    overrides.forEach((entry) => {
      if (!isRecord(entry)) {
        return;
      }
      const objectName = entry['@objectName'];
      const scope = entry.scope || 'post';
      const method = entry.method || '';
      const key = `${method}:${scope}:${objectName || '__global__'}`;
      map.set(key, {
        entry,
        objectName: typeof objectName === 'string' ? objectName : undefined,
        scope: typeof scope === 'string' ? scope : undefined,
        method: typeof method === 'string' ? method : undefined,
      });
    });
    return map;
  };

  const splitProcessors = (processors: unknown[]) => {
    const targeted = new Map<string, unknown>();
    const untargeted = new Map<string, unknown>();
    processors.forEach((proc, index: number) => {
      const target = deps.getProcessorTargetField(proc) || deps.getPatchTargetField(proc);
      if (target) {
        if (!targeted.has(target)) {
          targeted.set(target, proc);
        }
        return;
      }
      const key =
        stringifyProcessor(proc) || `${deps.getProcessorType(proc) || 'processor'}:${index}`;
      untargeted.set(key, proc);
    });
    return { targeted, untargeted };
  };

  const baseMap = indexOverrides(baseOverrides);
  const stagedMap = indexOverrides(stagedOverrides);
  const allKeys = new Set<string>([...baseMap.keys(), ...stagedMap.keys()]);
  const sections: StagedDiffSection[] = [];

  allKeys.forEach((key) => {
    const baseEntry = baseMap.get(key);
    const stagedEntry = stagedMap.get(key);
    const objectName = stagedEntry?.objectName || baseEntry?.objectName;
    const scope = stagedEntry?.scope || baseEntry?.scope;
    const baseProcessors = Array.isArray(baseEntry?.entry?.processors)
      ? baseEntry.entry.processors
      : [];
    const stagedProcessors = Array.isArray(stagedEntry?.entry?.processors)
      ? stagedEntry.entry.processors
      : [];
    const baseEventOverrides = baseEntry?.entry ? deps.getOverrideEventMap(baseEntry.entry) : {};
    const stagedEventOverrides = stagedEntry?.entry
      ? deps.getOverrideEventMap(stagedEntry.entry)
      : {};
    const { targeted: baseTargeted, untargeted: baseUntargeted } = splitProcessors(baseProcessors);
    const { targeted: stagedTargeted, untargeted: stagedUntargeted } =
      splitProcessors(stagedProcessors);
    const baseTargetMap = deps.getOverrideTargetMap(baseProcessors);
    const stagedTargetMap = deps.getOverrideTargetMap(stagedProcessors);
    const targets = new Set<string>([
      ...baseTargetMap.keys(),
      ...stagedTargetMap.keys(),
      ...Object.keys(baseEventOverrides).map((field) => `$.event.${field}`),
      ...Object.keys(stagedEventOverrides).map((field) => `$.event.${field}`),
    ]);
    const fieldChanges: StagedFieldChange[] = [];
    targets.forEach((target) => {
      const fieldName = target.replace('$.event.', '');
      const hasBaseEvent = Object.prototype.hasOwnProperty.call(baseEventOverrides, fieldName);
      const hasStagedEvent = Object.prototype.hasOwnProperty.call(stagedEventOverrides, fieldName);
      const baseValue =
        objectName && target.startsWith('$.event.')
          ? deps.getBaseObjectValue(objectName, target)
          : undefined;
      const before = Object.prototype.hasOwnProperty.call(baseEventOverrides, fieldName)
        ? baseEventOverrides[fieldName]
        : (baseTargeted.get(target) ?? baseTargetMap.get(target));
      const after = Object.prototype.hasOwnProperty.call(stagedEventOverrides, fieldName)
        ? stagedEventOverrides[fieldName]
        : (stagedTargeted.get(target) ?? stagedTargetMap.get(target));
      const origin: 'event' | 'processor' =
        hasBaseEvent || hasStagedEvent ? 'event' : 'processor';
      if (before !== undefined && after !== undefined) {
        if (stringifyProcessor(before) !== stringifyProcessor(after)) {
          fieldChanges.push({ target, action: 'updated', before, after, origin });
        }
        return;
      }
      if (before !== undefined) {
        fieldChanges.push({ target, action: 'removed', before, origin });
      } else if (after !== undefined) {
        const action: 'added' | 'updated' =
          origin === 'event' && baseValue !== undefined ? 'updated' : 'added';
        fieldChanges.push({ target, action, after, origin });
      }
    });

    const procKeys = new Set<string>([...baseUntargeted.keys(), ...stagedUntargeted.keys()]);
    const processorChanges: StagedProcessorChange[] = [];
    procKeys.forEach((procKey) => {
      const before = baseUntargeted.get(procKey);
      const after = stagedUntargeted.get(procKey);
      if (before && !after) {
        processorChanges.push({ action: 'removed', processor: before });
      } else if (!before && after) {
        processorChanges.push({ action: 'added', processor: after });
      }
    });

    if (fieldChanges.length === 0 && processorChanges.length === 0) {
      return;
    }
    const title = objectName
      ? `${objectName} (Object ${scope || 'post'})`
      : `Global ${String(scope || 'post').toUpperCase()}`;
    sections.push({
      title,
      objectName,
      scope,
      fieldChanges,
      processorChanges,
    });
  });

  const totalChanges = sections.reduce(
    (count, section) => count + section.fieldChanges.length + section.processorChanges.length,
    0,
  );
  const editedObjects = sections
    .filter((section) => Boolean(section.objectName))
    .map((section) => section.objectName as string);

  return { sections, totalChanges, editedObjects };
};

export const buildStagedFieldChangeMap = (sections: StagedDiffSection[]) => {
  const map = new Map<string, Map<string, StagedChangeAction>>();
  sections.forEach((section) => {
    const objectName = section.objectName;
    if (!objectName) {
      return;
    }
    section.fieldChanges.forEach((change) => {
      const target = change.target ?? '';
      if (!target.startsWith('$.event.')) {
        return;
      }
      const field = target.replace('$.event.', '');
      const fieldMap = map.get(objectName) || new Map<string, StagedChangeAction>();
      fieldMap.set(field, change.action);
      map.set(objectName, fieldMap);
    });
  });
  return map;
};

export const formatDiffValue = (value: unknown) =>
  value === undefined ? '' : JSON.stringify(value, null, 2);

export const diffLines = (beforeText: string, afterText: string) => {
  const beforeLines = beforeText === '' ? [] : beforeText.split('\n');
  const afterLines = afterText === '' ? [] : afterText.split('\n');
  const beforeCount = beforeLines.length;
  const afterCount = afterLines.length;
  const dp: number[][] = Array.from({ length: beforeCount + 1 }, () =>
    Array(afterCount + 1).fill(0),
  );

  for (let i = beforeCount - 1; i >= 0; i -= 1) {
    for (let j = afterCount - 1; j >= 0; j -= 1) {
      if (beforeLines[i] === afterLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const output: { type: 'equal' | 'add' | 'remove'; value: string }[] = [];
  let i = 0;
  let j = 0;
  while (i < beforeCount || j < afterCount) {
    if (i < beforeCount && j < afterCount && beforeLines[i] === afterLines[j]) {
      output.push({ type: 'equal', value: beforeLines[i] });
      i += 1;
      j += 1;
    } else if (j < afterCount && (i === beforeCount || dp[i][j + 1] >= dp[i + 1][j])) {
      output.push({ type: 'add', value: afterLines[j] });
      j += 1;
    } else if (i < beforeCount) {
      output.push({ type: 'remove', value: beforeLines[i] });
      i += 1;
    }
  }
  return output;
};
