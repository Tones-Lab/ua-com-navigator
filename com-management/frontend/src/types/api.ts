export type AuthMethod = 'basic' | 'certificate';

export type FavoriteScope = 'fcom' | 'pcom' | 'mib';

export type AuthCredentials = {
  username?: string;
  password?: string;
  cert_path?: string;
  key_path?: string;
  ca_cert_path?: string;
};

export type BrowseFilters = {
  node?: string;
  vendor?: string;
  protocol_type?: string;
  search?: string;
};

export type SaveFilePayload = {
  file_id: string;
  content: unknown;
  etag: string;
  commit_message: string;
};

export type SaveFileResult = {
  file_id: string;
  revision: string;
  last_modified: string;
  commit_id: string;
  etag: string;
};

export type FavoriteEntry = {
  type: 'file' | 'folder';
  pathId: string;
  label: string;
  node?: string;
};

export type FavoriteFileEntry = FavoriteEntry & {
  type: 'file';
};

export type FavoriteFolderEntry = FavoriteEntry & {
  type: 'folder';
};

export type FavoriteRequest = FavoriteEntry & {
  scope: FavoriteScope;
};

export type FavoriteDeleteRequest = {
  type: 'file' | 'folder';
  pathId: string;
  scope: FavoriteScope;
};

export type FavoritesResponse = {
  favorites: FavoriteEntry[];
};

export type LegacyConversionRequest = {
  paths?: string[];
  vendor?: string;
  useMibs?: boolean;
  useLlm?: boolean;
  useLlmReview?: boolean;
};

export type LegacyUploadEntry = {
  path: string;
  type: 'file' | 'folder';
  size: number;
  modifiedAt: string;
};

export type LegacyUploadsResponse = {
  root: string;
  entries: LegacyUploadEntry[];
};

export type LegacyFileReadResponse = {
  path: string;
  content: string;
};

export type LegacyConversionResponse = {
  textReport: string;
  report: Record<string, any>;
};

export type LegacyApplyFcomOverridesRequest = {
  report: Record<string, any>;
  dryRun?: boolean;
  minScore?: number;
  overridesOverride?: Array<{
    objectName: string;
    sourceFiles: string[];
    override: Record<string, any>;
  }>;
  generatedDefinitionsOverride?: Array<{
    objectName: string;
    sourceFile: string;
    reason: string;
    definition: Record<string, any>;
  }>;
};

export type LegacyApplyFcomOverrideConflict = {
  field: string;
  existingValue: any;
  incomingValue: any;
  source: string;
};

export type LegacyApplyFcomOverridesResponse = {
  generatedAt: string;
  dryRun: boolean;
  minScore: number;
  summary: {
    totalMatchDiffs: number;
    matchedExistingFcomObjects: number;
    confirmedObjects: number;
    generatedDefinitions: number;
    conflictObjects: number;
  };
  conflicts: Array<{
    objectName: string;
    conflicts: LegacyApplyFcomOverrideConflict[];
  }>;
  overrides: Array<{
    objectName: string;
    sourceFiles: string[];
    processorSummary?: {
      totalFields: number;
      implementedFromParserStubs: number;
      manualStubCount: number;
      fallbackSetCount: number;
    };
    override: Record<string, any>;
  }>;
  generatedDefinitions: Array<{
    objectName: string;
    sourceFile: string;
    reason: string;
    processorSummary?: {
      totalFields: number;
      implementedFromParserStubs: number;
      manualStubCount: number;
      fallbackSetCount: number;
    };
    definition: Record<string, any>;
  }>;
  outputPath?: string;
};

export type LegacyRunPipelineRequest = {
  inputPaths: string[];
  runName?: string;
  outputRoot?: string;
  minLevel?: 'low' | 'medium' | 'high';
  strictMinLevel?: boolean;
  maxItems?: number;
  compareMode?: 'none' | 'latest' | 'before';
  compareBeforePath?: string;
  useLlmReview?: boolean;
};

export type LegacyRunPipelineResponse = {
  success: boolean;
  command: string;
  runName: string;
  runOutputDir: string;
  stdout: string;
  stderr: string;
  manifest: Record<string, any> | null;
};

export type LegacyPipelineReportRequest = {
  runOutputDir: string;
};

export type LegacyPipelineReportResponse = {
  runOutputDir: string;
  manifest: Record<string, any>;
  report: Record<string, any>;
  textReport: string;
};

export type LegacyReviewQueueRequest = {
  report: Record<string, any>;
  applyPreview?: Record<string, any>;
  options?: {
    hideHighConfidence?: boolean;
    needsInterventionOnly?: boolean;
    maxItems?: number;
  };
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
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
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
    targetType: 'override' | 'generated-definition' | 'unknown';
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
    decision: 'accepted' | 'edited' | 'rejected' | 'deferred' | 'unset';
    editedPayload: Record<string, any> | null;
    reviewerNote: string;
  };
};

export type LegacyReviewQueueResponse = {
  queueId: string;
  generatedAt: string;
  options: {
    hideHighConfidence: boolean;
    needsInterventionOnly: boolean;
    maxItems: number;
  };
  summary: {
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
  items: LegacyReviewQueueItem[];
};
