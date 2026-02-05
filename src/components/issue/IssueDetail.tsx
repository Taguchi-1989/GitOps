/**
 * FlowOps - Issue Detail Component
 * 
 * Issue詳細画面のメインコンポーネント
 */

'use client';

import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { IssueCardData } from './IssueCard';
import { ProposalCard, ProposalData } from './ProposalCard';
import { 
  ArrowLeft, 
  GitBranch, 
  FileText, 
  Clock, 
  Play, 
  Sparkles,
  CheckCircle,
  XCircle,
  History,
} from 'lucide-react';

interface IssueDetailProps {
  issue: IssueCardData & {
    proposals?: ProposalData[];
  };
  onBack?: () => void;
  onStart?: () => void;
  onGenerateProposal?: () => void;
  onApplyProposal?: (proposalId: string) => void;
  onMergeClose?: () => void;
  onReject?: () => void;
  isLoading?: boolean;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IssueDetail({
  issue,
  onBack,
  onStart,
  onGenerateProposal,
  onApplyProposal,
  onMergeClose,
  onReject,
  isLoading = false,
}: IssueDetailProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'proposals' | 'history'>('details');

  const canStart = issue.status === 'new' || issue.status === 'triage';
  const canGenerateProposal = issue.status === 'in-progress';
  const canMergeOrReject = issue.status === 'proposed';

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Issues
          </button>
        )}
        
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-mono text-gray-500">{issue.humanId}</span>
              <StatusBadge status={issue.status} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{issue.title}</h1>
          </div>
          
          {/* Actions */}
          <div className="flex gap-2">
            {canStart && onStart && (
              <button
                onClick={onStart}
                disabled={isLoading}
                className="
                  flex items-center gap-2 px-4 py-2
                  bg-blue-600 text-white rounded-lg
                  hover:bg-blue-700 disabled:opacity-50
                  transition-colors
                "
              >
                <Play className="w-4 h-4" />
                Start Work
              </button>
            )}
            
            {canGenerateProposal && onGenerateProposal && (
              <button
                onClick={onGenerateProposal}
                disabled={isLoading}
                className="
                  flex items-center gap-2 px-4 py-2
                  bg-purple-600 text-white rounded-lg
                  hover:bg-purple-700 disabled:opacity-50
                  transition-colors
                "
              >
                <Sparkles className="w-4 h-4" />
                Generate Proposal
              </button>
            )}
            
            {canMergeOrReject && (
              <>
                {onMergeClose && (
                  <button
                    onClick={onMergeClose}
                    disabled={isLoading}
                    className="
                      flex items-center gap-2 px-4 py-2
                      bg-green-600 text-white rounded-lg
                      hover:bg-green-700 disabled:opacity-50
                      transition-colors
                    "
                  >
                    <CheckCircle className="w-4 h-4" />
                    Merge & Close
                  </button>
                )}
                {onReject && (
                  <button
                    onClick={onReject}
                    disabled={isLoading}
                    className="
                      flex items-center gap-2 px-4 py-2
                      bg-gray-600 text-white rounded-lg
                      hover:bg-gray-700 disabled:opacity-50
                      transition-colors
                    "
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-4 mb-6 text-sm text-gray-600">
        {issue.targetFlowId && (
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>Flow: <span className="font-medium">{issue.targetFlowId}</span></span>
            {issue.targetNodeId && (
              <span className="text-gray-400"> &gt; {issue.targetNodeId}</span>
            )}
          </span>
        )}
        
        {issue.branchName && (
          <span className="flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" />
            <span className="font-mono">{issue.branchName}</span>
          </span>
        )}
        
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Created: {formatDate(issue.createdAt)}
        </span>
        
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Updated: {formatDate(issue.updatedAt)}
        </span>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('details')}
            className={`
              px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('proposals')}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === 'proposals'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            Proposals
            {issue.proposals && issue.proposals.length > 0 && (
              <span className={`
                px-2 py-0.5 rounded-full text-xs
                ${activeTab === 'proposals' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}
              `}>
                {issue.proposals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`
              flex items-center gap-2 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === 'history'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <History className="w-4 h-4" />
            History
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'details' && (
        <div className="prose prose-gray max-w-none">
          <h3>Description</h3>
          <p className="whitespace-pre-wrap">{issue.description}</p>
        </div>
      )}

      {activeTab === 'proposals' && (
        <div className="space-y-4">
          {issue.proposals && issue.proposals.length > 0 ? (
            issue.proposals.map(proposal => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onApply={onApplyProposal ? () => onApplyProposal(proposal.id) : undefined}
              />
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              No proposals yet
              {canGenerateProposal && onGenerateProposal && (
                <button
                  onClick={onGenerateProposal}
                  className="block mx-auto mt-2 text-purple-600 hover:text-purple-700"
                >
                  Generate your first proposal
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="text-center py-12 text-gray-500">
          Audit log will be displayed here
        </div>
      )}
    </div>
  );
}
