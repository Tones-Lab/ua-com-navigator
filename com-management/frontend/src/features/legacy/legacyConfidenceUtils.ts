export type LegacyConfidenceLevel = 'high' | 'medium' | 'low';

export type LegacyConfidenceCause =
  | 'manual-expression-shape'
  | 'unresolved-variable-mappings'
  | 'regex-branch-complexity'
  | 'heuristic-alias-mapping'
  | 'missing-confidence-metadata'
  | 'general-medium-confidence';

export type LegacyConfidenceCandidate = {
  key: string;
  objectName: string;
  sourceFile: string;
  targetField: string;
  confidenceScore: number;
  confidenceLevel: LegacyConfidenceLevel;
  status: string;
  recommendedProcessor: string;
  requiredMappings: string[];
  causes: LegacyConfidenceCause[];
};

export type LegacyConfidencePreview = {
  totals: {
    stubs: number;
    high: number;
    medium: number;
    low: number;
    direct: number;
    conditional: number;
    manual: number;
  };
  selection: {
    minLevel: LegacyConfidenceLevel;
    strictMinLevel: boolean;
    fallbackUsed: boolean;
    eligibleByMinLevel: number;
    selectedCount: number;
  };
  rootCauseCounts: Record<LegacyConfidenceCause, number>;
  candidates: LegacyConfidenceCandidate[];
};

export type LegacyConfidenceSnapshot = {
  generatedAt: string;
  selectedKeys: string[];
  selectedMap: Record<string, LegacyConfidenceCandidate>;
  rootCauseCounts: Record<LegacyConfidenceCause, number>;
};

export type LegacyConfidenceDrift = {
  selectionChange: {
    added: number;
    removed: number;
    common: number;
  };
  scoreChange: {
    improved: number;
    regressed: number;
    unchanged: number;
  };
  rootCauseDelta: Record<LegacyConfidenceCause, number>;
};

export type LegacyConfidenceCalibrationExport = {
  generatedAt: string;
  source: 'legacy-ui';
  runId: string;
  totals: LegacyConfidencePreview['totals'];
  selectionPolicy: LegacyConfidencePreview['selection'];
  rootCauseCounts: Record<LegacyConfidenceCause, number>;
  topRiskStubs: LegacyConfidenceCandidate[];
};

export type LegacyConfidenceDriftExport = {
  generatedAt: string;
  source: 'legacy-ui';
  runId: string;
  beforeGeneratedAt?: string;
  afterGeneratedAt?: string;
  selectionChange: LegacyConfidenceDrift['selectionChange'];
  scoreChange: LegacyConfidenceDrift['scoreChange'];
  rootCauseDelta: LegacyConfidenceDrift['rootCauseDelta'];
};

const confidenceOrder: Record<LegacyConfidenceLevel, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const emptyCauseCounts = (): Record<LegacyConfidenceCause, number> => ({
  'manual-expression-shape': 0,
  'unresolved-variable-mappings': 0,
  'regex-branch-complexity': 0,
  'heuristic-alias-mapping': 0,
  'missing-confidence-metadata': 0,
  'general-medium-confidence': 0,
});

const toCauseList = (stub: any): LegacyConfidenceCause[] => {
  const causes = new Set<LegacyConfidenceCause>();
  const noteText = Array.isArray(stub?.notes)
    ? stub.notes.map((entry: any) => String(entry || '').toLowerCase()).join(' ')
    : '';
  const rationale = String(stub?.confidence?.rationale || '').toLowerCase();

  if (!stub?.confidence) {
    causes.add('missing-confidence-metadata');
  }
  if (String(stub?.status || '') === 'manual') {
    causes.add('manual-expression-shape');
  }
  if (Array.isArray(stub?.requiredMappings) && stub.requiredMappings.length > 0) {
    causes.add('unresolved-variable-mappings');
  }
  if (
    String(stub?.recommendedProcessor || '') === 'if' ||
    rationale.includes('regex-branch-chain') ||
    noteText.includes('regex-capture')
  ) {
    causes.add('regex-branch-complexity');
  }
  if (rationale.includes('heuristic') || noteText.includes('heuristic')) {
    causes.add('heuristic-alias-mapping');
  }
  if (causes.size === 0 && String(stub?.confidence?.level || 'medium') === 'medium') {
    causes.add('general-medium-confidence');
  }

  return Array.from(causes);
};

const scoreValue = (stub: any) => {
  const value = Number(stub?.confidence?.score);
  if (Number.isFinite(value)) {
    return value;
  }
  return 0.5;
};

const levelValue = (stub: any): LegacyConfidenceLevel => {
  const value = String(stub?.confidence?.level || 'medium');
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }
  return 'medium';
};

