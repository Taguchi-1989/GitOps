/**
 * FlowOps - 承認リクエスト詳細ページ（判断カード）
 *
 * ApprovalRequest の詳細を取得し、DecisionCard へ渡す。
 * GateEvaluation が DB にあればそちらを優先して使用する。
 */

import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import {
  DecisionCard,
  type DecisionCardData,
  type ValidationResult,
  type AssumptionItem,
  type GateData,
} from '@/components/approval';
import type { GateOutcome } from '@/components/approval';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 破損したJSON文字列でもサーバーコンポーネントを落とさないための安全パース */
function safeParseObject(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function safeParseArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function getApprovalData(id: string): Promise<DecisionCardData | null> {
  const approvalRequest = await prisma.approvalRequest.findUnique({
    where: { id },
    include: {
      workflow: {
        include: {
          gateEvaluations: true,
          taskExecutions: true,
        },
      },
    },
  });

  if (!approvalRequest) return null;

  const workflow = approvalRequest.workflow;
  const ctx = safeParseObject(approvalRequest.context);

  // GateEvaluation を優先（DB が正）: 同じ nodeId の中で最新を選ぶ
  const gateEvaluations = workflow.gateEvaluations
    .filter(g => g.nodeId === approvalRequest.nodeId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const latestGate = gateEvaluations[0] ?? null;

  let gate: GateData | null = null;

  if (latestGate) {
    const results = safeParseArray<ValidationResult>(latestGate.resultsJson);
    const assumptions = safeParseArray<AssumptionItem>(latestGate.assumptionsJson);
    gate = {
      outcome: latestGate.outcome as GateOutcome,
      results,
      assumptions,
    };
  } else if (ctx.gate) {
    // ctx.gate フォールバック
    const ctxGate = ctx.gate as {
      outcome?: string;
      results?: ValidationResult[];
      assumptions?: AssumptionItem[];
    };
    if (ctxGate.outcome) {
      gate = {
        outcome: ctxGate.outcome as GateOutcome,
        results: ctxGate.results ?? [],
        assumptions: ctxGate.assumptions ?? [],
      };
    }
  }

  // 該当 taskExecution を探す
  const taskId: string | null =
    latestGate?.taskId ?? (typeof ctx.taskId === 'string' ? ctx.taskId : null) ?? null;

  const taskExecution = taskId
    ? (workflow.taskExecutions.find(
        t => t.nodeId === approvalRequest.nodeId && t.taskId === taskId
      ) ??
      workflow.taskExecutions.find(t => t.nodeId === approvalRequest.nodeId) ??
      null)
    : (workflow.taskExecutions.find(t => t.nodeId === approvalRequest.nodeId) ?? null);

  // input の解決: ctx.input > taskExecution.input > ctx.stateData > {}
  let input: Record<string, unknown> = {};
  if (ctx.input && typeof ctx.input === 'object') {
    input = ctx.input as Record<string, unknown>;
  } else if (taskExecution?.input) {
    try {
      input = JSON.parse(taskExecution.input) as Record<string, unknown>;
    } catch {
      input = {};
    }
  } else if (ctx.stateData && typeof ctx.stateData === 'object') {
    input = ctx.stateData as Record<string, unknown>;
  }

  // output の解決: ctx.output > taskExecution.output > {}
  let output: Record<string, unknown> = {};
  if (ctx.output && typeof ctx.output === 'object') {
    output = ctx.output as Record<string, unknown>;
  } else if (taskExecution?.output) {
    try {
      output = JSON.parse(taskExecution.output) as Record<string, unknown>;
    } catch {
      output = {};
    }
  }

  const resolvedTaskId =
    latestGate?.taskId ??
    (typeof ctx.taskId === 'string' ? ctx.taskId : null) ??
    taskExecution?.taskId ??
    null;

  return {
    approvalRequestId: approvalRequest.id,
    workflowId: approvalRequest.workflowId,
    flowId: workflow.flowId,
    nodeId: approvalRequest.nodeId,
    nodeLabel: approvalRequest.nodeId, // ノードラベルが無ければ nodeId をそのまま使用
    taskId: resolvedTaskId,
    input,
    output,
    gate,
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `承認リクエスト ${id.slice(0, 8)} - FlowOps`,
  };
}

export default async function ApprovalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getApprovalData(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="p-6">
      <DecisionCard data={data} />
    </div>
  );
}
