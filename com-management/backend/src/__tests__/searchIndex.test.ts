export {};

let mockValue: string | null = null;

jest.mock('../services/redisClient', () => ({
  getRedisClient: async () => ({
    get: async () => mockValue,
    set: async () => {},
  }),
}));

describe('search index stale detection', () => {
  beforeEach(() => {
    mockValue = null;
    jest.resetModules();
  });

  const buildPayload = (expiresAtMs: number | null) =>
    JSON.stringify({
      data: {
        nameEntries: [],
        contentEntries: [],
        fileCount: 0,
        folderCount: 0,
        contentFileCount: 0,
        totalBytes: 0,
      },
      lastBuiltAt: new Date().toISOString(),
      lastDurationMs: 123,
      expiresAtMs,
    });

  it('marks cache stale when expiresAtMs is in the past', async () => {
    mockValue = buildPayload(Date.now() - 1000);
    const { searchIndex, getSearchIndexStatus } = await import('../services/searchIndex');
    await searchIndex('server-1').ensureHydrated();
    const status = getSearchIndexStatus('server-1');
    expect(status.isStale).toBe(true);
  });

  it('marks cache stale when expiresAtMs is missing', async () => {
    const raw = JSON.parse(buildPayload(Date.now() + 1000));
    delete raw.expiresAtMs;
    mockValue = JSON.stringify(raw);
    const { searchIndex, getSearchIndexStatus } = await import('../services/searchIndex');
    await searchIndex('server-2').ensureHydrated();
    const status = getSearchIndexStatus('server-2');
    expect(status.isStale).toBe(true);
  });

  it('marks cache fresh when expiresAtMs is in the future', async () => {
    mockValue = buildPayload(Date.now() + 60_000);
    const { searchIndex, getSearchIndexStatus } = await import('../services/searchIndex');
    await searchIndex('server-3').ensureHydrated();
    const status = getSearchIndexStatus('server-3');
    expect(status.isStale).toBe(false);
  });
});
