import { z } from 'zod';
import { AimsReviewerConfig, AimsReviewerConfigSchema } from './types';

const ReviewerSetSchema = z.array(AimsReviewerConfigSchema).min(1).max(12);

const PROVIDER_DEFAULTS: Record<
  string,
  { model: string; baseURL?: string; supportsJsonMode: boolean; apiKeyEnv?: string }
> = {
  openai: {
    model: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
    supportsJsonMode: true,
    apiKeyEnv: 'OPENAI_API_KEY',
  },
  anthropic: {
    model: 'claude-sonnet-4-6',
    supportsJsonMode: false,
    apiKeyEnv: 'ANTHROPIC_API_KEY',
  },
  gemini: {
    model: 'gemini-3-flash',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    supportsJsonMode: true,
    apiKeyEnv: 'GEMINI_API_KEY',
  },
  groq: {
    model: 'llama-3.3-70b-versatile',
    baseURL: 'https://api.groq.com/openai/v1',
    supportsJsonMode: true,
  },
  ollama: {
    model: 'llama3.2',
    baseURL: 'http://localhost:11434/v1',
    supportsJsonMode: true,
  },
  'dev-mock': { model: 'deterministic-mock', supportsJsonMode: true },
};

export class AimsConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AimsConfigurationError';
  }
}

export function loadAimsReviewerConfigs(
  env: Readonly<Record<string, string | undefined>> = process.env
): AimsReviewerConfig[] {
  const configured = env.AIMS_LLM_REVIEWERS?.trim();
  if (configured) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(configured);
    } catch {
      throw new AimsConfigurationError('AIMS_LLM_REVIEWERS must be valid JSON');
    }
    const result = ReviewerSetSchema.safeParse(parsed);
    if (!result.success) {
      throw new AimsConfigurationError(`Invalid AIMS_LLM_REVIEWERS: ${result.error.message}`);
    }
    ensureUniqueReviewers(result.data);
    return result.data;
  }

  const provider = env.LLM_PROVIDER || 'openai';
  const defaults = PROVIDER_DEFAULTS[provider] ?? {
    model: env.LLM_MODEL || 'gpt-4o',
    supportsJsonMode: env.LLM_JSON_MODE !== 'false',
  };
  const shared = {
    provider,
    model: env.LLM_MODEL || defaults.model,
    ...(env.LLM_BASE_URL || defaults.baseURL
      ? { baseURL: env.LLM_BASE_URL || defaults.baseURL }
      : {}),
    ...(defaults.apiKeyEnv ? { apiKeyEnv: defaults.apiKeyEnv } : {}),
    supportsJsonMode:
      env.LLM_JSON_MODE === undefined ? defaults.supportsJsonMode : env.LLM_JSON_MODE === 'true',
  };

  return [
    { id: 'default-summary', role: 'summarizer', ...shared },
    { id: 'default-audit', role: 'auditor', ...shared },
    { id: 'default-challenge', role: 'challenger', ...shared },
    { id: 'default-synthesis', role: 'synthesizer', ...shared },
  ];
}

function ensureUniqueReviewers(configs: AimsReviewerConfig[]): void {
  const ids = new Set<string>();
  let synthesizers = 0;
  for (const config of configs) {
    if (ids.has(config.id)) {
      throw new AimsConfigurationError(`Duplicate AIMS reviewer id: ${config.id}`);
    }
    ids.add(config.id);
    if (config.role === 'synthesizer') synthesizers += 1;
  }
  if (synthesizers > 1) {
    throw new AimsConfigurationError('At most one AIMS synthesizer may be configured');
  }
  if (configs.every(config => config.role === 'synthesizer')) {
    throw new AimsConfigurationError('At least one independent AIMS reviewer is required');
  }
}

export function selectAimsReviewers(
  configs: AimsReviewerConfig[],
  requestedIds?: string[]
): { reviewers: AimsReviewerConfig[]; synthesizer?: AimsReviewerConfig } {
  const synthesizer = configs.find(config => config.role === 'synthesizer');
  const independent = configs.filter(config => config.role !== 'synthesizer');
  if (!requestedIds) return { reviewers: independent, synthesizer };

  const requested = new Set(requestedIds);
  const unknown = requestedIds.filter(id => !independent.some(config => config.id === id));
  if (unknown.length > 0) {
    throw new AimsConfigurationError(`Unknown or non-reviewer ids: ${unknown.join(', ')}`);
  }
  return { reviewers: independent.filter(config => requested.has(config.id)), synthesizer };
}

export function resolveAimsApiKey(
  config: AimsReviewerConfig,
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  if (config.provider === 'dev-mock') return 'dev-mock';
  if (config.provider === 'ollama') return env[config.apiKeyEnv || 'LLM_API_KEY'] || 'ollama';

  const providerFallback =
    config.provider === 'anthropic'
      ? env.ANTHROPIC_API_KEY
      : config.provider === 'openai'
        ? env.OPENAI_API_KEY
        : config.provider === 'gemini'
          ? env.GEMINI_API_KEY
          : undefined;
  const key =
    (config.apiKeyEnv ? env[config.apiKeyEnv] : undefined) || env.LLM_API_KEY || providerFallback;
  if (!key) {
    throw new AimsConfigurationError(
      `No API key for AIMS reviewer ${config.id}; set ${config.apiKeyEnv || 'LLM_API_KEY'}`
    );
  }
  return key;
}
