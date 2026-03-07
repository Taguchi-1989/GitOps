/**
 * FlowOps - Flow Export/Import Component
 *
 * YAMLエクスポート・LLMプロンプトコピー・インポート機能
 */

'use client';

import React, { useState, useRef } from 'react';
import { Flow } from '@/core/parser';
import { Copy, Check, Upload, FileDown, Wand2, AlertCircle, CheckCircle } from 'lucide-react';

interface FlowExportImportProps {
  flow: Flow;
  yamlContent: string;
  onImportSuccess?: () => void;
}

type CopyStatus = 'idle' | 'yaml-copied' | 'prompt-copied';

interface ValidationResult {
  valid: boolean;
  errors: Array<{ code: string; message: string; path?: string }>;
}

function buildLlmEditPrompt(yamlContent: string): string {
  return `あなたはFlowOpsのYAMLフロー定義の編集アシスタントです。
以下のYAMLスキーマ仕様に従って、ユーザーの指示通りにフロー定義を修正してください。

## YAMLフロー定義スキーマ

フロー定義は以下の構造に厳密に従うこと:

\`\`\`yaml
id: <flow_id>            # フローID（snake_case、英数字とハイフン）
title: <タイトル>         # フロータイトル（日本語可）
layer: <L0|L1|L2>        # レイヤー
updatedAt: "<ISO8601>"   # 更新日時（ISO 8601形式）

nodes:
  <node_id>:             # ノードID（snake_case）
    id: <node_id>        # キーと同一値
    type: <NodeType>     # start | end | process | decision | database | llm-task | human-review
    label: <ラベル>       # 表示名（日本語可）
    role: <role名>        # 任意
    system: <system名>    # 任意
    taskId: <task_id>     # 任意。llm-task用のタスク参照
    meta:
      description: <説明>

edges:
  e1:                     # エッジID（e1, e2, e3 ... の連番）
    id: e1                # キーと同一値
    from: <node_id>       # 接続元ノードID
    to: <node_id>         # 接続先ノードID
    label: <ラベル>        # 任意。分岐条件の表示名
    condition: <条件式>    # 任意。分岐条件
\`\`\`

## ノードタイプの意味
- start: フロー開始点（必ず1つ以上）
- end: フロー終了点（必ず1つ以上）
- process: 業務処理ステップ
- decision: 分岐判断（複数の出力エッジを持つ）
- database: データベース操作
- llm-task: LLMによるタスク実行（taskIdが必要）
- human-review: 人間による確認・承認

## 制約事項
1. ノードIDはsnake_caseを使用
2. エッジIDはe1, e2, e3...の連番
3. startノードとendノードは必ず含める
4. ノードのidフィールドとキーは同一値
5. edgeのfrom/toは存在するノードIDを参照
6. decisionノードからは2つ以上の出力エッジ
7. updatedAtは現在日時に更新

## 現在のフロー定義

\`\`\`yaml
${yamlContent}
\`\`\`

## 修正指示

（ここにあなたの修正指示を記入してください）
例:
- 「承認ステップの後にAIレビューノードを追加してください」
- 「ノードXのラベルを○○に変更してください」
- 「△△と□□の間に新しい分岐を追加してください」

## 出力形式
修正後の完全なYAMLフロー定義のみを出力してください。
\`\`\`yaml と \`\`\` で囲んでYAMLのみ出力してください。
説明文は不要です。`;
}

