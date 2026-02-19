type ReviewDecision = 'accepted' | 'edited' | 'rejected' | 'deferred' | 'unset';

type ReviewRiskLevel = 'critical' | 'high' | 'medium' | 'low';

type ReviewTargetType = 'override' | 'generated-definition' | 'unknown';

type ReviewQueueOptions = {
  hideHighConfidence?: boolean;
  needsInterventionOnly?: boolean;
  maxItems?: number;
};

type ReviewApplyPreview = {
  overrides?: Array<{
    objectName?: string;
    sourceFiles?: string[];
  }>;
  generatedDefinitions?: Array<{
    objectName?: string;
    sourceFile?: string;
  }>;
  conflicts?: Array<{
    objectName?: string;
    conflicts?: Array<{
      field?: string;
    }>;
  }>;
};

export type LegacyReviewQueueRequest = {
  report: Record<string, any>;
  applyPreview?: ReviewApplyPreview;
  options?: ReviewQueueOptions;
};

export type LegacyReviewQueueItem = {
  reviewItemId: string;
  queueIndex: number;
  reviewGroup: {
    groupId: string;
    condition: string | null;
    branchLineStart: number | null;
    branchLineEnd: number | null;
    totalItems: number;
    groupFields: string[];
  };
  riskLevel: ReviewRiskLevel;
  reviewPriorityScore: number;
  source: {
    sourceFile: string;
    sourceFunction: string;
    sourceLineStart: number | null;
    sourceLineEnd: number | null;
    sourceSnippet: string | null;
    mappedLineStart: number | null;
    mappedLineEnd: number | null;
    mappedLineNumber: number | null;
    mappedLineText: string | null;
  };
  target: {
    targetType: ReviewTargetType;
    objectName: string;
    targetField: string;
    outputFile: string | null;
    outputLineStart: number | null;
    outputLineEnd: number | null;
  };
  proposal: {
    processorType: string;
    processorPayload: Record<string, any> | null;
    fallbackUsed: boolean;
  };
  quality: {
    confidenceScore: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    status: string;
    rootCauses: string[];
    requiredMappings: string[];
    conflictFlag: boolean;
    needsIntervention: boolean;
    hiddenByDefault: boolean;
  };
  userDecision: {
    decision: ReviewDecision;
    editedPayload: Record<string, any> | null;
    reviewerNote: string;
  };
};

export type LegacyReviewQueueSummary = {
  totalItems: number;
  visibleItems: number;
  hiddenHighConfidence: number;
  hiddenByInterventionFilter: number;
  needsInterventionVisible: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
};

export type LegacyReviewQueueResponse = {
  queueId: string;
  generatedAt: string;
  options: Required<ReviewQueueOptions>;
  summary: LegacyReviewQueueSummary;
  items: LegacyReviewQueueItem[];
};

const makeQueueId = () => {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `legacy-review-${stamp}-${suffix}`;
};

const normalizeOptions = (input?: ReviewQueueOptions): Required<ReviewQueueOptions> => {
  const maxItemsRaw = Number(input?.maxItems ?? 500);
  const maxItems = Number.isFinite(maxItemsRaw) && maxItemsRaw > 0
    ? Math.min(5000, Math.floor(maxItemsRaw))
    : 500;
  return {
    hideHighConfidence: input?.hideHighConfidence !== false,
    needsInterventionOnly: input?.needsInterventionOnly !== false,
    maxItems,
  };
};

const toScore = (stub: any): number => {
  const scoreRaw = Number(stub?.confidence?.score);
  if (Number.isFinite(scoreRaw)) {
    return Math.max(0, Math.min(1, scoreRaw));
  }
  const status = String(stub?.status || '').toLowerCase();
  if (status === 'manual') {
    return 0.3;
  }
  if (status === 'conditional') {
    return 0.62;
  }
  return 0.9;
};

const toLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= 0.8) {
    return 'high';
  }
  if (score >= 0.55) {
    return 'medium';
  }
  return 'low';
};

const getTemplateProcessorType = (template: any): string => {
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    return 'manual';
  }
  const keys = ['if', 'regex', 'lookup', 'replace', 'copy', 'set'];
  const match = keys.find((key) => Object.prototype.hasOwnProperty.call(template, key));
  return match || 'manual';
};

