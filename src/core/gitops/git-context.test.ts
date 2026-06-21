/**
 * FlowOps - Git Context Tests (第II部 / GIT-4)
 */

import { describe, it, expect } from 'vitest';
import { gitContextFromEnv } from './git-context';

describe('gitContextFromEnv', () => {
  it('PR の env を解析する（refs/pull/N/merge）', () => {
    const ctx = gitContextFromEnv({
      GITHUB_SHA: 'abc123',
      GITHUB_REF: 'refs/pull/42/merge',
      GITHUB_HEAD_REF: 'feature/x',
      GITHUB_REPOSITORY: 'Taguchi-1989/GitOps',
      GITHUB_ACTOR: 'taguchi',
    });
    expect(ctx).toEqual({
      commitSha: 'abc123',
      prNumber: 42,
      branch: 'feature/x',
      repo: 'Taguchi-1989/GitOps',
      actor: 'taguchi',
    });
  });

  it('push の env を解析する（refs/heads/...、PR番号なし）', () => {
    const ctx = gitContextFromEnv({
      GITHUB_SHA: 'def456',
      GITHUB_REF: 'refs/heads/master',
      GITHUB_REPOSITORY: 'o/r',
    });
    expect(ctx.prNumber).toBeNull();
    expect(ctx.branch).toBe('master');
    expect(ctx.commitSha).toBe('def456');
  });

  it('GH_PR_NUMBER の明示指定を優先する', () => {
    const ctx = gitContextFromEnv({
      GITHUB_SHA: 's',
      GITHUB_REF: 'refs/heads/x',
      GH_PR_NUMBER: '99',
    });
    expect(ctx.prNumber).toBe(99);
  });

  it('空 env でも壊れない（commitSha 空・他 null）', () => {
    const ctx = gitContextFromEnv({});
    expect(ctx.commitSha).toBe('');
    expect(ctx.prNumber).toBeNull();
    expect(ctx.repo).toBeNull();
  });
});
