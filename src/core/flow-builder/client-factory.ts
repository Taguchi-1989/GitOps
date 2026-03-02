/**
 * FlowOps - Flow Builder Client Factory
 *
 * 環境変数からフロービルダー各クライアントを生成するファクトリ
 */

import { ConversationFlowBuilder } from './conversation-builder';
import { ImageFlowReader } from './image-reader';
import { FlowExpander } from './flow-expander';

const PROVIDER_DEFAULTS: Record<
  string,
  { baseURL: string; model: string; supportsJsonMode: boolean }
> = {
  openai: { baseURL: 'https://api.openai.com/v1', model: 'gpt-4o', supportsJsonMode: true },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5-20250929',
    supportsJsonMode: false,
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.0-flash',
    supportsJsonMode: true,
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    supportsJsonMode: true,
  },
  ollama: { baseURL: 'http://localhost:11434/v1', model: 'llama3.2', supportsJsonMode: true },
};

function getClientConfig() {
  const provider = process.env.LLM_PROVIDER || 'openai';
  const defaults = PROVIDER_DEFAULTS[provider];

  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('LLM_API_KEY (or OPENAI_API_KEY) is not set');
  }

  return {
    apiKey,
    baseURL: process.env.LLM_BASE_URL || defaults?.baseURL,
    model: process.env.LLM_MODEL || process.env.OPENAI_MODEL || defaults?.model || 'gpt-4o',
    supportsJsonMode:
      process.env.LLM_JSON_MODE !== undefined
        ? process.env.LLM_JSON_MODE === 'true'
        : (defaults?.supportsJsonMode ?? true),
  };
}

export function createConversationBuilder(): ConversationFlowBuilder {
  return new ConversationFlowBuilder(getClientConfig());
}

export function createImageReader(): ImageFlowReader {
  return new ImageFlowReader(getClientConfig());
}

export function createFlowExpander(): FlowExpander {
  return new FlowExpander(getClientConfig());
}
