import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger';

const DEFAULT_COMS_ROOT = path.resolve(process.cwd(), '..', '..', 'coms');
const MAX_CONTENT_BYTES = Number(process.env.SEARCH_MAX_CONTENT_BYTES || 5 * 1024 * 1024);
const DEFAULT_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const PATH_PREFIX = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
const IGNORED_DIRS = new Set(['.git', '.svn', 'node_modules']);

type SearchScope = 'name' | 'content' | 'all';

type NameEntry = {
  pathId: string;
  name: string;
  type: 'file' | 'folder';
  nameLower: string;
  pathLower: string;
};

type ContentEntry = {
  pathId: string;
  name: string;
  content: string;
  contentLower: string;
  sizeBytes: number;
};

type SearchResult = {
  type: 'file' | 'folder';
  pathId: string;
  name: string;
  source: 'name' | 'content' | 'both';
  matchCount?: number;
  matches?: Array<{ line: number; column: number; preview: string }>;
};

type SearchIndexData = {
  nameEntries: NameEntry[];
  contentEntries: ContentEntry[];
  fileCount: number;
  folderCount: number;
  contentFileCount: number;
  totalBytes: number;
};

type SearchIndexStatus = {
  rootPath: string;
  isReady: boolean;
  isBuilding: boolean;
  lastBuiltAt: string | null;
  lastDurationMs: number | null;
  nextRefreshAt: string | null;
  lastError: string | null;
  progress: {
    phase: string | null;
    processed: number;
    total: number;
    unit: string;
  };
  counts: {
    files: number;
    folders: number;
    contentFiles: number;
    totalBytes: number;
  };
};

const getRefreshIntervalMs = (durationMs: number) => {
  if (durationMs <= 30_000) {
    return 15 * 60 * 1000;
  }
  if (durationMs <= 5 * 60 * 1000) {
    return 30 * 60 * 1000;
  }
  return 60 * 60 * 1000;
};

const alignToNextMinute = (timestampMs: number) => {
  const minuteMs = 60 * 1000;
  return Math.ceil(timestampMs / minuteMs) * minuteMs;
};

const normalizePathId = (value: string) => value.replace(/^\/+/, '');

const applyPathPrefix = (relativePath: string) => {
  if (!PATH_PREFIX) {
    return relativePath;
  }
  return relativePath ? `${PATH_PREFIX}/${relativePath}` : PATH_PREFIX;
};

const getNameFromPath = (value: string) => {
  const cleaned = normalizePathId(value);
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] || cleaned;
};

const createSnippet = (text: string, index: number) => {
  const before = text.slice(0, index);
  const line = before.split('\n').length;
  const col = before.length - before.lastIndexOf('\n');
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + 80);
  const preview = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return { line, column: col, preview };
};

const countOccurrences = (text: string, query: string) => {
  let count = 0;
  let idx = 0;
  while (true) {
    const next = text.indexOf(query, idx);
    if (next === -1) {
      break;
    }
    count += 1;
    idx = next + query.length;
  }
  return count;
};

class SearchIndexService {
  private rootPath: string;
  private index: SearchIndexData | null = null;
  private isBuilding = false;
  private lastBuiltAt: string | null = null;
  private lastDurationMs: number | null = null;
  private nextRefreshAt: string | null = null;
  private lastError: string | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private progress = {
    phase: null as string | null,
    processed: 0,
    total: 0,
    unit: 'files',
  };

  constructor(rootPath?: string) {
    this.rootPath = rootPath || process.env.COMS_ROOT || DEFAULT_COMS_ROOT;
  }

  start() {
    if (this.isBuilding) {
      return;
    }
    void this.rebuildIndex('startup');
  }

