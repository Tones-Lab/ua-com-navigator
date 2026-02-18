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
    override: Record<string, any>;
  }>;
  generatedDefinitions: Array<{
    objectName: string;
    sourceFile: string;
    reason: string;
    definition: Record<string, any>;
  }>;
  outputPath?: string;
};
