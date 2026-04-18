import type { Node as RFNode, Edge as RFEdge } from '@xyflow/react';
import type { NodeType, DataClassification, DataLayer } from '@/core/parser/schema';

export interface FlowNodeData {
  label: string;
  nodeType: NodeType;
  role?: string;
  system?: string;
  taskId?: string;
  dataClassification?: DataClassification;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export type FlowNode = RFNode<FlowNodeData>;
export type FlowEdge = RFEdge<{ condition?: string; dataLayer?: DataLayer }>;