  getStatus(): SearchIndexStatus {
    return {
      rootPath: this.rootPath,
      isReady: !!this.index,
      isBuilding: this.isBuilding,
      lastBuiltAt: this.lastBuiltAt,
      lastDurationMs: this.lastDurationMs,
      nextRefreshAt: this.nextRefreshAt,
      lastError: this.lastError,
      progress: this.progress,
      counts: {
        files: this.index?.fileCount || 0,
        folders: this.index?.folderCount || 0,
        contentFiles: this.index?.contentFileCount || 0,
        totalBytes: this.index?.totalBytes || 0,
      },
    };
  }

  async rebuildIndex(trigger: 'startup' | 'manual' | 'schedule' | 'update' = 'manual') {
    if (this.isBuilding) {
      return;
    }
    this.isBuilding = true;
    this.lastError = null;
    this.progress = {
      phase: 'Starting',
      processed: 0,
      total: 0,
      unit: 'files',
    };
    const start = Date.now();
    try {
      const nextIndex = await this.buildIndex();
      this.index = nextIndex;
      this.lastBuiltAt = new Date().toISOString();
      this.lastDurationMs = Date.now() - start;
      this.progress = {
        phase: 'Completed',
        processed: this.progress.total || this.progress.processed,
        total: this.progress.total || this.progress.processed,
        unit: this.progress.unit,
      };
      const interval = getRefreshIntervalMs(this.lastDurationMs);
      this.scheduleNextRefresh(interval);
      logger.info(`Search index rebuilt (${trigger}) in ${this.lastDurationMs}ms`);
    } catch (error: any) {
      this.lastError = error?.message || 'Search index rebuild failed';
      logger.error(`Search index rebuild error: ${this.lastError}`);
    } finally {
      this.isBuilding = false;
    }
  }

