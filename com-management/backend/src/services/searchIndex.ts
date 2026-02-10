import cacheLogger from '../utils/cacheLogger';
import { UAClient } from './ua';
import { getRedisClient } from './redisClient';

const MAX_CONTENT_BYTES = Number(process.env.SEARCH_MAX_CONTENT_BYTES || 5 * 1024 * 1024);
const DEFAULT_PATH_PREFIX = 'id-core/default/processing/event/fcom/_objects';
const PATH_PREFIX = (process.env.COMS_PATH_PREFIX ?? DEFAULT_PATH_PREFIX).replace(/^\/+|\/+$/g, '');
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_TTL_MS = Number(
  process.env.CACHE_TTL_MS || process.env.SEARCH_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS,
);
const SEARCH_PAGE_LIMIT = Number(process.env.SEARCH_PAGE_LIMIT || 500);
const SEARCH_LIST_CONCURRENCY = Math.max(1, Number(process.env.SEARCH_LIST_CONCURRENCY || 12));
const SEARCH_CONTENT_CONCURRENCY = Math.max(
  1,
  Number(process.env.SEARCH_CONTENT_CONCURRENCY || 48),
);
const SEARCH_LIST_RETRIES = Math.max(0, Number(process.env.SEARCH_LIST_RETRIES || 3));
const SEARCH_LIST_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.SEARCH_LIST_RETRY_DELAY_MS || 500),
);
const SEARCH_READ_RETRIES = Math.max(0, Number(process.env.SEARCH_READ_RETRIES || 3));
const SEARCH_READ_RETRY_DELAY_MS = Math.max(
  0,
  Number(process.env.SEARCH_READ_RETRY_DELAY_MS || 500),
);
const SEARCH_CACHE_PREFIX = 'fcom:search:index:';

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

type CacheStats = {
  keyCount: number;
  sizeBytes: number;
  updatedAt: string;
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
  isStale: boolean;
  buildId: number | null;
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
  cacheStats: CacheStats | null;
};

type SearchIndexCachePayload = {
  data: SearchIndexData;
  lastBuiltAt: string | null;
  lastDurationMs: number | null;
  expiresAtMs: number | null;
  cacheStats?: CacheStats | null;
};

const normalizePathId = (value: string) => value.replace(/^\/+/, '');

const getNameFromPath = (value: string) => {
  const cleaned = normalizePathId(value);
  const parts = cleaned.split('/').filter(Boolean);
  return parts[parts.length - 1] || cleaned;
};

const extractRuleText = (data: any) =>
  data?.content?.data?.[0]?.RuleText ?? data?.data?.[0]?.RuleText ?? data?.RuleText ?? data;

const buildCacheKey = (serverId: string) => `${SEARCH_CACHE_PREFIX}${serverId}`;

const parseCachedPayload = (raw: string): SearchIndexCachePayload | null => {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.data) {
      return null;
    }
    return parsed as SearchIndexCachePayload;
  } catch {
    return null;
  }
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelayMs = (baseDelayMs: number, attempt: number) =>
  baseDelayMs > 0 ? baseDelayMs * Math.pow(2, Math.max(0, attempt - 1)) : 0;

const listRulesWithRetry = async (
  uaClient: UAClient,
  node: string,
  start: number,
  context: string,
) => {
  const maxAttempts = SEARCH_LIST_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await uaClient.listRules('/', SEARCH_PAGE_LIMIT, node, false, start);
    } catch (error: any) {
      const message = error?.message || 'unknown error';
      cacheLogger.warn(
        `Search listRules failed (${context}) node=${node} start=${start} ` +
          `attempt=${attempt}/${maxAttempts}: ${message}`,
      );
      if (attempt >= maxAttempts) {
        throw new Error(
          `Search listRules failed (${context}) after ${maxAttempts} attempts: ${message}`,
        );
      }
      const delayMs = getRetryDelayMs(SEARCH_LIST_RETRY_DELAY_MS, attempt);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
  throw new Error(`Search listRules failed (${context}) for node=${node} start=${start}`);
};

