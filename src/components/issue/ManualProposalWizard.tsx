/**
 * FlowOps - コピペで改善案を作るウィザード
 *
 * APIキー設定なしで、ユーザーが普段使っているAI（Copilot / ChatGPT / 社内AIなど）に
 * プロンプトを貼り付け、回答を貼り戻すだけで改善案を取り込める3ステップUI。
 * 認知負荷を下げるため、常に「いまやること」1つだけを大きく表示する。
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Check,
  ClipboardPaste,
  Sparkles,
  Loader2,
  ArrowRight,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

interface ManualProposalWizardProps {
  issueId: string;
  onImported?: () => void;
}

type Step = 1 | 2 | 3;

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // クリップボードAPIが使えない環境（http等）向けフォールバック
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function StepHeader({
  number,
  title,
  state,
}: {
  number: number;
  title: string;
  state: 'done' | 'active' | 'todo';
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
          state === 'done'
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            : state === 'active'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
        }`}
      >
        {state === 'done' ? <Check className="w-4 h-4" /> : number}
      </span>
      <span
        className={`text-sm font-semibold ${
          state === 'active'
            ? 'text-gray-900 dark:text-gray-100'
            : 'text-gray-500 dark:text-gray-400'
        }`}
      >
        {title}
      </span>
    </div>
  );
}

export function ManualProposalWizard({ issueId, onImported }: ManualProposalWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [promptLoading, setPromptLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCopied, setErrorCopied] = useState(false);

  const handleCopyPrompt = async () => {
    setPromptLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/proposals/prompt`);
      const data = await res.json();
      if (!data.ok || !data.data?.prompt) {
        setError(data.details ?? 'プロンプトの作成に失敗しました');
        return;
      }
      const ok = await copyToClipboard(data.data.prompt);
      if (!ok) {
        setError('クリップボードへのコピーに失敗しました');
        return;
      }
      setCopied(true);
      setStep(2);
    } catch {
      setError('プロンプトの取得に失敗しました。通信環境を確認してください');
    } finally {
      setPromptLoading(false);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${issueId}/proposals/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.details ?? '取り込みに失敗しました');
        return;
      }
      onImported?.();
      router.refresh();
    } catch {
      setError('取り込みに失敗しました。通信環境を確認してください');
    } finally {
      setImporting(false);
    }
  };

  const handleCopyError = async () => {
    if (!error) return;
    const ok = await copyToClipboard(
      `さきほどの回答にエラーがありました。エラー内容を修正して、指定したJSON形式だけで出力し直してください。\n\nエラー: ${error}`
    );
    if (ok) {
      setErrorCopied(true);
      setTimeout(() => setErrorCopied(false), 3000);
    }
  };

  const stepState = (n: Step): 'done' | 'active' | 'todo' =>
    step > n ? 'done' : step === n ? 'active' : 'todo';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden text-left">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ClipboardPaste className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          コピペで改善案を作る
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          お使いのAI（Copilot・ChatGPT・社内AIなど何でもOK）にコピペするだけ。設定は不要です
        </p>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {/* Step 1: プロンプトをコピー */}
        <div className="px-5 py-4">
          <StepHeader number={1} title="プロンプトをコピーする" state={stepState(1)} />
          {step === 1 && (
            <div className="mt-3 ml-10">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                課題の内容・業務フロー・AIへの指示をまとめた文章を自動で作ります
              </p>
              <button
                onClick={handleCopyPrompt}
                disabled={promptLoading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {promptLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                プロンプトをコピー
              </button>
            </div>
          )}
          {step > 1 && copied && (
            <p className="mt-1 ml-10 text-xs text-green-600 dark:text-green-400">
              コピーしました
              <button
                onClick={handleCopyPrompt}
                className="ml-2 text-blue-600 hover:text-blue-700 underline"
              >
                もう一度コピー
              </button>
            </p>
          )}
        </div>

        {/* Step 2: AIに貼り付け */}
        <div className="px-5 py-4">
          <StepHeader number={2} title="お使いのAIに貼り付けて送信する" state={stepState(2)} />
          {step === 2 && (
            <div className="mt-3 ml-10">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Copilot・ChatGPT・Gemini・社内AIなど、いつも使っているAIチャットを開いて、
                コピーした文章を貼り付けて送信してください
              </p>
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                送信した、AIの回答が出た
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Step 3: 回答を貼り戻す */}
        <div className="px-5 py-4">
          <StepHeader number={3} title="AIの回答をここに貼り付ける" state={stepState(3)} />
          {step === 3 && (
            <div className="mt-3 ml-10 space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AIの回答を<strong>すべて選択してコピー</strong>し、下の枠に貼り付けてください。
                前後に説明文が混ざっていても大丈夫です
              </p>
              <textarea
                rows={6}
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={'ここにAIの回答を貼り付け\n例: { "intent": "...", "patches": [...] }'}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-red-700 dark:text-red-300 break-words">{error}</p>
                      <p className="text-xs text-red-500 dark:text-red-400 mt-2">
                        下のボタンでエラー文をコピーし、AIに貼り付けると直してくれます
                      </p>
                      <button
                        onClick={handleCopyError}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      >
                        {errorCopied ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        {errorCopied ? 'コピーしました' : 'エラー文をコピーしてAIに直してもらう'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={importing || !pasteText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
              >
                {importing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                改善案として取り込む
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