export function FlowExportImport({ flow, yamlContent, onImportSuccess }: FlowExportImportProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle');
  const [importYaml, setImportYaml] = useState('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const copyToClipboard = async (text: string, status: CopyStatus) => {
    await navigator.clipboard.writeText(text);
    setCopyStatus(status);
    setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      setImportYaml(event.target?.result as string);
      setValidationResult(null);
      setSaveMessage(null);
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleValidate = async () => {
    if (!importYaml.trim()) return;
    setIsValidating(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/flows/import?validate=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml: importYaml }),
      });
      const json = await res.json();
      if (json.ok) {
        setValidationResult(json.data);
      } else {
        setValidationResult({
          valid: false,
          errors: [{ code: 'API_ERROR', message: json.details || 'Validation request failed' }],
        });
      }
    } catch (err) {
      setValidationResult({
        valid: false,
        errors: [{ code: 'NETWORK_ERROR', message: 'ネットワークエラーが発生しました' }],
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!importYaml.trim() || !validationResult?.valid) return;
    const confirmed = window.confirm(
      `フロー "${flow.id}" を上書きインポートします。よろしいですか？`
    );
    if (!confirmed) return;

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/flows/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yaml: importYaml,
          flowId: flow.id,
          overwrite: true,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaveMessage({
          type: 'success',
          text: 'インポートが完了しました。ページを再読み込みして反映します。',
        });
        onImportSuccess?.();
      } else {
        setSaveMessage({ type: 'error', text: json.details || 'インポートに失敗しました' });
      }
    } catch (err) {
      setSaveMessage({ type: 'error', text: 'ネットワークエラーが発生しました' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Section 1: YAML Export */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <FileDown className="w-5 h-5" />
          YAMLエクスポート
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          現在のフロー定義をYAML形式でコピーできます。
        </p>
        <div className="relative">
          <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto max-h-80 overflow-y-auto">
            {yamlContent}
          </pre>
          <button
            type="button"
            onClick={() => copyToClipboard(yamlContent, 'yaml-copied')}
            className="absolute top-2 right-2 flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-xs rounded-md transition-colors"
          >
            {copyStatus === 'yaml-copied' ? (
              <>
                <Check className="w-3.5 h-3.5" />
                コピーしました
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                YAMLをコピー
              </>
            )}
          </button>
        </div>
      </section>

      {/* Section 2: LLM Prompt Template */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          LLMで編集する
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          下のボタンでプロンプトをコピーし、ChatGPTやClaudeに貼り付けてください。
          修正指示を追記すると、LLMが修正済みYAMLを出力します。
          結果を下の「インポート」欄に貼り付けて保存できます。
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
              プロンプトテンプレート（スキーマ仕様 + 現在のYAML + 修正指示欄）
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(buildLlmEditPrompt(yamlContent), 'prompt-copied')}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
            >
              {copyStatus === 'prompt-copied' ? (
                <>
                  <Check className="w-4 h-4" />
                  コピーしました!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  プロンプトをコピー
                </>
              )}
            </button>
          </div>
          <details className="text-xs text-blue-700 dark:text-blue-300">
            <summary className="cursor-pointer hover:underline">プロンプト内容をプレビュー</summary>
            <pre className="mt-2 p-3 bg-white dark:bg-gray-900 rounded text-gray-700 dark:text-gray-300 overflow-x-auto max-h-60 overflow-y-auto whitespace-pre-wrap">
              {buildLlmEditPrompt(yamlContent)}
            </pre>
          </details>
        </div>
        <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          <p className="font-medium mb-1">使い方:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>上の「プロンプトをコピー」をクリック</li>
            <li>ChatGPT / Claude / Gemini にペースト</li>
            <li>「修正指示」欄に変更内容を記入して送信（音声入力もOK）</li>
            <li>LLMが出力したYAMLを下の「インポート」欄にペースト</li>
          </ol>
        </div>
      </section>

      {/* Section 3: YAML Import */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
          <Upload className="w-5 h-5" />
          YAMLインポート
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          修正済みのYAMLを貼り付けるか、ファイルをアップロードしてください。
        </p>

        <div className="space-y-3">
          <textarea
            value={importYaml}
            onChange={e => {
              setImportYaml(e.target.value);
              setValidationResult(null);
              setSaveMessage(null);
            }}
            placeholder="修正済みのYAMLをここに貼り付けてください..."
            rows={12}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm font-mono resize-y focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              ファイルを選択
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={!importYaml.trim() || isValidating}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white text-sm rounded-md transition-colors"
            >
              {isValidating ? '検証中...' : '検証'}
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!validationResult?.valid || isSaving}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm rounded-md transition-colors"
            >
              {isSaving ? '保存中...' : 'インポートして保存'}
            </button>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div
              className={`p-3 rounded-lg text-sm ${
                validationResult.valid
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {validationResult.valid ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">バリデーション成功</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">バリデーションエラー</span>
                  </>
                )}
              </div>
              {validationResult.errors.length > 0 && (
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {validationResult.errors.map((err, i) => (
                    <li key={i}>
                      {err.path && <code className="text-xs">[{err.path}]</code>} {err.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Save Message */}
          {saveMessage && (
            <div
              className={`p-3 rounded-lg text-sm ${
                saveMessage.type === 'success'
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
              }`}
            >
              {saveMessage.text}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
