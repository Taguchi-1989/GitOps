/**
 * FlowOps - Flow Viewer Component
 * 
 * フロー詳細表示画面
 */

'use client';

import React, { useState } from 'react';
import { MermaidViewer } from './MermaidViewer';
import { Flow } from '@/core/parser';
import { 
  ArrowLeft, 
  FileText, 
  Layers, 
  Clock, 
  Eye,
  Code,
  Info,
} from 'lucide-react';

interface FlowViewerProps {
  flow: Flow;
  mermaidContent: string;
  onBack?: () => void;
  onNodeClick?: (nodeId: string) => void;
  onCreateIssue?: (nodeId?: string) => void;
}

export function FlowViewer({
  flow,
  mermaidContent,
  onBack,
  onNodeClick,
  onCreateIssue,
}: FlowViewerProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diagram' | 'data'>('diagram');

  const nodeCount = Object.keys(flow.nodes).length;
  const edgeCount = Object.keys(flow.edges).length;

  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    onNodeClick?.(nodeId);
  };

  const selectedNodeData = selectedNode ? flow.nodes[selectedNode] : null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-white">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Flows
          </button>
        )}
        
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{flow.title}</h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                {flow.id}.yaml
              </span>
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                Layer: {flow.layer}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                {nodeCount} nodes, {edgeCount} edges
              </span>
            </div>
          </div>
          
          {onCreateIssue && (
            <button
              onClick={() => onCreateIssue(selectedNode || undefined)}
              className="
                flex items-center gap-2 px-4 py-2
                bg-blue-600 text-white rounded-lg
                hover:bg-blue-700 transition-colors
              "
            >
              Create Issue
              {selectedNode && (
                <span className="text-blue-200 text-sm">for {selectedNode}</span>
              )}
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-4 border-b border-gray-200 -mb-px">
          <button
            onClick={() => setActiveTab('diagram')}
            className={`
              px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === 'diagram'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <Eye className="w-4 h-4 inline mr-1" />
            Diagram
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`
              px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === 'data'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }
            `}
          >
            <Code className="w-4 h-4 inline mr-1" />
            Raw Data
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <div className="flex-1 p-4 overflow-auto bg-gray-50">
          {activeTab === 'diagram' ? (
            <MermaidViewer
              content={mermaidContent}
              onNodeClick={handleNodeClick}
              className="h-full"
            />
          ) : (
            <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify(flow, null, 2)}
            </pre>
          )}
        </div>

        {/* Side Panel - Selected Node */}
        {selectedNodeData && (
          <div className="w-80 flex-shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Node Details</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
              
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">ID</dt>
                  <dd className="font-mono text-gray-900">{selectedNodeData.id}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Type</dt>
                  <dd className="capitalize text-gray-900">{selectedNodeData.type}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Label</dt>
                  <dd className="text-gray-900">{selectedNodeData.label}</dd>
                </div>
                {selectedNodeData.role && (
                  <div>
                    <dt className="text-gray-500">Role</dt>
                    <dd className="text-gray-900">{selectedNodeData.role}</dd>
                  </div>
                )}
                {selectedNodeData.system && (
                  <div>
                    <dt className="text-gray-500">System</dt>
                    <dd className="text-gray-900">{selectedNodeData.system}</dd>
                  </div>
                )}
                {selectedNodeData.meta && Object.keys(selectedNodeData.meta).length > 0 && (
                  <div>
                    <dt className="text-gray-500">Meta</dt>
                    <dd className="font-mono text-xs bg-gray-50 p-2 rounded">
                      {JSON.stringify(selectedNodeData.meta, null, 2)}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Connected Edges */}
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">Connected Edges</h4>
                <ul className="space-y-2 text-sm">
                  {Object.values(flow.edges)
                    .filter(e => e.from === selectedNode || e.to === selectedNode)
                    .map(edge => (
                      <li key={edge.id} className="flex items-center gap-2 text-gray-600">
                        <span className="font-mono text-xs">
                          {edge.from} → {edge.to}
                        </span>
                        {edge.label && (
                          <span className="text-gray-400">({edge.label})</span>
                        )}
                      </li>
                    ))
                  }
                </ul>
              </div>

              {/* Create Issue Button */}
              {onCreateIssue && (
                <button
                  onClick={() => onCreateIssue(selectedNode ?? undefined)}
                  className="
                    mt-6 w-full flex items-center justify-center gap-2
                    px-4 py-2 bg-blue-600 text-white rounded-lg
                    hover:bg-blue-700 transition-colors
                  "
                >
                  <Info className="w-4 h-4" />
                  Create Issue for this Node
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
