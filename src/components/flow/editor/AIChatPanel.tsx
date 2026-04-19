'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, Sparkles, Loader2, ChevronDown } from 'lucide-react';
import type { Flow } from '@/core/parser/schema';
import { stringifyFlow } from '@/core/parser';
import { useAIFlowGeneration } from './useAIFlowGeneration';
import { DiffPreview } from './DiffPreview';

interface AIChatPanelProps {
  currentFlow: Flow;
  onApplyFlow: (flow: Flow) => void;
  className?: string;
}

const SUGGESTED_PROMPTS = [
  '承認ステップを追加してください',
  'エラーハンドリングフローを追加してください',
  'このフローをL2レベルに詳細化してください',
  '並列処理のブランチを追加してください',
];

export function AIChatPanel({ currentFlow, onApplyFlow, className = '' }: AIChatPanelProps) {
  const [input, setInput] = useState('');
  const [showDiff, setShowDiff] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, isGenerating, lastResult, error, generate, reset } = useAIFlowGeneration();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show diff preview when new result arrives
  useEffect(() => {
    if (lastResult?.flow) {
      setShowDiff(true);
    }
  }, [lastResult]);

  const handleSend = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt || isGenerating) return;

    setInput('');
    setShowDiff(false);

    let currentYaml: string | undefined;
    try {
      currentYaml = stringifyFlow(currentFlow);
    } catch {
      // If stringify fails, continue without currentYaml
    }

    await generate(prompt, currentYaml, currentFlow.id);
  }, [input, isGenerating, currentFlow, generate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const handleApply = useCallback(() => {
    if (lastResult?.flow) {
      onApplyFlow(lastResult.flow);
      setShowDiff(false);
    }
  }, [lastResult, onApplyFlow]);

  const handleReject = useCallback(() => {
    setShowDiff(false);
  }, []);

  const handleSuggest = useCallback((prompt: string) => {
    setInput(prompt);
    textareaRef.current?.focus();
  }, []);

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AIアシスタント</h3>
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="会話をリセット"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            リセット
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
              フローの変更や追加をAIに依頼できます
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">例:</p>
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSuggest(prompt)}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-purple-300 dark:hover:border-purple-600 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-purple-600 text-white rounded-br-none'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-bl-none'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg rounded-bl-none">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
            </div>
          </div>
        )}

        {error && !isGenerating && (
          <div className="text-xs text-red-600 dark:text-red-400 px-2 py-1 bg-red-50 dark:bg-red-900/20 rounded-md">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Diff Preview (collapsible) */}
      {lastResult?.flow && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setShowDiff(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <span>変更プレビュー</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showDiff ? 'rotate-180' : ''}`}
            />
          </button>
          {showDiff && (
            <div className="h-64 border-t border-gray-100 dark:border-gray-700">
              <DiffPreview
                currentFlow={currentFlow}
                proposedFlow={lastResult.flow}
                onApply={handleApply}
                onReject={handleReject}
              />
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="フローの変更を指示してください..."
            rows={2}
            disabled={isGenerating}
            className="flex-1 resize-none text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isGenerating}
            className="flex-shrink-0 p-2.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="送信 (Enter)"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
          Enter で送信 / Shift+Enter で改行
        </p>
      </div>
    </div>
  );
}
