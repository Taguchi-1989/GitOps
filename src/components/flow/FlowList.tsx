/**
 * FlowOps - Flow List Component
 *
 * フロー一覧表示
 */

'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, Eye, ArrowRight } from 'lucide-react';

interface FlowSummary {
  id: string;
  title: string;
  layer: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
}

interface FlowListProps {
  flows: FlowSummary[];
  isLoading?: boolean;
}

const layerColors: Record<string, string> = {
  L0: 'bg-purple-100 text-purple-700',
  L1: 'bg-blue-100 text-blue-700',
  L2: 'bg-green-100 text-green-700',
};

const layerLabels: Record<string, string> = {
  L0: 'L0 - 戦略',
  L1: 'L1 - 業務',
  L2: 'L2 - 手順',
};

function FlowCard({ flow }: { flow: FlowSummary }) {
  return (
    <Link
      href={`/flows/${flow.id}`}
      className="
        block bg-white border border-gray-200 rounded-lg p-4
        hover:border-blue-300 hover:shadow-md
        transition-all duration-200
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-mono text-gray-500">{flow.id}.yaml</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${layerColors[flow.layer] || 'bg-gray-100 text-gray-700'}`}
            >
              {layerLabels[flow.layer] || flow.layer}
            </span>
          </div>
          <h3 className="text-base font-semibold text-gray-900">{flow.title}</h3>
        </div>

        <ArrowRight className="w-5 h-5 text-gray-400" />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          {flow.nodeCount} ノード
        </span>
        <span>{flow.edgeCount} エッジ</span>
        <span className="ml-auto">
          更新: {new Date(flow.updatedAt).toLocaleDateString('ja-JP')}
        </span>
      </div>
    </Link>
  );
}

function FlowCardSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
            <div className="h-5 w-10 bg-gray-200 rounded-full" />
          </div>
          <div className="h-5 w-2/3 bg-gray-200 rounded" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4">
        <div className="h-3 w-16 bg-gray-200 rounded" />
        <div className="h-3 w-16 bg-gray-200 rounded" />
        <div className="h-3 w-24 bg-gray-200 rounded ml-auto" />
      </div>
    </div>
  );
}

export function FlowList({ flows, isLoading = false }: FlowListProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">フロー</h1>
          <p className="text-sm text-gray-500 mt-0.5">業務フローの一覧（{flows.length}件）</p>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <FlowCardSkeleton key={i} />)
        ) : flows.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500">フローがまだありません</div>
            <p className="text-sm text-gray-400 mt-1">
              <code className="bg-gray-100 px-1.5 py-0.5 rounded">spec/flows/</code>{' '}
              にYAMLファイルを追加すると、ここに表示されます
            </p>
          </div>
        ) : (
          flows.map(flow => <FlowCard key={flow.id} flow={flow} />)
        )}
      </div>
    </div>
  );
}
