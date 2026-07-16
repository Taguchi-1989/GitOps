'use client';

import { ChangeEvent, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Braces,
  CheckCircle2,
  Download,
  FileCode2,
  FileUp,
  Loader2,
  Network,
  PencilLine,
} from 'lucide-react';
import { MermaidViewer } from '@/components/flow';
import { useToast } from '@/components/ui/Toast';
import type { DexpiDocument, DexpiValidationResult } from '@/core/dexpi/types';

type ExchangeFormat = 'mermaid' | 'json' | 'dexpi-xml';

interface ConversionResult {
  document: DexpiDocument;
  json: string;
  mermaid: string;
  validation: DexpiValidationResult;
  warnings: string[];
}

const SAMPLE_MERMAID = `flowchart LR
  feed_tank["T-101 / Feed tank"]:::tank
  feed_pump["P-101 / Feed pump"]:::pump
  isolation_valve["XV-101 / Isolation valve"]:::valve

  feed_tank -->|"ProcessFlow"| feed_pump
  feed_pump -->|"ProcessFlow"| isolation_valve

  %% dexpi:model name="FeedSystemPid" uri="urn:flowops:dexpi:feed-system"
  %% dexpi:type feed_tank Plant/ProcessEquipment.Tank
  %% dexpi:type feed_pump Plant/ProcessEquipment.Pump
  %% dexpi:type isolation_valve Plant/Piping.GlobeValve
  %% dexpi:data feed_tank {"TagName":["T-101"]}
  %% dexpi:data feed_pump {"TagName":["P-101"]}`;

const FORMAT_LABELS: Record<ExchangeFormat, string> = {
  mermaid: 'Mermaid',
  json: '正規化JSON',
  'dexpi-xml': 'DeXPI XML 2.0',
};

export function DexpiWorkbenchClient() {
  const { addToast } = useToast();
  const [format, setFormat] = useState<ExchangeFormat>('mermaid');
  const [content, setContent] = useState(SAMPLE_MERMAID);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [outputTab, setOutputTab] = useState<'diagram' | 'json'>('diagram');
  const [converting, setConverting] = useState(false);
  const [exporting, setExporting] = useState<ExchangeFormat | null>(null);

  async function convert() {
    setConverting(true);
    try {
      const response = await fetch('/api/dexpi/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format, content }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.details || '変換に失敗しました');
      setResult(payload.data as ConversionResult);
      addToast('success', `${FORMAT_LABELS[format]}を正規化JSONへ変換しました`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : '変換に失敗しました');
    } finally {
      setConverting(false);
    }
  }

  async function download(targetFormat: ExchangeFormat) {
    if (!result) return;
    setExporting(targetFormat);
    try {
      const response = await fetch('/api/dexpi/export', {
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
    const nextFormat: ExchangeFormat =
      extension === 'xml' ? 'dexpi-xml' : extension === 'json' ? 'json' : 'mermaid';
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              DeXPI交換ワークベンチ
            </h1>
          </div>
          <p className="mt-2 max-w-4xl text-sm text-gray-600 dark:text-gray-400">
            正本はレビューしやすいJSONで保持し、Mermaidを概念設計ビュー、DeXPI XML
            2.0を交換形式として相互変換します。
          </p>
        </div>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
          <FileUp className="h-4 w-4" />
          ファイルを読み込む
          <input
            type="file"
            accept=".xml,.json,.mmd,.mermaid,.txt"
            className="sr-only"
            onChange={loadFile}
          />
        </label>
      </header>

      <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100">
        DeXPI
        2.0を対象にしています。Mermaidからの自動変換は概念接続を作る初期工程です。配管ノード、ノズル、計装ループ、図形座標などの詳細は、エンジニアリングレビューで補完してください。
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="入力形式">
            {(Object.keys(FORMAT_LABELS) as ExchangeFormat[]).map(item => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={format === item}
                onClick={() => setFormat(item)}
                className={`min-h-11 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  format === item
                    ? 'bg-cyan-600 text-white'
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
              className="min-h-[340px] w-full rounded-lg border border-gray-300 bg-gray-950 p-4 font-mono text-xs leading-5 text-gray-100 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-gray-600"
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
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          <section className="grid gap-4 sm:grid-cols-3">
            <Metric
              label="オブジェクト"
              value={result.validation.objectCount}
              icon={<FileCode2 className="h-5 w-5" />}
            />
            <Metric
              label="参照・構成関係"
              value={result.validation.referenceCount}
              icon={<Network className="h-5 w-5" />}
            />
            <Metric
              label="検証"
              value={result.validation.valid ? 'OK' : '要修正'}
              icon={<CheckCircle2 className="h-5 w-5" />}
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
                  icon={<Network className="h-4 w-4" />}
                  label="Mermaidビュー"
                />
                <ResultTab
                  active={outputTab === 'json'}
                  onClick={() => setOutputTab('json')}
                  icon={<Braces className="h-4 w-4" />}
                  label="JSON正本"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => editOutput(outputTab === 'diagram' ? 'mermaid' : 'json')}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <PencilLine className="h-4 w-4" />
                  この出力を編集
                </button>
                {(['json', 'mermaid', 'dexpi-xml'] as ExchangeFormat[]).map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => download(item)}
                    disabled={exporting !== null}
                    className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-cyan-700 dark:hover:bg-cyan-600"
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
              ) : (
                <pre className="max-h-[680px] overflow-auto rounded-lg bg-gray-950 p-4 text-xs leading-5 text-gray-100">
                  {result.json}
                </pre>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function localizeWarning(warning: string): string {
  if (warning.startsWith('Mermaid edges were mapped to the FlowOpsConnectivity extension.')) {
    return 'Mermaidの接続はFlowOpsConnectivity拡張へ変換しました。詳細設計ではDeXPI標準の配管・計装トポロジーへ置き換えてください。';
  }
  if (warning.startsWith('Mermaid conversion describes conceptual connectivity;')) {
    return 'Mermaid変換は概念接続を表します。詳細P&IDのトポロジーとDeXPIクラス制約は、引き続きエンジニアリングレビューが必要です。';
  }
  const generatedIds = warning.match(/^(\d+) object\(s\) without an XML id/);
  if (generatedIds) {
    return `XML IDがない${generatedIds[1]}件のObjectへ、決定論的な生成IDを付与しました。`;
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
      <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">{icon}</div>
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
          ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