const readRuleWithRetry = async (
  uaClient: UAClient,
  pathId: string,
  context: string,
) => {
  const maxAttempts = SEARCH_READ_RETRIES + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await uaClient.readRule(pathId);
    } catch (error: any) {
      const message = error?.message || 'unknown error';
      cacheLogger.warn(
        `Search readRule failed (${context}) path=${pathId} ` +
          `attempt=${attempt}/${maxAttempts}: ${message}`,
      );
      if (attempt >= maxAttempts) {
        throw new Error(
          `Search readRule failed (${context}) after ${maxAttempts} attempts: ${message}`,
        );
      }
      const delayMs = getRetryDelayMs(SEARCH_READ_RETRY_DELAY_MS, attempt);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }
  throw new Error(`Search readRule failed (${context}) for path=${pathId}`);
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
  private serverId: string;
  private index: SearchIndexData | null = null;
  private isBuilding = false;
  private lastBuiltAt: string | null = null;
  private lastDurationMs: number | null = null;
  private nextRefreshAt: string | null = null;
  private expiresAtMs: number | null = null;
  private lastError: string | null = null;
  private buildId: number | null = null;
  private cacheLoaded = false;
  private loadPromise: Promise<void> | null = null;
  private cacheStats: CacheStats | null = null;
  private progress = {
    phase: null as string | null,
    processed: 0,
    total: 0,
    unit: 'files',
  };

  constructor(serverId: string, rootPath?: string) {
    this.serverId = serverId;
    this.rootPath = rootPath || PATH_PREFIX || '';
  }

  start(uaClient: UAClient) {
    if (this.isBuilding) {
      return;
    }
    void this.rebuildIndex(uaClient, 'startup');
  }

  async ensureHydrated() {
    if (this.cacheLoaded) {
      return;
    }
    if (!this.loadPromise) {
      this.loadPromise = this.loadFromCache().finally(() => {
        this.cacheLoaded = true;
      });
    }
    await this.loadPromise;
  }

  getStatus(): SearchIndexStatus {
    void this.ensureHydrated();
    const isStale = this.isStale();
    if (!this.cacheStats && this.index) {
      this.cacheStats = {
        keyCount: 1,
        sizeBytes: Buffer.byteLength(JSON.stringify(this.index), 'utf-8'),
        updatedAt: new Date().toISOString(),
      };
    }
    return {
      rootPath: this.rootPath,
      isReady: !!this.index,
      isBuilding: this.isBuilding,
      isStale,
      buildId: this.buildId,
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
      cacheStats: this.cacheStats,
    };
  }

  isStale() {
    if (!this.index) {
      return false;
    }
    if (!this.expiresAtMs) {
      return true;
    }
    return Date.now() > this.expiresAtMs;
  }

  private async runRebuild(
    uaClient: UAClient,
    trigger: 'startup' | 'manual' | 'auto' | 'update' = 'manual',
  ) {
    this.buildId = (this.buildId ?? 0) + 1;
    this.lastError = null;
    this.progress = {
      phase: 'Starting',
      processed: 0,
      total: 0,
      unit: 'files',
    };
    cacheLogger.info(`Search index rebuild started (${trigger}) server=${this.serverId}`);
    const start = Date.now();
    try {
      const nextIndex = await this.buildIndex(uaClient);
      this.index = nextIndex;
      this.lastBuiltAt = new Date().toISOString();
      this.lastDurationMs = Date.now() - start;
      this.expiresAtMs = Date.now() + CACHE_TTL_MS;
      this.nextRefreshAt = new Date(this.expiresAtMs).toISOString();
      this.progress = {
        phase: 'Completed',
        processed: this.progress.total || this.progress.processed,
        total: this.progress.total || this.progress.processed,
        unit: this.progress.unit,
      };
      await this.persistToCache();
      cacheLogger.info(
        `Search index COMPLETE (${trigger}) server=${this.serverId} took ${this.lastDurationMs}ms`,
      );
    } catch (error: any) {
      this.lastError = error?.message || 'Search index rebuild failed';
      cacheLogger.error(
        `Search index rebuild error server=${this.serverId}: ${this.lastError}`,
      );
    } finally {
      this.isBuilding = false;
    }
  }
  async rebuildIndex(
    uaClient: UAClient,
    trigger: 'startup' | 'manual' | 'auto' | 'update' = 'manual',
  ) {
    if (this.isBuilding) {
      return;
    }
    this.isBuilding = true;
    await this.runRebuild(uaClient, trigger);
  }

  requestRebuild(
    uaClient: UAClient,
    trigger: 'startup' | 'manual' | 'auto' | 'update' = 'manual',
  ) {
    if (this.isBuilding) {
      return;
    }
    this.isBuilding = true;
    void this.runRebuild(uaClient, trigger);
  }

  async updateFileFromContent(pathId: string, content: any) {
    if (!this.index) {
      return;
    }
    const prefixed = normalizePathId(pathId);
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
    this.expiresAtMs = Date.now() + CACHE_TTL_MS;
    this.nextRefreshAt = new Date(this.expiresAtMs).toISOString();
    await this.persistToCache();
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

  private async buildIndex(uaClient: UAClient): Promise<SearchIndexData> {
    if (!PATH_PREFIX) {
      throw new Error('COMS_PATH_PREFIX is not configured');
    }
    const nameEntries: NameEntry[] = [];
    const contentEntries: ContentEntry[] = [];
    let fileCount = 0;
    let folderCount = 0;
    let totalBytes = 0;

    const isFolderEntry = (entry: any) => {
      const name = String(entry?.PathName || entry?.PathID || '').toLowerCase();
      return !name.endsWith('.json');
    };

    const listDirectory = async (node: string) => {
      const all: any[] = [];
      let start = 0;
      while (true) {
        const response = await listRulesWithRetry(uaClient, node, start, 'build-list');
        const data = Array.isArray(response?.data) ? response.data : [];
        if (data.length === 0) {
          break;
        }
        all.push(...data);
        if (data.length < SEARCH_PAGE_LIMIT) {
          break;
        }
        start += data.length;
      }
      return all;
    };

    const countFolders = async () => {
      let total = 0;
      const queue = [PATH_PREFIX];
      const inFlight = new Set<Promise<void>>();

      const handleNode = async (node: string) => {
        const entries = await listDirectory(node);
        for (const entry of entries) {
          if (!isFolderEntry(entry)) {
            continue;
          }
          const entryPath = normalizePathId(String(entry?.PathID || entry?.PathName || ''));
          if (!entryPath) {
            continue;
          }
          total += 1;
          this.progress.processed = total;
          queue.push(entryPath);
        }
      };

      while (queue.length > 0 || inFlight.size > 0) {
        while (queue.length > 0 && inFlight.size < SEARCH_LIST_CONCURRENCY) {
          const node = queue.shift();
          if (!node) {
            continue;
          }
          const task = handleNode(node).finally(() => {
            inFlight.delete(task);
          });
          inFlight.add(task);
        }
        if (inFlight.size > 0) {
          await Promise.race(inFlight);
        }
      }
      return total;
    };

    this.progress = {
      phase: 'Counting folders',
      processed: 0,
      total: 0,
      unit: 'folders',
    };

    const totalFolders = await countFolders();
    const totalNodes = Math.max(1, totalFolders + 1);
    this.progress = {
      phase: 'Listing folders',
      processed: 0,
      total: totalNodes,
      unit: 'folders',
    };

    const fileEntries: Array<{ pathId: string; name: string }> = [];
    const folderQueue: string[] = [PATH_PREFIX];
    const inFlight = new Set<Promise<void>>();

    const handleNode = async (node: string) => {
      const entries = await listDirectory(node);
      for (const entry of entries) {
        const entryPath = normalizePathId(String(entry?.PathID || entry?.PathName || ''));
        if (!entryPath) {
          continue;
        }
        const entryName = getNameFromPath(entryPath);
        if (isFolderEntry(entry)) {
          folderCount += 1;
          nameEntries.push({
            pathId: entryPath,
            name: entryName,
            type: 'folder',
            nameLower: entryName.toLowerCase(),
            pathLower: entryPath.toLowerCase(),
          });
          folderQueue.push(entryPath);
        } else {
          fileCount += 1;
          nameEntries.push({
            pathId: entryPath,
            name: entryName,
            type: 'file',
            nameLower: entryName.toLowerCase(),
            pathLower: entryPath.toLowerCase(),
          });
          fileEntries.push({ pathId: entryPath, name: entryName });
        }
      }
      this.progress.processed += 1;
    };

    while (folderQueue.length > 0 || inFlight.size > 0) {
      while (folderQueue.length > 0 && inFlight.size < SEARCH_LIST_CONCURRENCY) {
        const node = folderQueue.shift();
        if (!node) {
          continue;
        }
        const task = handleNode(node).finally(() => {
          inFlight.delete(task);
        });
        inFlight.add(task);
      }
      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }

    this.progress = {
      phase: 'Indexing content',
      processed: 0,
      total: fileEntries.length,
      unit: 'files',
    };

    const runPool = async (
      items: Array<{ pathId: string; name: string }>,
      concurrency: number,
    ) => {
      let cursor = 0;
      const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (cursor < items.length) {
          const idx = cursor;
          cursor += 1;
          const entry = items[idx];
          try {
            const response = await readRuleWithRetry(uaClient, entry.pathId, 'build-read');
            const raw = extractRuleText(response);
            const text = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {}, null, 2);
            const sizeBytes = Buffer.byteLength(text, 'utf-8');
            totalBytes += sizeBytes;
            if (sizeBytes <= MAX_CONTENT_BYTES) {
              contentEntries.push({
                pathId: entry.pathId,
                name: entry.name,
                content: text,
                contentLower: text.toLowerCase(),
                sizeBytes,
              });
            }
          } finally {
            this.progress.processed += 1;
          }
        }
      });
      await Promise.all(workers);
    };

    await runPool(fileEntries, SEARCH_CONTENT_CONCURRENCY);

    return {
      nameEntries,
      contentEntries,
      fileCount,
      folderCount,
      contentFileCount: contentEntries.length,
      totalBytes,
    };
  }

  private async loadFromCache() {
    if (!this.serverId) {
      return;
    }
    try {
      const client = await getRedisClient();
      const raw = await client.get(buildCacheKey(this.serverId));
      if (!raw) {
        return;
      }
      const parsed = parseCachedPayload(raw);
      if (!parsed) {
        return;
      }
      this.index = parsed.data;
      this.lastBuiltAt = parsed.lastBuiltAt ?? null;
      this.lastDurationMs = parsed.lastDurationMs ?? null;
      this.expiresAtMs = typeof parsed.expiresAtMs === 'number' ? parsed.expiresAtMs : null;
      this.nextRefreshAt = this.expiresAtMs
        ? new Date(this.expiresAtMs).toISOString()
        : null;
      this.cacheStats = parsed.cacheStats ?? null;
      this.lastError = null;
      this.progress = {
        phase: 'Loaded',
        processed: 0,
        total: 0,
        unit: 'files',
      };
    } catch (error: any) {
      cacheLogger.warn(`Search cache load failed: ${error?.message || 'read error'}`);
    }
  }

  private async persistToCache() {
    if (!this.serverId || !this.index) {
      return;
    }
    try {
      const client = await getRedisClient();
      const sizeBytes = Buffer.byteLength(JSON.stringify(this.index), 'utf-8');
      this.cacheStats = {
        keyCount: 1,
        sizeBytes,
        updatedAt: new Date().toISOString(),
      };
      const payload: SearchIndexCachePayload = {
        data: this.index,
        lastBuiltAt: this.lastBuiltAt,
        lastDurationMs: this.lastDurationMs,
        expiresAtMs: this.expiresAtMs,
        cacheStats: this.cacheStats,
      };
      await client.set(buildCacheKey(this.serverId), JSON.stringify(payload));
    } catch (error: any) {
      cacheLogger.warn(`Search cache persist failed: ${error?.message || 'write error'}`);
    }
  }
}

const searchIndexRegistry = new Map<string, SearchIndexService>();

const getSearchIndexService = (serverId: string) => {
  const key = serverId || 'unknown-server';
  const existing = searchIndexRegistry.get(key);
  if (existing) {
    return existing;
  }
  const next = new SearchIndexService(key);
  searchIndexRegistry.set(key, next);
  return next;
};

export const startSearchIndexing = (serverId: string, uaClient: UAClient) =>
  getSearchIndexService(serverId).start(uaClient);
export const getSearchIndexStatus = (serverId: string) =>
  getSearchIndexService(serverId).getStatus();
export const rebuildSearchIndex = async (
  serverId: string,
  uaClient: UAClient,
  trigger: 'startup' | 'manual' | 'auto' | 'update' = 'manual',
) => getSearchIndexService(serverId).rebuildIndex(uaClient, trigger);
export const requestSearchIndexRebuild = (
  serverId: string,
  uaClient: UAClient,
  trigger: 'startup' | 'manual' | 'auto' | 'update' = 'manual',
) => getSearchIndexService(serverId).requestRebuild(uaClient, trigger);
export const searchIndex = (serverId: string) => getSearchIndexService(serverId);

export type { SearchScope, SearchResult, SearchIndexStatus };
