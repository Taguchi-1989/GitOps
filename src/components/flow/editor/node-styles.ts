import type { NodeType } from '@/core/parser/schema';

export interface NodeStyle {
  bgColor: string;
  borderColor: string;
  textColor: string;
  /** Hex color for contexts that cannot use Tailwind classes (e.g. React Flow MiniMap). */
  hexColor: string;
  icon: string;
  shape: 'rounded' | 'diamond' | 'cylinder' | 'hexagon' | 'rectangle';
}

export const NODE_STYLE_MAP: Record<NodeType, NodeStyle> = {
  start: {
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-600',
    textColor: 'text-white',
    hexColor: '#10b981',
    icon: 'Play',
    shape: 'rounded',
  },
  end: {
    bgColor: 'bg-red-500',
    borderColor: 'border-red-600',
    textColor: 'text-white',
    hexColor: '#ef4444',
    icon: 'Square',
    shape: 'rounded',
  },
  process: {
    bgColor: 'bg-blue-500',
    borderColor: 'border-blue-600',
    textColor: 'text-white',
    hexColor: '#3b82f6',
    icon: 'Cog',
    shape: 'rectangle',
  },
  decision: {
    bgColor: 'bg-amber-500',
    borderColor: 'border-amber-600',
    textColor: 'text-white',
    hexColor: '#f59e0b',
    icon: 'GitBranch',
    shape: 'diamond',
  },
  database: {
    bgColor: 'bg-violet-500',
    borderColor: 'border-violet-600',
    textColor: 'text-white',
    hexColor: '#8b5cf6',
    icon: 'Database',
    shape: 'cylinder',
  },
  'llm-task': {
    bgColor: 'bg-pink-500',
    borderColor: 'border-pink-600',
    textColor: 'text-white',
    hexColor: '#ec4899',
    icon: 'Sparkles',
    shape: 'hexagon',
  },
  'human-review': {
    bgColor: 'bg-teal-500',
    borderColor: 'border-teal-600',
    textColor: 'text-white',
    hexColor: '#14b8a6',
    icon: 'UserCheck',
    shape: 'rectangle',
  },
};