const buildBlockIndex = (report: any) => {
  const map = new Map<string, any>();
  const files = Array.isArray(report?.files) ? report.files : [];
  files.forEach((analysis: any) => {
    const filePath = String(analysis?.filePath || '');
    if (!filePath) {
      return;
    }
    const blocks = Array.isArray(analysis?.functionBlocks) ? analysis.functionBlocks : [];
    blocks.forEach((block: any) => {
      const name = String(block?.name || '').trim();
      if (!name) {
        return;
      }
      map.set(`${filePath}::${name}`, block);
    });
  });
  return map;
};

type BranchContext = {
  groupId: string;
  condition: string | null;
  conditionKind: 'if' | 'elsif' | 'else';
  startLine: number | null;
  endLine: number | null;
  depth: number;
  chainStartLine: number | null;
  chainEndLine: number | null;
  fields: Set<string>;
};

const extractAssignedEventFields = (line: string): string[] => {
  const regex = /\$Event->\{\s*['"]?([A-Za-z0-9_]+)['"]?\s*\}\s*=/g;
  const fields: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(String(line || ''))) !== null) {
    const field = String(match[1] || '').trim();
    if (field) {
      fields.push(field);
    }
  }
  return fields;
};

const buildBranchContextsForBlock = (
  blockText: string,
  filePath: string,
  functionName: string,
  baseLine: number,
): BranchContext[] => {
  const lines = String(blockText || '').split(/\r?\n/);
  const contexts: BranchContext[] = [];
  const stack: BranchContext[] = [];
  let depth = 0;

  lines.forEach((line, index) => {
    const trimmed = String(line || '').trim();
    const depthAtLineStart = depth;
    const ifMatch = trimmed.match(/^(if|elsif)\s*\((.+)\)\s*\{/);
    const elseMatch = !ifMatch ? trimmed.match(/^\s*else\s*\{/) : null;

    if (ifMatch || elseMatch) {
      const condition = ifMatch ? String(ifMatch[2] || '').trim() : 'else';
      const startLine = baseLine + index;
      const conditionKind: BranchContext['conditionKind'] = ifMatch
        ? (String(ifMatch[1] || '').trim() === 'elsif' ? 'elsif' : 'if')
        : 'else';
      const context: BranchContext = {
        groupId: `branch::${filePath}::${functionName}::${startLine}`,
        condition,
        conditionKind,
        startLine,
        endLine: null,
        depth: depthAtLineStart,
        chainStartLine: startLine,
        chainEndLine: null,
        fields: new Set<string>(),
      };
      stack.push(context);
    }

    const assignedFields = extractAssignedEventFields(line);
    if (assignedFields.length > 0 && stack.length > 0) {
      const active = stack[stack.length - 1];
      assignedFields.forEach((field) => active.fields.add(field));
    }

    const openCount = (line.match(/\{/g) || []).length;
    const closeCount = (line.match(/\}/g) || []).length;
    depth = Math.max(0, depth + openCount - closeCount);
    for (let i = 0; i < closeCount; i += 1) {
      const closing = stack.pop();
      if (!closing) {
        continue;
      }
      if (closing.fields.size > 0) {
        closing.endLine = baseLine + index;
        contexts.push(closing);
      }
    }
  });

  stack.forEach((open) => {
    if (open.fields.size > 0) {
      open.endLine = baseLine + lines.length - 1;
      contexts.push(open);
    }
  });

  const sorted = [...contexts].sort((left, right) =>
    Number(left.startLine || 0) - Number(right.startLine || 0),
  );
  for (let index = 0; index < sorted.length; index += 1) {
    const current = sorted[index];
    if (current.conditionKind !== 'if') {
      continue;
    }
    const chainStart = current.startLine;
    let chainEnd = current.endLine;
    for (let cursor = index + 1; cursor < sorted.length; cursor += 1) {
      const candidate = sorted[cursor];
      if (candidate.depth !== current.depth) {
        continue;
      }
      if (candidate.conditionKind === 'elsif' || candidate.conditionKind === 'else') {
        if (Number(candidate.startLine || 0) >= Number(chainEnd || 0)) {
          chainEnd = candidate.endLine;
          if (candidate.conditionKind === 'else') {
            break;
          }
          continue;
        }
      }
      if (candidate.conditionKind === 'if' && Number(candidate.startLine || 0) > Number(chainEnd || 0)) {
        break;
      }
    }

    const chainGroupId = `branch-chain::${filePath}::${functionName}::${chainStart}-${chainEnd}`;
    for (let cursor = index; cursor < sorted.length; cursor += 1) {
      const candidate = sorted[cursor];
      if (candidate.depth !== current.depth) {
        continue;
      }
      if (Number(candidate.startLine || 0) < Number(chainStart || 0)) {
        continue;
      }
      if (Number(candidate.endLine || 0) > Number(chainEnd || 0)) {
        if (candidate.conditionKind === 'if') {
          break;
        }
        continue;
      }
      if (!['if', 'elsif', 'else'].includes(candidate.conditionKind)) {
        continue;
      }
      candidate.chainStartLine = chainStart;
      candidate.chainEndLine = chainEnd;
      candidate.groupId = chainGroupId;
      if (candidate.conditionKind === 'else') {
        break;
      }
    }
  }

  return contexts;
};

const buildBranchFieldIndex = (report: any) => {
  const index = new Map<string, Map<string, BranchContext>>();
  const files = Array.isArray(report?.files) ? report.files : [];

  files.forEach((analysis: any) => {
    const filePath = String(analysis?.filePath || '').trim();
    if (!filePath) {
      return;
    }
    const blocks = Array.isArray(analysis?.functionBlocks) ? analysis.functionBlocks : [];
    blocks.forEach((block: any) => {
      const functionName = String(block?.name || '').trim();
      const startLine = Number.isFinite(Number(block?.startLine)) ? Number(block.startLine) : 1;
      if (!functionName) {
        return;
      }
      const contexts = buildBranchContextsForBlock(String(block?.text || ''), filePath, functionName, startLine);
      const key = `${filePath}::${functionName}`;
      if (!index.has(key)) {
        index.set(key, new Map<string, BranchContext>());
      }
      const fieldMap = index.get(key)!;
      contexts.forEach((context) => {
        context.fields.forEach((field) => {
          const existing = fieldMap.get(field);
          if (!existing) {
            fieldMap.set(field, context);
            return;
          }
          const existingSpan = Math.abs(Number(existing.endLine || 0) - Number(existing.startLine || 0));
          const nextSpan = Math.abs(Number(context.endLine || 0) - Number(context.startLine || 0));
          if (nextSpan <= existingSpan) {
            fieldMap.set(field, context);
          }
        });
      });
    });
  });

  return index;
};

const buildConflictFieldIndex = (applyPreview?: ReviewApplyPreview) => {
  const map = new Map<string, Set<string>>();
  const conflicts = Array.isArray(applyPreview?.conflicts) ? applyPreview?.conflicts : [];
  conflicts.forEach((entry) => {
    const objectName = String(entry?.objectName || '').trim();
    if (!objectName) {
      return;
    }
    if (!map.has(objectName)) {
      map.set(objectName, new Set<string>());
    }
    const fieldSet = map.get(objectName)!;
    const fieldEntries = Array.isArray(entry?.conflicts) ? entry.conflicts : [];
    fieldEntries.forEach((conflict) => {
      const field = String(conflict?.field || '').trim();
      if (field) {
        fieldSet.add(field);
      }
    });
  });
  return map;
};

const buildTargetTypeIndex = (applyPreview?: ReviewApplyPreview) => {
  const overrideKeys = new Set<string>();
  const generatedKeys = new Set<string>();

  const overrides = Array.isArray(applyPreview?.overrides) ? applyPreview?.overrides : [];
  overrides.forEach((entry) => {
    const objectName = String(entry?.objectName || '').trim();
    if (!objectName) {
      return;
    }
    const sourceFiles = Array.isArray(entry?.sourceFiles) ? entry.sourceFiles : [];
    if (sourceFiles.length === 0) {
      overrideKeys.add(`${objectName}::*`);
      return;
    }
    sourceFiles.forEach((sourceFile) => {
      const file = String(sourceFile || '').trim();
      if (file) {
        overrideKeys.add(`${objectName}::${file}`);
      }
    });
  });

  const generated = Array.isArray(applyPreview?.generatedDefinitions) ? applyPreview?.generatedDefinitions : [];
  generated.forEach((entry) => {
    const objectName = String(entry?.objectName || '').trim();
    const sourceFile = String(entry?.sourceFile || '').trim();
    if (!objectName) {
      return;
    }
    if (!sourceFile) {
      generatedKeys.add(`${objectName}::*`);
      return;
    }
    generatedKeys.add(`${objectName}::${sourceFile}`);
  });

  return { overrideKeys, generatedKeys };
};

const deriveRootCauses = (stub: any, fallbackUsed: boolean): string[] => {
  const causes = new Set<string>();
  const status = String(stub?.status || '').toLowerCase();
  const requiredMappings = Array.isArray(stub?.requiredMappings) ? stub.requiredMappings : [];
  const recommendedProcessor = String(stub?.recommendedProcessor || '').toLowerCase();
  const notes = (Array.isArray(stub?.notes) ? stub.notes : []).map((note: unknown) =>
    String(note || '').toLowerCase(),
  );
  const rationale = String(stub?.confidence?.rationale || '').toLowerCase();

  if (status === 'manual') {
    causes.add('manual-expression-shape');
  }
  if (requiredMappings.length > 0) {
    causes.add('unresolved-variable-mappings');
  }
  if (recommendedProcessor === 'if' || recommendedProcessor === 'regex') {
    causes.add('regex-branch-complexity');
  }
  if (fallbackUsed) {
    causes.add('fallback-set-only');
  }
  if (rationale.includes('regex-branch-chain')) {
    causes.add('regex-branch-complexity');
  }
  if (rationale.includes('heuristic-mapping')) {
    causes.add('heuristic-alias-mapping');
  }
  if (notes.some((note: string) => note.includes('manual'))) {
    causes.add('manual-expression-shape');
  }
  if (notes.some((note: string) => note.includes('source-path mapping'))) {
    causes.add('unresolved-variable-mappings');
  }

  return Array.from(causes);
};

const computePriorityScore = (input: {
  status: string;
  rootCauses: string[];
  requiredMappings: string[];
  conflictFlag: boolean;
  fallbackUsed: boolean;
  confidenceScore: number;
}): number => {
  let score = 0;

  if (input.status === 'manual') {
    score += 100;
  } else if (input.status === 'conditional') {
    score += 60;
  }

  if (input.rootCauses.includes('regex-branch-complexity')) {
    score += 40;
  }
  if (input.conflictFlag) {
    score += 35;
  }
  if (input.fallbackUsed) {
    score += 25;
  }
  score += input.requiredMappings.length * 15;
  score += (1 - input.confidenceScore) * 30;

  return Number(score.toFixed(2));
};

const toRiskLevel = (score: number): ReviewRiskLevel => {
  if (score >= 120) {
    return 'critical';
  }
  if (score >= 80) {
    return 'high';
  }
  if (score >= 45) {
    return 'medium';
  }
  return 'low';
};

const deriveTargetType = (
  objectName: string,
  sourceFile: string,
  targetTypeIndex: ReturnType<typeof buildTargetTypeIndex>,
): ReviewTargetType => {
  const exactKey = `${objectName}::${sourceFile}`;
  const wildcardKey = `${objectName}::*`;
  if (targetTypeIndex.overrideKeys.has(exactKey) || targetTypeIndex.overrideKeys.has(wildcardKey)) {
    return 'override';
  }
  if (targetTypeIndex.generatedKeys.has(exactKey) || targetTypeIndex.generatedKeys.has(wildcardKey)) {
    return 'generated-definition';
  }
  return 'unknown';
};

const normalizeExpressionForMatch = (value: string) =>
  String(value || '')
    .trim()
    .replace(/;+$/, '')
    .replace(/\s+/g, ' ');

const findMappedSourceLineRange = (
  blockText: string,
  blockStartLine: number,
  targetFieldName: string,
  expression: string,
): {
  lineStart: number | null;
  lineEnd: number | null;
  lineNumber: number | null;
  lineText: string | null;
} => {
  const lines = String(blockText || '').split(/\r?\n/);
  if (lines.length === 0) {
    return { lineStart: null, lineEnd: null, lineNumber: null, lineText: null };
  }

  const fieldRegex = new RegExp(
    String.raw`\$Event->\{\s*['"]?${targetFieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?\s*\}\s*=`,
  );
  const expressionNormalized = normalizeExpressionForMatch(expression);

  const buildRangeCandidate = (startIndex: number) => {
    let endIndex = startIndex;
    while (endIndex < lines.length - 1 && endIndex - startIndex < 120) {
      const lineText = String(lines[endIndex] || '');
      if (lineText.includes(';')) {
        break;
      }
      endIndex += 1;
    }
    const joined = lines.slice(startIndex, endIndex + 1).join(' ');
    const normalized = normalizeExpressionForMatch(joined);
    return {
      startIndex,
      endIndex,
      normalized,
      lineText: String(lines[startIndex] || ''),
    };
  };

  const candidates: Array<{
    startIndex: number;
    endIndex: number;
    normalized: string;
    lineText: string;
  }> = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] || '');
    if (!fieldRegex.test(line)) {
      continue;
    }
    const candidate = buildRangeCandidate(index);
    candidates.push(candidate);
    if (expressionNormalized && candidate.normalized.includes(expressionNormalized)) {
      return {
        lineStart: blockStartLine + candidate.startIndex,
        lineEnd: blockStartLine + candidate.endIndex,
        lineNumber: blockStartLine + candidate.startIndex,
        lineText: candidate.lineText,
      };
    }
  }

  if (candidates.length > 0) {
    const first = candidates[0];
    return {
      lineStart: blockStartLine + first.startIndex,
      lineEnd: blockStartLine + first.endIndex,
      lineNumber: blockStartLine + first.startIndex,
      lineText: first.lineText,
    };
  }

  return { lineStart: null, lineEnd: null, lineNumber: null, lineText: null };
};

