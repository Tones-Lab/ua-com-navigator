import type {
  LegacyApplyFcomOverridesRequest,
  LegacyApplyFcomOverridesResponse,
} from '../../types/api';

export type SuggestedEntry = {
  key: string;
  sourceType: 'matched' | 'generated';
  objectName: string;
  sourceLabel: string;
  fields: Array<{ field: string; value: string }>;
  payload: Record<string, any>;
  initialPayload: Record<string, any>;
  initialFieldValues: Record<string, string>;
  rawText: string;
  rawError: string | null;
};

export type SuggestedDirtyMeta = {
  changedFields: string[];
  dirty: boolean;
};

export type ReferenceOnlyFieldRow = {
  field: string;
  reason: string;
  pattern: string;
};

export const extractEventFields = (payload: Record<string, any>) => {
  if (payload?.event && typeof payload.event === 'object' && !Array.isArray(payload.event)) {
    return Object.entries(payload.event).map(([field, value]) => ({
      field,
      value: value === undefined || value === null ? '' : String(value),
    }));
  }
  const processors = Array.isArray(payload?.processors) ? payload.processors : [];
  return processors
    .map((processor: any) => {
      const setConfig = processor?.value?.set;
      const targetField = String(setConfig?.targetField || '');
      if (!targetField.startsWith('$.event.')) {
        return null;
      }
      return {
        field: targetField.replace('$.event.', ''),
        value:
          setConfig?.source === undefined || setConfig?.source === null ? '' : String(setConfig.source),
      };
    })
    .filter(Boolean) as Array<{ field: string; value: string }>;
};

export const applyEventFieldsToPayload = (
  payload: Record<string, any>,
  fields: Array<{ field: string; value: string }>,
) => {
  const nextPayload: Record<string, any> = { ...(payload || {}) };
  if (nextPayload.event && typeof nextPayload.event === 'object' && !Array.isArray(nextPayload.event)) {
    const nextEvent: Record<string, string> = {};
    fields.forEach((entry) => {
      if (entry.field.trim()) {
        nextEvent[entry.field.trim()] = entry.value;
      }
    });
    nextPayload.event = nextEvent;
    return nextPayload;
  }

  nextPayload.processors = fields
    .filter((entry) => entry.field.trim())
    .map((entry) => ({
      op: 'add',
      path: '/-',
      value: {
        set: {
          source: entry.value,
          targetField: `$.event.${entry.field.trim()}`,
        },
      },
    }));

  return nextPayload;
};

export const deriveLegacyObjectName = (obj: any) => {
  const ruleFunction = String(obj?.ruleFunction || '').trim();
  if (ruleFunction && ruleFunction !== '__global__') {
    return ruleFunction;
  }
  const firstOid = Array.isArray(obj?.oids) && obj.oids.length > 0 ? String(obj.oids[0]) : 'unknown';
  return `legacy_${firstOid}`;
};

export const getSuggestedFieldDependencies = (entry: SuggestedEntry, legacyObjects: any[]) => {
  const sourceFiles = entry.sourceLabel
    ? entry.sourceLabel
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];

  const related = legacyObjects.filter((obj: any) => {
    const sameName = deriveLegacyObjectName(obj) === entry.objectName;
    if (!sameName) {
      return false;
    }
    if (sourceFiles.length === 0) {
      return true;
    }
    return sourceFiles.includes(String(obj?.sourceFile || ''));
  });

  const fields = new Set<string>();
  related.forEach((obj: any) => {
    const objectFields = Array.isArray(obj?.eventFields) ? obj.eventFields : [];
    objectFields.forEach((field: string) => {
      const normalized = String(field || '').trim();
      if (normalized) {
        fields.add(normalized);
      }
    });
  });

  return Array.from(fields).sort((a, b) => a.localeCompare(b));
};

