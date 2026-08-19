/**
 * FlowOps - New Flow Form
 *
 * ①名前を入力 ②ひな形を選ぶ ③作成する、の3ステップだけで完結させる。
 * 専門用語（YAML / ノード / レイヤ など）は表に出さない。
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import type { Flow } from '@/core/parser/schema';
import { stringifyFlow } from '@/core/parser';
import { FLOW_TEMPLATES } from '@/components/flow/editor/templates';

/** 「白紙から」用のひな形（開始→処理→終了） */
const BLANK_FLOW: Flow = {
  id: 'blank',
  title: '新しいフロー',
  layer: 'L1',
  updatedAt: new Date(0).toISOString(),
  nodes: {
    start: { id: 'start', type: 'start', label: '開始', meta: { position: { x: 250, y: 80 } } },
    step1: { id: 'step1', type: 'process', label: '処理', meta: { position: { x: 250, y: 220 } } },
    end: { id: 'end', type: 'end', label: '終了', meta: { position: { x: 250, y: 360 } } },
  },
  edges: {
    e1: { id: 'e1', from: 'start', to: 'step1' },
    e2: { id: 'e2', from: 'step1', to: 'end' },
  },
};

interface Choice {
  key: string;
  name: string;
  description: string;
  flow: Flow;
}

const CHOICES: Choice[] = [
  {
    key: 'blank',
    name: '白紙から',
    description: '最小限の流れだけを用意します。あとから自由に書き足せます。',
    flow: BLANK_FLOW,
  },
  ...FLOW_TEMPLATES.filter(t => t.id !== 'blank').map(t => ({
    key: t.id,
    name: t.name,
    description: t.description,
    flow: t.flow,
  })),
];

/** タイトルからファイル名に使えるIDを作る（日本語などは変換できないので日付ベースにする） */
function toBaseId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || `flow-${Date.now()}`;
}

/** 既存フローと衝突しないIDを決める */
function resolveId(title: string, existingIds: string[]): string {
  const base = toBaseId(title);
  const taken = new Set(existingIds);
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

function FlowPreview({ flow }: { flow: Flow }) {
  const labels = Object.values(flow.nodes).map(n => n.label);
  const visible = labels.slice(0, 4);
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
      {visible.map((label, i) => (
        <React.Fragment key={`${label}-${i}`}>
          {i > 0 && <span className="text-gray-400 dark:text-gray-500">→</span>}
          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">{label}</span>
        </React.Fragment>
      ))}
      {labels.length > visible.length && (
        <span className="text-gray-400 dark:text-gray-500">→ …</span>
      )}
    </div>
  );
}

interface NewFlowFormProps {
  existingIds: string[];
}

export function NewFlowForm({ existingIds }: NewFlowFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [selectedKey, setSelectedKey] = useState<string>('blank');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => CHOICES.find(c => c.key === selectedKey) ?? CHOICES[0],
    [selectedKey]
  );

  const trimmedTitle = title.trim();
  const canCreate = trimmedTitle.length > 0 && !isCreating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    setError(null);

    const id = resolveId(trimmedTitle, existingIds);
    const flow: Flow = {
      ...selected.flow,
      id,
      title: trimmedTitle,
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/flows/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title: trimmedTitle, yaml: stringifyFlow(flow) }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        // 409 は同じIDのフローが既にある（名前の重複）、それ以外は入力内容の問題
        setError(
          res.status === 409
            ? '同じ名前のフローが既にあります。別の名前にしてもう一度お試しください。'
            : '作成できませんでした。名前や記号を見直してもう一度お試しください。'
        );
        setIsCreating(false);
        return;
      }
      router.push(`/flows/${id}`);
    } catch {
      setError('作成できませんでした。通信状態を確認してもう一度お試しください。');
      setIsCreating(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/flows"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          <ArrowLeft className="w-4 h-4" />
          フロー一覧に戻る
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          新しいフローを作る
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          名前を決めて、近いひな形を選ぶだけで作れます。あとから自由に書き換えられます。
        </p>
      </div>

      <div>
        <label
          htmlFor="flow-title"
          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
        >
          このフローの名前
        </label>
        <input
          id="flow-title"
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="例: 見積書の作成手順"
          className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
          どのひな形から始めますか
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {CHOICES.map(choice => {
            const isSelected = choice.key === selectedKey;
            return (
              <button
                key={choice.key}
                type="button"
                onClick={() => setSelectedKey(choice.key)}
                aria-pressed={isSelected}
                className={`text-left rounded-lg border p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {choice.name}
                  </h2>
                  {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {choice.description}
                </p>
                <div className="mt-3">
                  <FlowPreview flow={choice.flow} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
          作成
        </button>
        {trimmedTitle.length === 0 && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            名前を入力すると作成できます
          </span>
        )}
      </div>
    </div>
  );
}
