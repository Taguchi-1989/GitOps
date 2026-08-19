/**
 * FlowOps - キャンバス編集の一気通貫リグレッションテスト
 *
 * issueId 未指定(FlowViewerClient の保存)で作られた改善カードが、
 * 適用 → merge-close まで到達できることを検証する。
 * 以前は自動作成 Issue にブランチが無く、merge-close が
 * 「Issue has no branch to merge」で永久に失敗していた。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Flow } from '@/core/parser/schema';

const store = vi.hoisted(() => ({
  issues: new Map<string, any>(),
  proposals: new Map<string, any>(),
  seq: 0,
  yaml: 'dummy: yaml-content\n',
  branches: [] as string[],
  commits: [] as string[],
  merged: [] as string[],
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({ body, status: init?.status || 200 })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/prisma', () => {
  const createIssue = (data: any) => {
    const id = `issue-${++store.seq}`;
    const issue = { id, branchName: null, createdAt: new Date(), ...data };
    store.issues.set(id, issue);
    return issue;
  };
  return {
    prisma: {
      issue: {
        findUnique: vi.fn(async ({ where }: any) => store.issues.get(where.id) ?? null),
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: any) => createIssue(data)),
        update: vi.fn(async ({ where, data }: any) => {
          const issue = { ...store.issues.get(where.id), ...data };
          store.issues.set(where.id, issue);
          return issue;
        }),
      },
      proposal: {
        create: vi.fn(async ({ data }: any) => {
          const id = `proposal-${++store.seq}`;
          const proposal = {
            id,
            isApplied: false,
            appliedAt: null,
            createdAt: new Date(),
            ...data,
          };
          store.proposals.set(id, proposal);
          return proposal;
        }),
        findUnique: vi.fn(async ({ where, include }: any) => {
          const proposal = store.proposals.get(where.id);
          if (!proposal) return null;
          return include?.issue
            ? { ...proposal, issue: store.issues.get(proposal.issueId) }
            : proposal;
        }),
        findFirst: vi.fn(
          async ({ where }: any) =>
            [...store.proposals.values()].find(
              p => p.issueId === where.issueId && p.isApplied === where.isApplied
            ) ?? null
        ),
        update: vi.fn(async ({ where, data }: any) => {
          const proposal = { ...store.proposals.get(where.id), ...data };
          store.proposals.set(where.id, proposal);
          return proposal;
        }),
      },
      $transaction: vi.fn(async (cb: any) =>
        cb({
          issue: {
            findFirst: vi.fn(async () => null),
            create: vi.fn(async ({ data }: any) => createIssue(data)),
          },
        })
      ),
    },
  };
});

vi.mock('@/core/audit', () => ({
  auditLog: {
    record: vi.fn(),
    logIssueAction: vi.fn(),
    logProposalAction: vi.fn(),
    logGitAction: vi.fn(),
  },
}));

vi.mock('@/core/git', () => ({
  getGitManager: vi.fn(() => ({
    createBranch: vi.fn(async (branch: string) => {
      store.branches.push(branch);
    }),
    commitChanges: vi.fn(async (message: string) => {
      store.commits.push(message);
      return { hash: 'commit-hash', message, filesChanged: 1 };
    }),
    mergeAndClose: vi.fn(async (branch: string) => {
      store.merged.push(branch);
    }),
  })),
}));

vi.mock('@/lib/flow-service', () => ({
  getFlow: vi.fn(async () => ({ flow: sampleFlow(), mermaid: '', filePath: '/x' })),
  getFlowYaml: vi.fn(async () => store.yaml),
  getDictionary: vi.fn(async () => ({ roles: [], systems: [] })),
  saveFlowYaml: vi.fn(async (_id: string, yaml: string) => {
    store.yaml = yaml;
  }),
}));

import { POST as createProposal } from './route';
import { POST as applyProposal } from '@/app/api/proposals/[id]/apply/route';
import { POST as mergeClose } from '@/app/api/issues/[id]/merge-close/route';
import { sha256 } from '@/core/patch';

function sampleFlow(): Flow {
  return {
    id: 'flow-1',
    title: 'テストフロー',
    layer: 'L1',
    updatedAt: '2026-01-01T00:00:00Z',
    nodes: {
      n1: { id: 'n1', type: 'start', label: '開始' },
      n2: { id: 'n2', type: 'process', label: '処理' },
      n3: { id: 'n3', type: 'end', label: '終了' },
    },
    edges: {
      e1: { id: 'e1', from: 'n1', to: 'n2' },
      e2: { id: 'e2', from: 'n2', to: 'n3' },
    },
  };
}

function makeRequest(body?: unknown): any {
  return {
    json: async () => body,
    headers: { get: (k: string) => (k === 'x-actor-id' ? 'admin' : null) },
  };
}

describe('キャンバス保存 → 適用 → merge-close', () => {
  beforeEach(() => {
    store.issues.clear();
    store.proposals.clear();
    store.seq = 0;
    store.yaml = 'dummy: yaml-content\n';
    store.branches = [];
    store.commits = [];
    store.merged = [];
  });

  it('issueId 未指定でもマージまで到達できる', async () => {
    const flow = sampleFlow();
    flow.nodes.n2.label = '処理(改)';

    // 1) キャンバス保存(FlowViewerClient は issueId を送らない)
    const created: any = await createProposal(
      makeRequest({ flow, baseHash: sha256(store.yaml), intent: '図の編集によるフロー更新' }),
      { params: Promise.resolve({ id: 'flow-1' }) }
    );
    expect(created.status).toBe(201);

    const issueId: string = created.body.data.issueId;
    const proposalId: string = created.body.data.proposal.id;
    const issue = store.issues.get(issueId);
    expect(issue.status).toBe('proposed');
    expect(issue.branchName).toBeTruthy();
    expect(store.branches).toEqual([issue.branchName]);

    // 2) 改善案の適用(ブランチ上にコミットされる)
    const applied: any = await applyProposal(makeRequest(), {
      params: Promise.resolve({ id: proposalId }),
    });
    expect(applied.status).toBe(200);
    expect(store.proposals.get(proposalId).isApplied).toBe(true);
    expect(store.commits).toHaveLength(1);

    // 3) merge-close(以前はここで「Issue has no branch to merge」だった)
    const merged: any = await mergeClose(makeRequest(), {
      params: Promise.resolve({ id: issueId }),
    });
    expect(merged.status).toBe(200);
    expect(merged.body.data.status).toBe('merged');
    expect(store.merged).toEqual([issue.branchName]);
  });
});
