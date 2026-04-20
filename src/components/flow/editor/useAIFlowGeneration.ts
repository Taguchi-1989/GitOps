'use client';

import { useState, useCallback } from 'react';
import type { Flow } from '@/core/parser/schema';
import { parseFlowYaml } from '@/core/parser';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface GenerationResult {
  yaml: string;
  mermaid: string;
  questions: string[];
  summary: string;
  validationErrors: string[];
  isValid: boolean;
  flow?: Flow;
}

export function useAIFlowGeneration() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastResult, setLastResult] = useState<GenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (
      prompt: string,
      currentYaml?: string,
      flowId?: string,
      imageBase64?: string
    ): Promise<GenerationResult | null> => {
      setIsGenerating(true);
      setError(null);

      const userMessage: ChatMessage = { role: 'user', content: prompt };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);

      try {
        let response: Response;

        if (imageBase64) {
          // 画像ベース: /api/flows/from-image
          response = await fetch('/api/flows/from-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64,
              imageDescription: prompt,
              currentYaml,
              flowId,
            }),
          });
        } else {
          // テキストベース: /api/flows/draft
          response = await fetch('/api/flows/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: nextMessages,
              currentYaml,
              flowId,
            }),
          });
        }

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(errorData.error ?? `サーバーエラー: ${response.status}`);
        }

        const json = (await response.json()) as {
          ok: boolean;
          data: Omit<GenerationResult, 'flow'> & {
            confidence?: number;
            notes?: string[];
            ambiguities?: string[];
          };
          error?: string;
        };

        if (!json.ok) {
          throw new Error(json.error ?? 'フロー生成に失敗しました');
        }

        const data = json.data;

        // Parse YAML into Flow object
        let flow: Flow | undefined;
        if (data.yaml) {
          const parsed = parseFlowYaml(data.yaml);
          if (parsed.success && parsed.flow) {
            flow = parsed.flow;
          }
        }

        const result: GenerationResult = { ...data, flow };

        setLastResult(result);

        const assistantContent = [
          data.summary,
          ...(data.confidence !== undefined
            ? [`\n信頼度: ${Math.round(data.confidence * 100)}%`]
            : []),
          ...(data.notes && data.notes.length > 0
            ? [`\n読取メモ:\n${data.notes.map(n => `- ${n}`).join('\n')}`]
            : []),
          ...(data.ambiguities && data.ambiguities.length > 0
            ? [`\n不明点:\n${data.ambiguities.map(a => `- ${a}`).join('\n')}`]
            : []),
          ...((data.questions ?? []).length > 0
            ? [`\n追加質問:\n${data.questions.map(q => `- ${q}`).join('\n')}`]
            : []),
          ...(data.validationErrors.length > 0
            ? [`\n検証エラー:\n${data.validationErrors.map(e => `- ${e}`).join('\n')}`]
            : []),
        ]
          .filter(Boolean)
          .join('');

        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: assistantContent || 'フローを生成しました。' },
        ]);

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'フロー生成中にエラーが発生しました';
        setError(message);
        setMessages(prev => [...prev, { role: 'assistant', content: `エラー: ${message}` }]);
        return null;
      } finally {
        setIsGenerating(false);
      }
    },
    [messages]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setLastResult(null);
    setError(null);
  }, []);

  return {
    messages,
    isGenerating,
    lastResult,
    error,
    generate,
    reset,
  };
}
