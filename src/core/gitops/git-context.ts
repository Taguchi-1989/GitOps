/**
 * FlowOps - Git Context Adapter (第II部 / GIT-4)
 *
 * GitHub Actions の環境変数から GitContext を解析する純関数。
 * env を引数で受け取り（process.env を直接読まない）テスト可能・移植可能にする。
 */

import { GitContext } from './types';

type Env = Record<string, string | undefined>;

/** refs/heads/foo → foo / refs/pull/12/merge → null（PR番号側で扱う） */
function refToBranch(ref: string | undefined): string | null {
  if (!ref) return null;
  const m = /^refs\/heads\/(.+)$/.exec(ref);
  return m ? m[1] : null;
}

/** refs/pull/<N>/merge | refs/pull/<N>/head → N */
function prNumberFromRef(ref: string | undefined): number | null {
  if (!ref) return null;
  const m = /^refs\/pull\/(\d+)\//.exec(ref);
  return m ? Number(m[1]) : null;
}

/**
 * GitHub Actions の env から GitContext を解析する。
 * 認識する変数: GITHUB_SHA / GITHUB_REF / GITHUB_HEAD_REF / GITHUB_REPOSITORY / GITHUB_ACTOR
 * さらに明示の PR 番号 GH_PR_NUMBER があれば優先する。
 */
export function gitContextFromEnv(env: Env): GitContext {
  const commitSha = env.GITHUB_SHA ?? '';
  const repo = env.GITHUB_REPOSITORY ?? null;
  const actor = env.GITHUB_ACTOR ?? null;

  // PR 時は HEAD_REF が源ブランチ。push 時は GITHUB_REF から解析。
  const branch = env.GITHUB_HEAD_REF || refToBranch(env.GITHUB_REF);

  const explicitPr = env.GH_PR_NUMBER ? Number(env.GH_PR_NUMBER) : null;
  const prNumber =
    explicitPr && Number.isFinite(explicitPr) ? explicitPr : prNumberFromRef(env.GITHUB_REF);

  return {
    commitSha,
    prNumber: prNumber && Number.isFinite(prNumber) ? prNumber : null,
    branch: branch || null,
    repo,
    actor,
  };
}