  scheduleNextRefresh(intervalMs: number) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
    const nextAt = alignToNextMinute(Date.now() + intervalMs);
    this.nextRefreshAt = new Date(nextAt).toISOString();
    this.refreshTimer = setTimeout(
      () => {
        void this.rebuildIndex('schedule');
      },
      Math.max(0, nextAt - Date.now()),
    );
  }

  requestRebuild() {
    if (this.isBuilding) {
      return;
    }
    void this.rebuildIndex('manual');
  }

  async updateFileFromContent(pathId: string, content: any) {
    if (!this.index) {
      return;
    }
    const normalized = normalizePathId(pathId);
    const prefixed =
      PATH_PREFIX && !normalized.startsWith(`${PATH_PREFIX}/`)
        ? `${PATH_PREFIX}/${normalized}`
        : normalized;
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const name = getNameFromPath(prefixed);
    const nameLower = name.toLowerCase();
    const pathLower = prefixed.toLowerCase();

    const nameEntries = this.index.nameEntries.filter(
      (entry) => !(entry.type === 'file' && entry.pathId === prefixed),
    );
    nameEntries.push({
      pathId: prefixed,
      name,
      type: 'file',
      nameLower,
      pathLower,
    });

    const contentEntries = this.index.contentEntries.filter((entry) => entry.pathId !== prefixed);
    contentEntries.push({
      pathId: prefixed,
      name,
      content: text,
      contentLower: text.toLowerCase(),
      sizeBytes: Buffer.byteLength(text, 'utf-8'),
    });

    this.index = {
      ...this.index,
      nameEntries,
      contentEntries,
      contentFileCount: contentEntries.length,
      fileCount: nameEntries.filter((entry) => entry.type === 'file').length,
    };
  }

  search(query: string, scope: SearchScope, limit: number): SearchResult[] {
    if (!this.index || !query.trim()) {
      return [];
    }
    const normalizedQuery = query.toLowerCase();
    const results: SearchResult[] = [];
    const seen = new Map<string, number>();

    const includeName = scope === 'name' || scope === 'all';
    const includeContent = scope === 'content' || scope === 'all';

    if (includeName) {
      for (const entry of this.index.nameEntries) {
        if (
          entry.nameLower.includes(normalizedQuery) ||
          entry.pathLower.includes(normalizedQuery)
        ) {
          if (seen.has(entry.pathId)) {
            continue;
          }
          results.push({
            type: entry.type,
            pathId: entry.pathId,
            name: entry.name,
            source: 'name',
          });
          seen.set(entry.pathId, results.length - 1);
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }

    if (includeContent) {
      for (const entry of this.index.contentEntries) {
        if (entry.contentLower.includes(normalizedQuery)) {
          const idx = entry.contentLower.indexOf(normalizedQuery);
          const matchCount = countOccurrences(entry.contentLower, normalizedQuery);
          const matches = idx >= 0 ? [createSnippet(entry.content, idx)] : [];
          if (seen.has(entry.pathId)) {
            const index = seen.get(entry.pathId);
            if (index !== undefined) {
              results[index] = {
                ...results[index],
                source: results[index].source === 'name' ? 'both' : results[index].source,
                matchCount,
                matches,
              };
            }
            continue;
          }
          results.push({
            type: 'file',
            pathId: entry.pathId,
            name: entry.name,
            source: 'content',
            matchCount,
            matches,
          });
          seen.set(entry.pathId, results.length - 1);
          if (results.length >= limit) {
            return results;
          }
        }
      }
    }

    return results;
  }

  private async buildIndex(): Promise<SearchIndexData> {
    const nameEntries: NameEntry[] = [];
    const contentEntries: ContentEntry[] = [];
    let fileCount = 0;
    let folderCount = 0;
    let totalBytes = 0;

    const countFiles = async (dirPath: string): Promise<number> => {
      let count = 0;
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        const absolutePath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          count += await countFiles(absolutePath);
        } else if (entry.isFile()) {
          count += 1;
        }
      }
      return count;
    };

    try {
      const totalFiles = await countFiles(this.rootPath);
      this.progress = {
        phase: 'Indexing files',
        processed: 0,
        total: totalFiles,
        unit: 'files',
      };
    } catch (error: any) {
      logger.warn(`Search index count failed: ${error?.message || 'count error'}`);
      this.progress = {
        phase: 'Indexing files',
        processed: 0,
        total: 0,
        unit: 'files',
      };
    }

    const walk = async (dirPath: string, relativePath: string) => {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) {
          continue;
        }
        const absolutePath = path.join(dirPath, entry.name);
        const nextRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          folderCount += 1;
          const pathId = applyPathPrefix(nextRelative);
          nameEntries.push({
            pathId,
            name: entry.name,
            type: 'folder',
            nameLower: entry.name.toLowerCase(),
            pathLower: pathId.toLowerCase(),
          });
          await walk(absolutePath, nextRelative);
        } else if (entry.isFile()) {
          const pathId = applyPathPrefix(nextRelative);
          fileCount += 1;
          nameEntries.push({
            pathId,
            name: entry.name,
            type: 'file',
            nameLower: entry.name.toLowerCase(),
            pathLower: pathId.toLowerCase(),
          });
          this.progress.processed += 1;
          try {
            const stat = await fs.stat(absolutePath);
            totalBytes += stat.size;
            if (stat.size <= MAX_CONTENT_BYTES) {
              const content = await fs.readFile(absolutePath, 'utf-8');
              contentEntries.push({
                pathId,
                name: entry.name,
                content,
                contentLower: content.toLowerCase(),
                sizeBytes: stat.size,
              });
            }
          } catch (error: any) {
            logger.warn(`Skipping file ${absolutePath}: ${error?.message || 'read error'}`);
          }
        }
      }
    };

    await walk(this.rootPath, '');

    return {
      nameEntries,
      contentEntries,
      fileCount,
      folderCount,
      contentFileCount: contentEntries.length,
      totalBytes,
    };
  }
}

const searchIndexService = new SearchIndexService();

export const startSearchIndexing = () => searchIndexService.start();
export const getSearchIndexStatus = () => searchIndexService.getStatus();
export const rebuildSearchIndex = async () => searchIndexService.rebuildIndex('manual');
export const requestSearchIndexRebuild = () => searchIndexService.requestRebuild();
export const searchIndex = () => searchIndexService;

export type { SearchScope, SearchResult, SearchIndexStatus };
