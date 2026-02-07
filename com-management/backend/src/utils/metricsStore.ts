type MetricType = 'counter' | 'gauge';

type MetricRecord = {
  type: MetricType;
  value: number;
};

const metrics = new Map<string, MetricRecord>();

const normalizeName = (name: string) => name.replace(/[^a-zA-Z0-9_:]/g, '_');

const getKey = (name: string) => normalizeName(name);

export const incCounter = (name: string, delta: number = 1) => {
  const key = getKey(name);
  const existing = metrics.get(key);
  if (!existing) {
    metrics.set(key, { type: 'counter', value: delta });
    return;
  }
  existing.value += delta;
};

export const setGauge = (name: string, value: number) => {
  const key = getKey(name);
  const existing = metrics.get(key);
  if (!existing) {
    metrics.set(key, { type: 'gauge', value });
    return;
  }
  existing.value = value;
};

export const renderMetrics = (): string => {
  const lines: string[] = [];
  metrics.forEach((record, key) => {
    const typeLine = `# TYPE ${key} ${record.type}`;
    lines.push(typeLine);
    lines.push(`${key} ${record.value}`);
  });
  return `${lines.join('\n')}\n`;
};

export const resetMetricsForTests = () => {
  metrics.clear();
};
