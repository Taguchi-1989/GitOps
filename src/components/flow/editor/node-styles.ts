import type { NodeType } from '@/core/parser/schema';

export interface NodeStyle {
  bgColor: string;
  borderColor: string;
  textColor: string;
  icon: string;
  shape: 'rounded' | 'diamond' | 'cylinder' | 'hexagon' | 'rectangle';
}

export const NODE_STYLE_MAP: Record<NodeType, NodeStyle> = {
  start: {
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-600',
    textColor: 'text-white',
    icon: 'Play',
    shape: 'rounded',
  },
  end: {
    bgColor: 'bg-red-500',
    borderColor: 'border-red-600',
    textColor: 'text-white',
    icon: 'Square',
    shape: 'rounded',
  },
  process: {
    bgColor: 'bg-blue-500',
    borderColor: 'border-blue-600',
    textColor: 'text-white',
    icon: 'Cog',
    shape: 'rectangle',
  },
  decision: {
    bgColor: 'bg-amber-500',
    borderColor: 'border-amber-600',
    textColor: 'text-white',
    icon: 'GitBranch',
    shape: 'diamond',
  },
  database: {
    bgColor: 'bg-violet-500',
    borderColor: 'border-violet-600',
    textColor: 'text-white',
    icon: 'Database',
    shape: 'cylinder',
  },
  'llm-task': {
    bgColor: 'bg-pink-500',
    borderColor: 'border-pink-600',
    textColor: 'text-white',
    icon: 'Sparkles',
    shape: 'hexagon',
  },
  'human-review': {
    bgColor: 'bg-teal-500',
    borderColor: 'border-teal-600',
    textColor: 'text-white',
    icon: 'UserCheck',
    shape: 'rectangle',
  },
};
