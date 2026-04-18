'use client';

import React from 'react';
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
import type { FlowNodeData, FlowNode } from './types';

const ICON_MAP: Record<string, LucideIcon> = {
  Play,
  Square,
  Cog,
  GitBranch,
  Database,
  Sparkles,
  UserCheck,
};

function getShapeStyle(shape: string): React.CSSProperties {
  switch (shape) {
    case 'diamond':
      return {
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
        width: 100,
        height: 100,
      };
    case 'cylinder':
      return {
        borderRadius: '8px 8px 50% 50% / 8px 8px 12px 12px',
      };
    case 'hexagon':
      return {
        clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
        paddingLeft: '24px',
        paddingRight: '24px',
      };
    case 'rounded':
      return {
        borderRadius: '9999px',
      };
    case 'rectangle':
    default:
      return {
        borderRadius: '6px',
      };
  }
}

export function CustomNode({ data, selected }: NodeProps<FlowNode>) {
  const nodeData = data as FlowNodeData;
  const style = NODE_STYLE_MAP[nodeData.nodeType] ?? NODE_STYLE_MAP['process'];
  const Icon = ICON_MAP[style.icon];
  const shapeStyle = getShapeStyle(style.shape);

  const isDiamond = style.shape === 'diamond';

  return (
    <div
      className={`
        relative flex items-center justify-center
        min-w-[120px] min-h-[48px] px-3 py-2
        border-2 ${style.bgColor} ${style.borderColor} ${style.textColor}
        shadow-md cursor-pointer select-none
        transition-all duration-150
        ${selected ? 'ring-2 ring-white ring-offset-2 ring-offset-transparent shadow-lg scale-105' : ''}
      `}
      style={{
        ...shapeStyle,
        ...(isDiamond && { minWidth: 'unset', padding: 0 }),
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />

      <div
        className={`flex flex-col items-center gap-1 ${isDiamond ? 'px-2 py-1' : ''}`}
        style={isDiamond ? { transform: 'none' } : undefined}
      >
        {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
        <span className="text-xs font-medium text-center leading-tight max-w-[120px] break-words">
          {nodeData.label}
        </span>
        {nodeData.role && (
          <span className="text-[10px] opacity-80 text-center leading-tight">
            ({nodeData.role})
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white !border-gray-400 !w-2.5 !h-2.5"
      />
    </div>
  );
}

export default CustomNode;
