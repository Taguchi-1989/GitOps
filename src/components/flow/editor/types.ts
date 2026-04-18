import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { NodeType } from '@/core/parser/schema';

export interface FlowNodeData {
  label: string;
  nodeType: NodeType;
  role?: string;
  system?: string;
  taskId?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export type FlowNode = RFNode<FlowNodeData>;
export type FlowEdge = RFEdge<{ condition?: string }>;
