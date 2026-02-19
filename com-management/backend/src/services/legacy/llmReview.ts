import axios from 'axios';

type LegacyLlmReviewSummary = {
  enabled: boolean;
  tool: string;
  endpoint: string;
  attempted: number;
  scored: number;
  failed: number;
  averageScore: number;
};

const DEFAULT_TOOL = process.env.UA_ASSISTANT_LEGACY_REVIEW_TOOL || 'legacy-rule-conversion';
const DEFAULT_TIMEOUT_MS = Math.max(1000, Number(process.env.UA_ASSISTANT_LEGACY_REVIEW_TIMEOUT_MS || 15000));
const DEFAULT_MAX_ITEMS = Math.max(1, Number(process.env.UA_ASSISTANT_LEGACY_REVIEW_MAX_ITEMS || 500));

const normalizeScore = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  if (numeric > 1 && numeric <= 100) {
    return Math.max(0, Math.min(1, numeric / 100));
  }
  return Math.max(0, Math.min(1, numeric));
};

const extractScoreFromResponse = (payload: any): number | null => {
  const directCandidates = [
    payload?.score,
    payload?.confidenceScore,
    payload?.ratingScore,
    payload?.result?.score,
    payload?.result?.confidenceScore,
    payload?.data?.score,
    payload?.data?.confidenceScore,
    payload?.output?.score,
    payload?.output?.confidenceScore,
  ];
  for (const candidate of directCandidates) {
    const normalized = normalizeScore(candidate);
    if (normalized !== null) {
      return normalized;
    }
  }
  return null;
};

const toConfidenceLevel = (score: number): 'high' | 'medium' | 'low' => {
  if (score >= 0.8) {
    return 'high';
  }
  if (score >= 0.55) {
    return 'medium';
  }
  return 'low';
};

const buildLegacyReviewPrompt = (stub: any, sourceSnippet: string | null) => ({
  task: 'Validate legacy rule conversion proposal against documented standards and source code intent.',
  expectations: {
    scoring: 'Return confidence score between 0 and 1 where higher is better.',
    strictness: 'Penalize undocumented or semantically inconsistent conversions.',
  },
  item: {
    sourceFile: String(stub?.sourceFile || ''),
    ruleFunction: String(stub?.ruleFunction || ''),
    objectName: String(stub?.objectName || ''),
    targetField: String(stub?.targetField || ''),
    expression: String(stub?.expression || ''),
    status: String(stub?.status || ''),
    requiredMappings: Array.isArray(stub?.requiredMappings) ? stub.requiredMappings : [],
    suggestedProcessor: String(stub?.recommendedProcessor || ''),
    suggestedTemplate: stub?.template && typeof stub.template === 'object' ? stub.template : null,
    sourceSnippet,
  },
});

export const applyLegacyLlmReviewScores = async (report: any): Promise<LegacyLlmReviewSummary> => {
  const endpoint = String(process.env.UA_ASSISTANT_LEGACY_REVIEW_ENDPOINT || '').trim();
  if (!endpoint) {
    throw new Error('UA_ASSISTANT_LEGACY_REVIEW_ENDPOINT is required when LLM review is enabled.');
  }

  const tool = DEFAULT_TOOL;
  const timeout = DEFAULT_TIMEOUT_MS;
  const maxItems = DEFAULT_MAX_ITEMS;
  const apiKey = String(process.env.UA_ASSISTANT_API_KEY || '').trim();
  const stubs = Array.isArray(report?.stubs?.processorStubs) ? report.stubs.processorStubs : [];
  const files = Array.isArray(report?.files) ? report.files : [];
  const blockByKey = new Map<string, string>();

  files.forEach((analysis: any) => {
    const filePath = String(analysis?.filePath || '').trim();
    const blocks = Array.isArray(analysis?.functionBlocks) ? analysis.functionBlocks : [];
    blocks.forEach((block: any) => {
      const name = String(block?.name || '').trim();
      if (!filePath || !name) {
        return;
      }
      blockByKey.set(`${filePath}::${name}`, String(block?.text || ''));
    });
  });

  let attempted = 0;
  let scored = 0;
  let failed = 0;
  let totalScore = 0;

  for (const stub of stubs.slice(0, maxItems)) {
    attempted += 1;
    const sourceSnippet =
      blockByKey.get(`${String(stub?.sourceFile || '').trim()}::${String(stub?.ruleFunction || '').trim()}`) || null;
    const body = {
      tool,
      input: buildLegacyReviewPrompt(stub, sourceSnippet),
    };

    try {
      const response = await axios.post(endpoint, body, {
        timeout,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
      });
      const score = extractScoreFromResponse(response?.data);
      if (score === null) {
        failed += 1;
        continue;
      }

      scored += 1;
      totalScore += score;
      const level = toConfidenceLevel(score);
      const priorRationale = String(stub?.confidence?.rationale || '').trim();
      stub.confidence = {
        score,
        level,
        rationale: priorRationale
          ? `${priorRationale} | LLM validation (${tool})`
          : `LLM validation (${tool})`,
        source: 'llm',
      };
    } catch {
      failed += 1;
    }
  }

  const averageScore = scored > 0 ? totalScore / scored : 0;
  const summary: LegacyLlmReviewSummary = {
    enabled: true,
    tool,
    endpoint,
    attempted,
    scored,
    failed,
    averageScore,
  };

  report.llmReview = summary;
  return summary;
};