const candidateKey = (stub: any) =>
  [
    String(stub?.objectName || 'unknown'),
    String(stub?.sourceFile || 'unknown'),
    String(stub?.targetField || 'unknown'),
  ].join('|');

const toCandidate = (stub: any): LegacyConfidenceCandidate => ({
  key: candidateKey(stub),
  objectName: String(stub?.objectName || 'unknown'),
  sourceFile: String(stub?.sourceFile || 'unknown'),
  targetField: String(stub?.targetField || 'unknown'),
  confidenceScore: scoreValue(stub),
  confidenceLevel: levelValue(stub),
  status: String(stub?.status || 'unknown'),
  recommendedProcessor: String(stub?.recommendedProcessor || 'unknown'),
  requiredMappings: Array.isArray(stub?.requiredMappings)
    ? stub.requiredMappings.map((entry: any) => String(entry))
    : [],
  causes: toCauseList(stub),
});

const candidateSort = (left: LegacyConfidenceCandidate, right: LegacyConfidenceCandidate) => {
  if (left.confidenceScore !== right.confidenceScore) {
    return left.confidenceScore - right.confidenceScore;
  }
  if (left.requiredMappings.length !== right.requiredMappings.length) {
    return right.requiredMappings.length - left.requiredMappings.length;
  }
  return left.objectName.localeCompare(right.objectName);
};

export const buildLegacyConfidencePreview = (
  processorStubs: any[],
  options: {
    minLevel: LegacyConfidenceLevel;
    strictMinLevel: boolean;
    maxItems: number;
  },
): LegacyConfidencePreview => {
  const stubs = Array.isArray(processorStubs) ? processorStubs : [];
  const candidates = stubs.map((stub) => toCandidate(stub));
  const high = candidates.filter((entry) => entry.confidenceLevel === 'high').length;
  const medium = candidates.filter((entry) => entry.confidenceLevel === 'medium').length;
  const low = candidates.filter((entry) => entry.confidenceLevel === 'low').length;
  const direct = stubs.filter((entry) => String(entry?.status || '') === 'direct').length;
  const conditional = stubs.filter((entry) => String(entry?.status || '') === 'conditional').length;
  const manual = stubs.filter((entry) => String(entry?.status || '') === 'manual').length;

  const threshold = confidenceOrder[options.minLevel];
  const eligible = candidates
    .filter((entry) => confidenceOrder[entry.confidenceLevel] <= threshold)
    .sort(candidateSort);
  const selectedByThreshold = eligible.slice(0, Math.max(1, options.maxItems));
  const fallbackUsed = !options.strictMinLevel && selectedByThreshold.length === 0 && candidates.length > 0;
  const selected = fallbackUsed
    ? candidates.slice().sort(candidateSort).slice(0, Math.max(1, options.maxItems))
    : selectedByThreshold;

  const rootCauseCounts = emptyCauseCounts();
  selected.forEach((entry) => {
    entry.causes.forEach((cause) => {
      rootCauseCounts[cause] += 1;
    });
  });

  return {
    totals: {
      stubs: stubs.length,
      high,
      medium,
      low,
      direct,
      conditional,
      manual,
    },
    selection: {
      minLevel: options.minLevel,
      strictMinLevel: options.strictMinLevel,
      fallbackUsed,
      eligibleByMinLevel: eligible.length,
      selectedCount: selected.length,
    },
    rootCauseCounts,
    candidates: selected,
  };
};

export const createLegacyConfidenceSnapshot = (
  preview: LegacyConfidencePreview,
): LegacyConfidenceSnapshot => {
  const selectedMap = preview.candidates.reduce<Record<string, LegacyConfidenceCandidate>>((acc, entry) => {
    acc[entry.key] = entry;
    return acc;
  }, {});
  return {
    generatedAt: new Date().toISOString(),
    selectedKeys: preview.candidates.map((entry) => entry.key),
    selectedMap,
    rootCauseCounts: { ...preview.rootCauseCounts },
  };
};

export const computeLegacyConfidenceDrift = (
  previous: LegacyConfidenceSnapshot,
  current: LegacyConfidenceSnapshot,
): LegacyConfidenceDrift => {
  const prevSet = new Set(previous.selectedKeys);
  const currSet = new Set(current.selectedKeys);
  const commonKeys = previous.selectedKeys.filter((key) => currSet.has(key));
  const added = current.selectedKeys.filter((key) => !prevSet.has(key));
  const removed = previous.selectedKeys.filter((key) => !currSet.has(key));

  let improved = 0;
  let regressed = 0;
  let unchanged = 0;
  commonKeys.forEach((key) => {
    const prev = previous.selectedMap[key];
    const curr = current.selectedMap[key];
    if (!prev || !curr) {
      return;
    }
    if (curr.confidenceScore > prev.confidenceScore) {
      improved += 1;
    } else if (curr.confidenceScore < prev.confidenceScore) {
      regressed += 1;
    } else {
      unchanged += 1;
    }
  });

  const rootCauseDelta = emptyCauseCounts();
  (Object.keys(rootCauseDelta) as LegacyConfidenceCause[]).forEach((cause) => {
    rootCauseDelta[cause] = (current.rootCauseCounts[cause] || 0) - (previous.rootCauseCounts[cause] || 0);
  });

  return {
    selectionChange: {
      added: added.length,
      removed: removed.length,
      common: commonKeys.length,
    },
    scoreChange: {
      improved,
      regressed,
      unchanged,
    },
    rootCauseDelta,
  };
};

