'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import {
  Play,
  Square,
  Cog,
  GitBranch,
  Database,
  Sparkles,
  UserCheck,
  LucideIcon,
} from 'lucide-react';
import { NODE_STYLE_MAP } from './node-styles';
import type { FlowNode } from './types';

const ICON_MAP: Record<string, LucideIcon> = {
  Play,
  Square,
  Cog,
  GitBranch,
  Database,
  Sparkles,
  UserCheck,
};

function getShapeClass(shape: string): string {
  switch (shape) {
    case 'diamond':
      return '[clip-path:polygon(50%_0%,100%_50%,50%_100%,0%_50%)] w-[100px] h-[100px]';
    case 'cylinder':
      return 'rounded-[8px_8px_50%_50%/8px_8px_12px_12px]';
    case 'hexagon':
      return '[clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)] px-6';
    case 'rounded':
      return 'rounded-full';
    case 'rectangle':
    default:
      return 'rounded-md';
  }
}

export function CustomNode({ data, selected }: NodeProps<FlowNode>) {
  const style = NODE_STYLE_MAP[data.nodeType] ?? NODE_STYLE_MAP['process'];
  const Icon = ICON_MAP[style.icon];
  const shapeClass = getShapeClass(style.shape);
  const isDiamond = style.shape === 'diamond';

  // Inline label editing state
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync label when data changes externally
  useEffect(() => {
    if (!editing) setEditValue(data.label);
  }, [data.label, editing]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    // Label display only — actual data update goes through NodeEditPanel/onUpdateNode.
  };

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  return (
    <div
      className={`
        relative flex items-center justify-center
        min-w-[120px] min-h-[48px]
        border-2 ${style.bgColor} ${style.borderColor} ${style.textColor}
        shadow-md cursor-pointer select-none
        transition-all duration-150
        ${isDiamond ? 'p-0' : 'px-3 py-2'}
        ${shapeClass}
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent shadow-lg scale-105' : ''}
      `}
      onDoubleClick={handleDoubleClick}
    >
      {/* Target handles: top + left + right */}
      <Handle
        type="target"
        position={Position.Top}
        id="target-top"
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="target-left"
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="target-right"
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />

      <div className={`flex flex-col items-center gap-1 ${isDiamond ? 'px-2 py-1' : ''}`}>
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            aria-label="ノードラベルを編集"
            title="ノードラベルを編集"
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === 'Escape') commitEdit();
            }}
            className="text-xs font-medium text-center leading-tight max-w-[120px] bg-white/20 border border-white/40 rounded px-1 w-full outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-xs font-medium text-center leading-tight max-w-[120px] break-words">
            {data.label}
          </span>
        )}
        {data.role && (
          <span className="text-[10px] opacity-80 text-center leading-tight">({data.role})</span>
        )}
      </div>

      {/* Source handles: bottom + left + right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="source-bottom"
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Left}
        id="source-left"
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="source-right"
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />
    </div>
  );
}

export default CustomNode;