export const getReferenceOnlyFieldRows = (
  entry: SuggestedEntry,
  dependencyFields: string[],
): ReferenceOnlyFieldRow[] => {
  const mappedFields = new Set(entry.fields.map((item) => item.field));
  return dependencyFields
    .filter((field) => !mappedFields.has(field))
    .map((field) => {
      const normalized = field.toLowerCase();
      let pattern = 'set + if/else processors';
      if (normalized.includes('severity') || normalized.includes('category')) {
        pattern = 'set + map/lookup processor';
      } else if (
        normalized.includes('node') ||
        normalized.includes('subnode') ||
        normalized.includes('alias')
      ) {
        pattern = 'set processor';
      } else if (
        normalized.includes('type') ||
        normalized.includes('code') ||
        normalized.includes('group') ||
        normalized.includes('method')
      ) {
        pattern = 'if + map/lookup + set processors';
      }

      return {
        field,
        reason:
          'Referenced in legacy rule context/read logic, but no direct assignment was extracted into the phase-1 COM field mapper.',
        pattern,
      };
    });
};

export const buildSuggestedEntriesFromResult = (
  result: LegacyApplyFcomOverridesResponse,
): SuggestedEntry[] => {
  const matched = (result.overrides || []).map((entry) => {
    const payload = { ...(entry.override || {}) };
    const fields = extractEventFields(payload);
    const initialPayload = JSON.parse(JSON.stringify(payload || {}));
    const initialFieldValues = fields.reduce<Record<string, string>>((acc, item) => {
      acc[item.field] = item.value;
      return acc;
    }, {});

    return {
      key: `matched:${entry.objectName}:${(entry.sourceFiles || []).join('|')}`,
      sourceType: 'matched' as const,
      objectName: entry.objectName,
      sourceLabel: (entry.sourceFiles || []).join(', '),
      fields,
      payload,
      initialPayload,
      initialFieldValues,
      rawText: JSON.stringify(payload, null, 2),
      rawError: null,
    };
  });

  const generated = (result.generatedDefinitions || []).map((entry) => {
    const payload = { ...(entry.definition || {}) };
    const fields = extractEventFields(payload);
    const initialPayload = JSON.parse(JSON.stringify(payload || {}));
    const initialFieldValues = fields.reduce<Record<string, string>>((acc, item) => {
      acc[item.field] = item.value;
      return acc;
    }, {});

    return {
      key: `generated:${entry.objectName}:${entry.sourceFile}`,
      sourceType: 'generated' as const,
      objectName: entry.objectName,
      sourceLabel: entry.sourceFile,
      fields,
      payload,
      initialPayload,
      initialFieldValues,
      rawText: JSON.stringify(payload, null, 2),
      rawError: null,
    };
  });

  return [...matched, ...generated];
};

export const buildEditedPayloadOverrides = (
  suggestedEntries: SuggestedEntry[],
): Pick<LegacyApplyFcomOverridesRequest, 'overridesOverride' | 'generatedDefinitionsOverride'> => {
  const matched = suggestedEntries
    .filter((entry) => entry.sourceType === 'matched')
    .map((entry) => ({
      objectName: entry.objectName,
      sourceFiles: entry.sourceLabel
        ? entry.sourceLabel
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : [],
      override: entry.payload,
    }));

  const generated = suggestedEntries
    .filter((entry) => entry.sourceType === 'generated')
    .map((entry) => ({
      objectName: entry.objectName,
      sourceFile: entry.sourceLabel,
      reason: 'User-reviewed generated COM definition.',
      definition: entry.payload,
    }));

  return {
    overridesOverride: matched,
    generatedDefinitionsOverride: generated,
  };
};

export const getSuggestedDirtyMeta = (entry: SuggestedEntry): SuggestedDirtyMeta => {
  const currentFieldValues = entry.fields.reduce<Record<string, string>>((acc, item) => {
    acc[item.field] = item.value;
    return acc;
  }, {});

  const fieldKeys = Array.from(
    new Set([...Object.keys(entry.initialFieldValues), ...Object.keys(currentFieldValues)]),
  );

  const changedFields = fieldKeys.filter(
    (key) => (entry.initialFieldValues[key] ?? '') !== (currentFieldValues[key] ?? ''),
  );

  const payloadDirty = JSON.stringify(entry.payload) !== JSON.stringify(entry.initialPayload);
  return {
    changedFields,
    dirty: payloadDirty,
  };
};
