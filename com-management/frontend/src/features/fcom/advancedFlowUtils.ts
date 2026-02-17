type OverrideScope = 'pre' | 'post';

type UpsertAdvancedFlowOverrideEntryParams = {
  baseOverrides: unknown[];
  method: string;
  scope: OverrideScope;
  processors: unknown[];
  objectName?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const hasPatchOps = (processors: unknown[]) =>
  processors.some(
    (processor) => isRecord(processor) && Boolean(processor.op) && Boolean(processor.path),
  );

export const upsertAdvancedFlowOverrideEntry = ({
  baseOverrides,
  method,
  scope,
  processors,
  objectName,
}: UpsertAdvancedFlowOverrideEntryParams): unknown[] => {
  const nextOverrides = [...baseOverrides];
  const matchIndex = nextOverrides.findIndex((entry) => {
    if (!isRecord(entry)) {
      return false;
    }
    if (entry.scope !== scope || entry.method !== method) {
      return false;
    }
    if (objectName) {
      return entry['@objectName'] === objectName;
    }
    return !entry['@objectName'];
  });

  const existing =
    matchIndex >= 0 && isRecord(nextOverrides[matchIndex])
      ? { ...(nextOverrides[matchIndex] as Record<string, unknown>) }
      : null;

  const hasEventOverrides =
    existing &&
    isRecord(existing.event) &&
    Object.keys(existing.event).length > 0;

  if (processors.length === 0) {
    if (!existing) {
      return nextOverrides;
    }
    if (!hasEventOverrides) {
      nextOverrides.splice(matchIndex, 1);
      return nextOverrides;
    }
    nextOverrides[matchIndex] = {
      ...existing,
      version: 'v2',
      processors: [],
    };
    return nextOverrides;
  }

  const nextEntry: Record<string, unknown> = existing
    ? {
        ...existing,
        version: 'v2',
        processors,
      }
    : {
        name: objectName ? `${objectName} Override` : 'Global Override',
        description: objectName
          ? `Overrides for ${objectName}`
          : 'Global processor overrides',
        domain: 'fault',
        method,
        scope,
        ...(objectName ? { '@objectName': objectName } : {}),
        _type: 'override',
        version: 'v2',
        processors,
      };

  if (matchIndex >= 0) {
    nextOverrides[matchIndex] = nextEntry;
  } else {
    nextOverrides.push(nextEntry);
  }

  return nextOverrides;
};
