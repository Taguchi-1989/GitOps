/**
 * FlowOps - Test Helpers
 *
 * APIルートテスト用の共通ユーティリティ
 */

import { NextRequest } from 'next/server';
import type { Issue } from '@prisma/client';

/**
 * テスト用のNextRequestを生成
 */
export function createMockRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init as any);
}

/**
 * モックレスポンスからJSONボディを取得
 */
export function getResponseBody(result: { body: unknown }): unknown {
  return result.body;
}

/**
 * テスト用のIssueデータ生成
 */
export function createMockIssue(overrides: Partial<Issue> = {}): Issue {
  return {
    id: 'issue-1',
    humanId: 'ISS-001',
    title: 'テストIssue',
    description: 'テストの説明',
    status: 'new',
    targetFlowId: 'order-process',
    targetNodeId: null,
    canonicalId: null,
    branchName: null,
    // PDCA: Plan フェーズ
    currentSituation: null,
    frequency: null,
    impact: null,
    expectedState: null,
    hypothesisCause: null,
    successMetric: null,
    checkDueDate: null,
    // PDCA: Check フェーズ
    metricBefore: null,
    metricAfter: null,
    checkDate: null,
    checkResult: null,
    learning: null,
    nextAction: null,
    standardizedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * テスト用のProposalデータ生成
 */
export function createMockProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proposal-1',
    issueId: 'issue-1',
    intent: 'テスト修正提案',
    jsonPatch: JSON.stringify([{ op: 'replace', path: '/title', value: 'Updated' }]),
    diffPreview: '<div>diff</div>',
    baseHash: 'abc123',
    targetFlowId: 'order-process',
    isApplied: false,
    appliedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}
