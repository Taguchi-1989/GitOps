'use client';

import { ChangeEvent, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Braces,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  FileUp,
  GitBranch,
  Loader2,
  PencilLine,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { MermaidViewer } from '@/components/flow';
import { useToast } from '@/components/ui/Toast';
import type { BpmnDocument, BpmnValidationResult } from '@/core/bpmn/types';

type InputFormat = 'mermaid' | 'json' | 'bpmn-xml';
type ExportFormat = InputFormat | 'llm-prompt';
type OutputTab = 'diagram' | 'json' | 'prompt';

interface ConversionResult {
  document: BpmnDocument;
  json: string;
  mermaid: string;
  llmPrompt: string;
  validation: BpmnValidationResult;
  warnings: string[];
}

const SAMPLE_MERMAID = `flowchart LR
  request(("申請受付")):::bpmnStart
  review["申請内容を確認"]:::user
  approved{"承認?"}:::exclusive
  execute["処理を実行"]:::service
  complete(("完了")):::bpmnEnd

  request --> review
  review --> approved
  approved -->|"承認"| execute
  approved -->|"差戻し"| review
  execute --> complete

  %% bpmn:definitions id="Definitions_Request" namespace="urn:flowops:bpmn:request"
  %% bpmn:process id="Process_Request" name="申請承認プロセス" executable="false"
  %% bpmn:node id="request" process="Process_Request" type="startEvent" name="申請受付"
  %% bpmn:node id="review" process="Process_Request" type="userTask" name="申請内容を確認"
  %% bpmn:node id="approved" process="Process_Request" type="exclusiveGateway" name="承認?"
  %% bpmn:node id="execute" process="Process_Request" type="serviceTask" name="処理を実行"
  %% bpmn:node id="complete" process="Process_Request" type="endEvent" name="完了"`;

const INPUT_FORMATS: InputFormat[] = ['mermaid', 'json', 'bpmn-xml'];
const EXPORT_FORMATS: ExportFormat[] = ['json', 'mermaid', 'bpmn-xml', 'llm-prompt'];

const FORMAT_LABELS: Record<ExportFormat, string> = {
  mermaid: 'Mermaid',
  json: '正規化JSON',
  'bpmn-xml': 'BPMN 2.0 XML',
  'llm-prompt': 'LLM用プロンプト',
};

export function BpmnWorkbenchClient() {
  const { addToast } = useToast();
  const [format, setFormat] = useState<InputFormat>('mermaid');
  const [content, setContent] = useState(SAMPLE_MERMAID);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [outputTab, setOutputTab] = useState<OutputTab>('diagram');
  const [converting, setConverting] = useState(false);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);

  async function convert() {
    setConverting(true);
    try {
      const response = await fetch('/api/bpmn/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, content }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.details || '変換に失敗しました');
      setResult(payload.data as ConversionResult);
      addToast('success', `${FORMAT_LABELS[format]}をBPMN JSON正本へ変換しました`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '変換に失敗しました');
    } finally {
      setConverting(false);
    }
  }

  async function download(targetFormat: ExportFormat) {
    if (!result) return;
    setExporting(targetFormat);
    try {
      const response = await fetch('/api/bpmn/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format: targetFormat, document: result.document }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.details || '出力に失敗しました');
      const blob = new Blob([payload.data.content], { type: payload.data.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.data.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
      addToast('success', `${FORMAT_LABELS[targetFormat]}を出力しました`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '出力に失敗しました');
    } finally {
      setExporting(null);
    }
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5_000_000) {
      addToast('error', '5 MB以下のファイルを選択してください');
      return;
    }
    const text = await file.text();
    const extension = file.name.split('.').pop()?.toLowerCase();
    const nextFormat: InputFormat =
      extension === 'bpmn' || extension === 'xml'
        ? 'bpmn-xml'
        : extension === 'json'
          ? 'json'
          : 'mermaid';
    setFormat(nextFormat);
    setContent(text);
    addToast('success', `${file.name}を読み込みました`);
  }

  function editOutput(nextFormat: 'mermaid' | 'json') {
    if (!result) return;
    setFormat(nextFormat);
    setContent(nextFormat === 'mermaid' ? result.mermaid : result.json);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function copyPrompt() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.llmPrompt);
      addToast('success', '他のLLMへ貼り付けるプロンプトをコピーしました');
    } catch {
      addToast('error', 'コピーできませんでした。プロンプトを選択してコピーしてください');
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="h-7 w-7 text-violet-600 dark:text-violet-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              BPMN交換ワークベンチ
            </h1>
          </div>
          <p className="mt-2 max-w-4xl text-sm text-gray-600 dark:text-gray-400">
            業務プロセスをJSONで正規化し、Mermaidをレビュー用ビュー、BPMN 2.0
            XMLを標準交換形式として相互変換します。必要に応じて、他のLLMで見やすいスイムレーン図を作るための貼り付け用プロンプトも生成します。
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          <FileUp className="h-4 w-4" />
          ファイルを読み込む
          <input
            type="file"
            accept=".bpmn,.xml,.json,.mmd,.mermaid,.txt"
            className="sr-only"
            onChange={loadFile}
          />
        </label>
      </header>

      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
        OMG BPMN
        2.0.2のコア交換に対応します。Mermaidはタスク、イベント、ゲートウェイ、制御フローを素早く編集するための概念ビューです。実行エンジン固有の拡張はBPMN
        XML取込時に警告します。
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="入力形式">
            {INPUT_FORMATS.map(item => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={format === item}
                onClick={() => setFormat(item)}
                className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  format === item
                    ? 'bg-violet-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {FORMAT_LABELS[item]}
              </button>
            ))}
          </div>
          <label className="space-y-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {FORMAT_LABELS[format]}入力
            </span>
            <textarea
              value={content}
              onChange={event => setContent(event.target.value)}
              spellCheck={false}
              className="min-h-[340px] w-full rounded-lg border border-gray-300 bg-gray-950 p-4 font-mono text-xs leading-5 text-gray-100 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 dark:border-gray-600"
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              最大5 MB。DTD・外部実体は受け付けません。
            </p>
            <button
              type="button"
              onClick={convert}
              disabled={converting || !content.trim()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {converting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
              JSON正本へ変換・検証
            </button>
          </div>
        </div>
      </section>

      {result && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="プロセス" value={result.validation.processCount} icon={<Workflow />} />
            <Metric label="ノード" value={result.validation.nodeCount} icon={<FileCode2 />} />
            <Metric label="制御フロー" value={result.validation.flowCount} icon={<GitBranch />} />
            <Metric
              label="検証"
              value={result.validation.valid ? 'OK' : '要修正'}
              icon={<CheckCircle2 />}
            />
          </section>

          {result.warnings.length > 0 && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
              <div className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-5 w-5" />
                変換時の前提・警告
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-amber-800 dark:text-amber-300">
                {result.warnings.map((warning, index) => (
                  <li key={`${index}-${warning}`}>{localizeWarning(warning)}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-col gap-3 border-b border-gray-200 p-4 dark:border-gray-700 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-2" role="tablist" aria-label="変換結果">
                <ResultTab
                  active={outputTab === 'diagram'}
                  onClick={() => setOutputTab('diagram')}
                  icon={<Workflow className="h-4 w-4" />}
                  label="Mermaidビュー"
                />
                <ResultTab
                  active={outputTab === 'json'}
                  onClick={() => setOutputTab('json')}
                  icon={<Braces className="h-4 w-4" />}
                  label="JSON正本"
                />
                <ResultTab
                  active={outputTab === 'prompt'}
                  onClick={() => setOutputTab('prompt')}
                  icon={<Sparkles className="h-4 w-4" />}
                  label="LLMプロンプト"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {outputTab === 'prompt' ? (
                  <button
                    type="button"
                    onClick={copyPrompt}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950/30 dark:text-violet-200"
                  >
                    <Copy className="h-4 w-4" />
                    プロンプトをコピー
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => editOutput(outputTab === 'diagram' ? 'mermaid' : 'json')}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <PencilLine className="h-4 w-4" />
                    この出力を編集
                  </button>
                )}
                {EXPORT_FORMATS.map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => download(item)}
                    disabled={exporting !== null}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-violet-700 dark:hover:bg-violet-600"
                  >
                    {exporting === item ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {FORMAT_LABELS[item]}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              {outputTab === 'diagram' ? (
                <MermaidViewer content={result.mermaid} className="min-h-[480px] overflow-auto" />
              ) : outputTab === 'json' ? (
                <pre className="max-h-[680px] overflow-auto rounded-lg bg-gray-950 p-4 text-xs leading-5 text-gray-100">
                  {result.json}
                </pre>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    正規化JSONを含むため、外部LLMへ貼り付ける前に機密情報と利用規程を確認してください。生成された図はレビュー用であり、JSON正本は変更されません。
                  </p>
                  <pre className="max-h-[680px] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-950 p-4 text-xs leading-5 text-gray-100">
                    {result.llmPrompt}
                  </pre>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function localizeWarning(warning: string): string {
  if (warning.startsWith('Mermaid preserves core BPMN control flow only.')) {
    return 'MermaidではBPMNの基本制御フローを保持します。実行属性、イベント内容、データ関連、コレオグラフィ、ベンダー拡張はBPMN対応ツールで確認してください。';
  }
  if (warning.startsWith('Mermaid conversion preserves core control flow but not full BPMN')) {
    return 'Mermaid変換は基本制御フローを対象とし、BPMN実行セマンティクスやベンダー拡張の完全保持は行いません。';
  }
  const extensions = warning.match(/^(\d+) extensionElements block/);
  if (extensions) {
    return `${extensions[1]}件のベンダー拡張を検出しました。コアプロファイルでは保持されないため、元のBPMN XMLを別途保管してください。`;
  }
  return warning;
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex h-5 w-5 items-center text-violet-600 dark:text-violet-400">{icon}</div>
      <div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

function ResultTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
        active
          ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
