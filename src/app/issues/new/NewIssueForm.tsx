/**
 * FlowOps - New Issue Form
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { FlowSummary } from '@/lib/flow-service';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface NewIssueFormProps {
  flows: FlowSummary[];
  defaultFlowId?: string;
  defaultNodeId?: string;
}

export function NewIssueForm({ flows, defaultFlowId, defaultNodeId }: NewIssueFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    targetFlowId: defaultFlowId || '',
    targetNodeId: defaultNodeId || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      addToast('error', 'Title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      addToast('error', 'Description is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title.trim(),
          description: formData.description.trim(),
          targetFlowId: formData.targetFlowId || undefined,
          targetNodeId: formData.targetNodeId || undefined,
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.details || 'Failed to create issue');
      }

      addToast('success', `Issue ${data.data.humanId} created successfully`);
      router.push(`/issues/${data.data.id}`);
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Failed to create issue');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Link
        href="/issues"
        className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Issues
      </Link>

      {/* Title */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="簡潔なIssueのタイトル"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          maxLength={200}
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="問題の詳細、再現手順、期待される動作など"
          rows={6}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      {/* Target Flow */}
      <div>
        <label htmlFor="targetFlowId" className="block text-sm font-medium text-gray-700 mb-1">
          Target Flow
        </label>
        <select
          id="targetFlowId"
          value={formData.targetFlowId}
          onChange={(e) => setFormData(prev => ({ ...prev, targetFlowId: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select a flow (optional)</option>
          {flows.map(flow => (
            <option key={flow.id} value={flow.id}>
              {flow.title} ({flow.id})
            </option>
          ))}
        </select>
      </div>

      {/* Target Node ID */}
      {formData.targetFlowId && (
        <div>
          <label htmlFor="targetNodeId" className="block text-sm font-medium text-gray-700 mb-1">
            Target Node ID
          </label>
          <input
            type="text"
            id="targetNodeId"
            value={formData.targetNodeId}
            onChange={(e) => setFormData(prev => ({ ...prev, targetNodeId: e.target.value }))}
            placeholder="例: receive_order"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-3">
        <Link
          href="/issues"
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Create Issue
        </button>
      </div>
    </form>
  );
}
