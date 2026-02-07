export {};

let mockValue: string | null = null;

jest.mock('../services/redisClient', () => ({
  getRedisClient: async () => ({
    get: async () => mockValue,
    set: async () => {},
  }),
}));

describe('overview index stale detection', () => {
  beforeEach(() => {
    mockValue = null;
    jest.resetModules();
  });

  const buildPayload = (expiresAtMs: number | null) =>
    JSON.stringify({
      data: {
        totals: {
          files: 0,
          overrides: 0,
          objects: 0,
          variables: 0,
          evalObjects: 0,
          processorObjects: 0,
          literalObjects: 0,
        },
        protocols: [],
      },
      lastBuiltAt: new Date().toISOString(),
      lastDurationMs: 321,
      expiresAtMs,
    });

  it('marks cache stale when expiresAtMs is in the past', async () => {
    mockValue = buildPayload(Date.now() - 1000);
    const { overviewIndex, getOverviewStatus } = await import('../services/overviewIndex');
    await overviewIndex().ensureHydrated('server-1');
    const status = getOverviewStatus('server-1');
    expect(status.isStale).toBe(true);
  });

  it('marks cache stale when expiresAtMs is missing', async () => {
    const raw = JSON.parse(buildPayload(Date.now() + 1000));
    delete raw.expiresAtMs;
    mockValue = JSON.stringify(raw);
    const { overviewIndex, getOverviewStatus } = await import('../services/overviewIndex');
    await overviewIndex().ensureHydrated('server-2');
    const status = getOverviewStatus('server-2');
    expect(status.isStale).toBe(true);
  });

  it('marks cache fresh when expiresAtMs is in the future', async () => {
    mockValue = buildPayload(Date.now() + 60_000);
    const { overviewIndex, getOverviewStatus } = await import('../services/overviewIndex');
    await overviewIndex().ensureHydrated('server-3');
    const status = getOverviewStatus('server-3');
    expect(status.isStale).toBe(false);
  });
});