export const buildLegacyReviewQueue = (
  payload: LegacyReviewQueueRequest,
): LegacyReviewQueueResponse => {
  const report = payload?.report;
  if (!report || typeof report !== 'object') {
    throw new Error('Missing conversion report payload.');
  }

  const options = normalizeOptions(payload.options);
  const stubs = Array.isArray((report as any)?.stubs?.processorStubs)
    ? (report as any).stubs.processorStubs
    : [];
  const blockIndex = buildBlockIndex(report);
  const branchFieldIndex = buildBranchFieldIndex(report);
  const conflictFieldIndex = buildConflictFieldIndex(payload.applyPreview);
  const targetTypeIndex = buildTargetTypeIndex(payload.applyPreview);

  const allItems: LegacyReviewQueueItem[] = stubs.map((stub: any, index: number) => {
    const sourceFile = String(stub?.sourceFile || '').trim();
    const sourceFunction = String(stub?.ruleFunction || '__global__').trim() || '__global__';
    const objectName = String(stub?.objectName || 'legacy-object').trim() || 'legacy-object';
    const targetField = String(stub?.targetField || '').trim();
    const targetFieldName = targetField.startsWith('$.event.')
      ? targetField.replace('$.event.', '')
      : targetField;
    const status = String(stub?.status || 'manual').toLowerCase();
    const requiredMappings = Array.isArray(stub?.requiredMappings)
      ? stub.requiredMappings.map((value: any) => String(value)).filter(Boolean)
      : [];

    const confidenceScore = toScore(stub);
    const confidenceLevel = toLevel(confidenceScore);
    const template = stub?.template && typeof stub.template === 'object' ? stub.template : null;
    const fallbackUsed = !template;
    const conflictFlag = Boolean(conflictFieldIndex.get(objectName)?.has(targetFieldName));
    const rootCauses = deriveRootCauses(stub, fallbackUsed);
    const reviewPriorityScore = computePriorityScore({
      status,
      rootCauses,
      requiredMappings,
      conflictFlag,
      fallbackUsed,
      confidenceScore,
    });
    const riskLevel = toRiskLevel(reviewPriorityScore);

    const needsIntervention =
      status !== 'direct' ||
      conflictFlag ||
      requiredMappings.length > 0 ||
      fallbackUsed ||
      rootCauses.includes('regex-branch-complexity') ||
      rootCauses.includes('manual-expression-shape');

    const hiddenByDefault =
      status === 'direct' &&
      confidenceLevel === 'high' &&
      !conflictFlag &&
      requiredMappings.length === 0 &&
      !fallbackUsed;

    const block = blockIndex.get(`${sourceFile}::${sourceFunction}`) || blockIndex.get(`${sourceFile}::__global__`) || null;
    const branchMap =
      branchFieldIndex.get(`${sourceFile}::${sourceFunction}`) ||
      branchFieldIndex.get(`${sourceFile}::__global__`) ||
      null;
    const branch = branchMap?.get(targetFieldName) || null;
    const groupId = branch?.groupId || `ungrouped::${sourceFile}::${sourceFunction}`;
    const blockStartLine = Number.isFinite(Number(block?.startLine)) ? Number(block.startLine) : 1;
    const mappedLine = findMappedSourceLineRange(
      String(block?.text || ''),
      blockStartLine,
      targetFieldName,
      String(stub?.expression || ''),
    );

    return {
      reviewItemId: `item-${String(index + 1).padStart(4, '0')}`,
      queueIndex: 0,
      reviewGroup: {
        groupId,
        condition: branch?.condition || null,
        branchLineStart: branch?.chainStartLine ?? branch?.startLine ?? null,
        branchLineEnd: branch?.chainEndLine ?? branch?.endLine ?? null,
        totalItems: 0,
        groupFields: [],
      },
      riskLevel,
      reviewPriorityScore,
      source: {
        sourceFile,
        sourceFunction,
        sourceLineStart: Number.isFinite(Number(block?.startLine)) ? Number(block.startLine) : null,
        sourceLineEnd: Number.isFinite(Number(block?.endLine)) ? Number(block.endLine) : null,
        sourceSnippet: block?.text ? String(block.text) : null,
        mappedLineStart: mappedLine.lineStart,
        mappedLineEnd: mappedLine.lineEnd,
        mappedLineNumber: mappedLine.lineNumber,
        mappedLineText: mappedLine.lineText,
      },
      target: {
        targetType: deriveTargetType(objectName, sourceFile, targetTypeIndex),
        objectName,
        targetField,
        outputFile: null,
        outputLineStart: null,
        outputLineEnd: null,
      },
      proposal: {
        processorType: getTemplateProcessorType(template) || String(stub?.recommendedProcessor || 'manual'),
        processorPayload: template,
        fallbackUsed,
      },
      quality: {
        confidenceScore,
        confidenceLevel,
        status,
        rootCauses,
        requiredMappings,
        conflictFlag,
        needsIntervention,
        hiddenByDefault,
      },
      userDecision: {
        decision: 'unset',
        editedPayload: null,
        reviewerNote: '',
      },
    };
  });

  allItems.sort((left, right) => {
    if (right.reviewPriorityScore !== left.reviewPriorityScore) {
      return right.reviewPriorityScore - left.reviewPriorityScore;
    }
    if (left.quality.confidenceScore !== right.quality.confidenceScore) {
      return left.quality.confidenceScore - right.quality.confidenceScore;
    }
    if (left.source.sourceFile !== right.source.sourceFile) {
      return left.source.sourceFile.localeCompare(right.source.sourceFile);
    }
    const leftLine = left.source.sourceLineStart ?? Number.MAX_SAFE_INTEGER;
    const rightLine = right.source.sourceLineStart ?? Number.MAX_SAFE_INTEGER;
    return leftLine - rightLine;
  });

  let hiddenHighConfidence = 0;
  let hiddenByInterventionFilter = 0;

  const filtered = allItems.filter((item) => {
    if (options.hideHighConfidence && item.quality.hiddenByDefault) {
      hiddenHighConfidence += 1;
      return false;
    }
    if (options.needsInterventionOnly && !item.quality.needsIntervention) {
      hiddenByInterventionFilter += 1;
      return false;
    }
    return true;
  });

  const visibleSubset = filtered.slice(0, options.maxItems);
  const groupAgg = new Map<string, { totalItems: number; fields: Set<string> }>();
  visibleSubset.forEach((item) => {
    const groupId = item.reviewGroup.groupId;
    if (!groupAgg.has(groupId)) {
      groupAgg.set(groupId, { totalItems: 0, fields: new Set<string>() });
    }
    const agg = groupAgg.get(groupId)!;
    agg.totalItems += 1;
    const fieldName = String(item.target.targetField || '').replace('$.event.', '').trim();
    if (fieldName) {
      agg.fields.add(fieldName);
    }
  });

  const visibleItems = visibleSubset.map((item, index) => {
    const agg = groupAgg.get(item.reviewGroup.groupId);
    return {
      ...item,
      queueIndex: index + 1,
      reviewGroup: {
        ...item.reviewGroup,
        totalItems: agg?.totalItems || 1,
        groupFields: agg ? Array.from(agg.fields).sort((left, right) => left.localeCompare(right)) : [],
      },
    };
  });

  const summary: LegacyReviewQueueSummary = {
    totalItems: allItems.length,
    visibleItems: visibleItems.length,
    hiddenHighConfidence,
    hiddenByInterventionFilter,
    needsInterventionVisible: visibleItems.filter((item) => item.quality.needsIntervention).length,
    critical: visibleItems.filter((item) => item.riskLevel === 'critical').length,
    high: visibleItems.filter((item) => item.riskLevel === 'high').length,
    medium: visibleItems.filter((item) => item.riskLevel === 'medium').length,
    low: visibleItems.filter((item) => item.riskLevel === 'low').length,
  };

  return {
    queueId: makeQueueId(),
    generatedAt: new Date().toISOString(),
    options,
    summary,
    items: visibleItems,
  };
};
