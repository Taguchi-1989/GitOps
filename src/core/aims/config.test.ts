import { describe, expect, it } from 'vitest';
import {
  AimsConfigurationError,
  loadAimsReviewerConfigs,
  resolveAimsApiKey,
  selectAimsReviewers,
} from './config';

describe('loadAimsReviewerConfigs', () => {
  it('creates three perspectives and a synthesizer by default', () => {
    const configs = loadAimsReviewerConfigs({ LLM_PROVIDER: 'dev-mock' });
    expect(configs.map(config => config.role)).toEqual([
      'summarizer',
      'auditor',
      'challenger',
      'synthesizer',
    ]);
  });

  it('loads distinct providers from JSON without secrets', () => {
    const configs = loadAimsReviewerConfigs({
      AIMS_LLM_REVIEWERS: JSON.stringify([
        { id: 'a', role: 'auditor', provider: 'openai', model: 'model-a' },
        { id: 's', role: 'synthesizer', provider: 'anthropic', model: 'model-s' },
      ]),
    });
    expect(configs[1]).toMatchObject({ id: 's', provider: 'anthropic' });
  });

  it('rejects duplicate ids', () => {
    const value = JSON.stringify([
      { id: 'same', role: 'auditor', provider: 'dev-mock', model: 'a' },
      { id: 'same', role: 'challenger', provider: 'dev-mock', model: 'b' },
    ]);
    expect(() => loadAimsReviewerConfigs({ AIMS_LLM_REVIEWERS: value })).toThrow(
      AimsConfigurationError
    );
  });

  it('rejects a reviewer set containing only a synthesizer', () => {
    const value = JSON.stringify([
      { id: 's', role: 'synthesizer', provider: 'dev-mock', model: 's' },
    ]);
    expect(() => loadAimsReviewerConfigs({ AIMS_LLM_REVIEWERS: value })).toThrow(
      'At least one independent'
    );
  });
});

describe('reviewer selection and keys', () => {
  const configs = loadAimsReviewerConfigs({ LLM_PROVIDER: 'dev-mock' });

  it('selects independent reviewers while retaining the synthesizer', () => {
    const selection = selectAimsReviewers(configs, ['default-audit']);
    expect(selection.reviewers.map(config => config.id)).toEqual(['default-audit']);
    expect(selection.synthesizer?.id).toBe('default-synthesis');
  });

  it('rejects unknown reviewer ids', () => {
    expect(() => selectAimsReviewers(configs, ['missing'])).toThrow('Unknown');
  });

  it('resolves a key only from environment variables', () => {
    expect(
      resolveAimsApiKey(
        { id: 'a', role: 'auditor', provider: 'custom', model: 'm', apiKeyEnv: 'CUSTOM_KEY' },
        { CUSTOM_KEY: 'value' }
      )
    ).toBe('value');
  });
});
