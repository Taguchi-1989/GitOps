/**
 * FlowOps - Governance Gate CLI (ガバナンス・ハーネス 第II部 §10-§11)
 *
 * GitHub Actions（in-line モード）から呼ぶ結線エントリ。
 *  - env から GitContext を解析（GIT-4: GitHub SDK 不使用、env のみ）
 *  - PR 差分を入口ゲートで検査し、判定を commit SHA / PR 番号に紐づけ監査（GIT-1）
 *  - block / escalate のときは決裁パッケージ（GIT-2）を出力し exit 1 でマージをブロック
 *  - allow のときは exit 0
 *
 * 実行: ts-node -r tsconfig-paths/register -P tsconfig.seed.json --transpile-only scripts/governance-gate.ts
 *
 * フェイルセーフ: 差分取得に失敗したら allow にせず escalate（人手レビューへ）。
 */

import { execFileSync } from 'node:child_process';
import { writeFileSync, appendFileSync } from 'node:fs';
import {
  gitContextFromEnv,
  runGovernanceGate,
  renderDecisionPackage,
  decisionPackageTitle,
} from '@/core/gitops';

function getDiff(): { text: string; ok: boolean } {
  const baseRef = process.env.GITHUB_BASE_REF;
  try {
    if (baseRef) {
      // PR: ベースとのマージベースからの差分
      const out = execFileSync(
        'git',
        ['diff', '--no-color', `origin/${baseRef}...HEAD`],
        { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }
      );
      return { text: out, ok: true };
    }
    const out = execFileSync('git', ['diff', '--no-color', 'HEAD~1', 'HEAD'], {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
    });
    return { text: out, ok: true };
  } catch {
    return { text: '', ok: false };
  }
}

function setOutput(key: string, value: string): void {
  const f = process.env.GITHUB_OUTPUT;
  if (f) appendFileSync(f, `${key}=${value}\n`);
}

function appendSummary(md: string): void {
  const f = process.env.GITHUB_STEP_SUMMARY;
  if (f) appendFileSync(f, md + '\n');
}

async function main(): Promise<void> {
  const git = gitContextFromEnv(process.env);
  const riskGrade = (process.env.GOVERNANCE_RISK_GRADE as 'low' | 'medium' | 'high') || 'medium';

  const diff = getDiff();

  const result = await runGovernanceGate({
    git,
    diffText: diff.text,
    riskGrade,
  });

  // 差分取得に失敗していたら、allow を信用せず escalate へ倒す（fail-safe）
  const effectiveAction = !diff.ok && result.action === 'allow' ? 'escalate' : result.action;
  if (effectiveAction !== result.action) {
    result.action = effectiveAction;
    result.reasons.push('差分取得に失敗したため fail-safe で escalate');
  }

  // eslint-disable-next-line no-console
  console.log(`[governance-gate] action=${result.action} risk=${result.riskGrade}`);
  for (const r of result.reasons) {
    // eslint-disable-next-line no-console
    console.log(`  - ${r}`);
  }

  appendSummary(`### ガバナンス・ハーネス判定: \`${result.action}\`\n`);
  appendSummary(result.reasons.map(r => `- ${r}`).join('\n'));

  setOutput('action', result.action);
  setOutput('should_block', result.action === 'allow' ? 'false' : 'true');

  if (result.action !== 'allow') {
    // 決裁パッケージ（GIT-2）を出力。workflow がこれを issue 本文にして起票する。
    writeFileSync('governance-decision.md', renderDecisionPackage(result), 'utf-8');
    writeFileSync('governance-decision-title.txt', decisionPackageTitle(result), 'utf-8');
    // in-line: block / escalate はマージをブロック（exit 1）
    process.exit(1);
  }

  process.exit(0);
}

main().catch(err => {
  // 例外時も素通しにしない（fail-safe）
  // eslint-disable-next-line no-console
  console.error('[governance-gate] error:', err);
  setOutput('action', 'escalate');
  setOutput('should_block', 'true');
  process.exit(1);
});