export const buildLegacyConfidenceCalibrationExport = (
  preview: LegacyConfidencePreview,
  runId: string,
): LegacyConfidenceCalibrationExport => ({
  generatedAt: new Date().toISOString(),
  source: 'legacy-ui',
  runId,
  totals: { ...preview.totals },
  selectionPolicy: { ...preview.selection },
  rootCauseCounts: { ...preview.rootCauseCounts },
  topRiskStubs: preview.candidates.map((entry) => ({
    ...entry,
    requiredMappings: [...entry.requiredMappings],
    causes: [...entry.causes],
  })),
});

export const renderLegacyConfidenceCalibrationText = (
  report: LegacyConfidenceCalibrationExport,
) => {
  const lines: string[] = [];
  lines.push('Legacy Confidence Calibration (UI Export)');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Run: ${report.runId}`);
  lines.push(
    `Totals: ${report.totals.stubs} stubs (high ${report.totals.high}, medium ${report.totals.medium}, low ${report.totals.low})`,
  );
  lines.push(
    `Statuses: direct ${report.totals.direct}, conditional ${report.totals.conditional}, manual ${report.totals.manual}`,
  );
  lines.push(
    `Selection: min-level=${report.selectionPolicy.minLevel}, strict=${report.selectionPolicy.strictMinLevel}, eligible=${report.selectionPolicy.eligibleByMinLevel}, selected=${report.selectionPolicy.selectedCount}${report.selectionPolicy.fallbackUsed ? ', fallback=yes' : ''}`,
  );
  lines.push('');
  lines.push('Root causes:');
  Object.entries(report.rootCauseCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cause, count]) => {
      lines.push(`- ${cause}: ${count}`);
    });
  lines.push('');
  lines.push('Top risk candidates:');
  report.topRiskStubs.forEach((entry, index) => {
    lines.push(
      `${index + 1}. ${entry.objectName} ${entry.targetField} score=${entry.confidenceScore.toFixed(2)} level=${entry.confidenceLevel}`,
    );
    lines.push(`   causes=${entry.causes.join('|') || 'none'}`);
  });
  return `${lines.join('\n')}\n`;
};

export const buildLegacyConfidenceDriftExport = (
  runId: string,
  drift: LegacyConfidenceDrift,
  meta?: {
    beforeGeneratedAt?: string;
    afterGeneratedAt?: string;
  },
): LegacyConfidenceDriftExport => ({
  generatedAt: new Date().toISOString(),
  source: 'legacy-ui',
  runId,
  beforeGeneratedAt: meta?.beforeGeneratedAt,
  afterGeneratedAt: meta?.afterGeneratedAt,
  selectionChange: { ...drift.selectionChange },
  scoreChange: { ...drift.scoreChange },
  rootCauseDelta: { ...drift.rootCauseDelta },
});

export const renderLegacyConfidenceDriftText = (
  report: LegacyConfidenceDriftExport,
) => {
  const lines: string[] = [];
  lines.push('Legacy Confidence Drift (UI Export)');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Run: ${report.runId}`);
  if (report.beforeGeneratedAt || report.afterGeneratedAt) {
    lines.push(`Before snapshot: ${report.beforeGeneratedAt || 'n/a'}`);
    lines.push(`After snapshot: ${report.afterGeneratedAt || 'n/a'}`);
  }
  lines.push(
    `Selection change: common ${report.selectionChange.common}, added ${report.selectionChange.added}, removed ${report.selectionChange.removed}`,
  );
  lines.push(
    `Score change: improved ${report.scoreChange.improved}, regressed ${report.scoreChange.regressed}, unchanged ${report.scoreChange.unchanged}`,
  );
  lines.push('');
  lines.push('Root cause delta:');
  Object.entries(report.rootCauseDelta)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .forEach(([cause, delta]) => {
      lines.push(`- ${cause}: ${delta >= 0 ? '+' : ''}${delta}`);
    });
  return `${lines.join('\n')}\n`;
};
