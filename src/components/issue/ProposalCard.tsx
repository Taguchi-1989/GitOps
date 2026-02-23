/**
 * FlowOps - Proposal Card Component
 *
 * 提案（Proposal）を表示するカード
 */

'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock, Code } from 'lucide-react';
import { HelpTooltip } from '@/components/ui/HelpTooltip';

export interface ProposalData {
  id: string;
  intent: string;
  jsonPatch: unknown;
  diffPreview?: string | null;
  isApplied: boolean;
  appliedAt?: Date | string | null;
  createdAt: Date | string;
  baseHash?: string | null;
}

interface ProposalCardProps {
  proposal: ProposalData;
  onApply?: () => void;
  isLoading?: boolean;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ProposalCard({ proposal, onApply, isLoading = false }: ProposalCardProps) {
  const [showPatch, setShowPatch] = useState(false);

  return (
    <div
      className={`
      border rounded-lg overflow-hidden
      ${proposal.isApplied ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}
    `}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              {proposal.isApplied && (
                <span className="flex items-center gap-1 text-sm text-green-600">
                  <Check className="w-4 h-4" />
                  適用済
                </span>
              )}
              <span className="text-xs text-gray-500">
                <Clock className="w-3 h-3 inline mr-1" />
                {formatDate(proposal.createdAt)}
              </span>
            </div>
            <p className="text-gray-900">{proposal.intent}</p>
          </div>

          {!proposal.isApplied && onApply && (
            <button
              type="button"
              onClick={onApply}
              disabled={isLoading}
              className="
                flex items-center gap-2 px-4 py-2
                bg-green-600 text-white rounded-lg
                hover:bg-green-700 disabled:opacity-50
                transition-colors
              "
              title="この改善案をGitブランチにコミットします"
            >
              <Check className="w-4 h-4" />
              <span>
                <span className="font-medium">適用する</span>
                <span className="block text-xs text-green-200">ブランチにコミット</span>
              </span>
            </button>
          )}
        </div>

        {/* Base Hash */}
        {proposal.baseHash && (
          <div className="mt-2 text-xs text-gray-500 font-mono flex items-center gap-1">
            ベースハッシュ: {proposal.baseHash.substring(0, 12)}...
            <HelpTooltip content="この提案が生成された時点のフロー定義のバージョンです。フローが変更されている場合、この提案は古くなっている可能性があります。" />
          </div>
        )}
      </div>

      {/* Diff Preview */}
      {proposal.diffPreview && (
        <div className="border-t border-gray-200">
          <div className="px-4 pt-2 pb-1">
            <p className="text-xs text-gray-500 font-medium">変更内容プレビュー</p>
          </div>
          <div
            className="diff-preview p-4 text-sm font-mono bg-gray-50"
            dangerouslySetInnerHTML={{ __html: proposal.diffPreview }}
          />
        </div>
      )}

      {/* JSON Patch Toggle */}
      <div className="border-t border-gray-200">
        <button
          type="button"
          onClick={() => setShowPatch(!showPatch)}
          className="
            w-full flex items-center justify-between px-4 py-2
            text-sm text-gray-600 hover:bg-gray-50
            transition-colors
          "
        >
          <span className="flex items-center gap-2">
            <Code className="w-4 h-4" />
            JSON Patchを表示
            <HelpTooltip content="RFC 6902形式のJSON Patchです。YAMLフローファイルへの具体的な変更操作が定義されています。" />
          </span>
          {showPatch ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showPatch && (
          <div className="px-4 pb-4">
            <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(proposal.jsonPatch, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
