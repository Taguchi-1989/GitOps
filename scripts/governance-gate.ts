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

// 検査対象から除外する pathspec。
// テストフィクスチャ・ドキュメントは例示シークレット（AWS 公式のサンプルアクセスキーや
// .env のプレースホルダ等）を正当に含むため、本番ソースのみを走査する。実在シークレットの
// 検出力は本番パスで維持される。
//
// 重要: `:(glob)` magic を付与する。既定の git pathspec では `**/` がディレクトリ階層を
// 跨がず、ルート直下の `README.md` などが除外されない（CI で README の .env 例が誤検出された）。
// glob magic により `**/` がゼロ階層を含む全階層にマッチし、ルート/ネスト両方を確実に除外する。
const EXCLUDE_PATHSPECS = [
  ':(exclude,glob)**/*.test.ts',
  ':(exclude,glob)**/*.test.tsx',
  ':(exclude,glob)docs/**',
  ':(exclude,glob)**/*.md',
  ':(exclude,glob)**/.env.example',
  ':(exclude,glob)**/.env.*.example',
  ':(exclude,glob)**/package-lock.json',
];

function getDiff(): { text: string; ok: boolean } {
  const baseRef = process.env.GITHUB_BASE_REF;
  const range = baseRef ? `origin/${baseRef}...HEAD` : 'HEAD~1';
  const rangeArgs = baseRef ? [range] : ['HEAD~1', 'HEAD'];
  try {
    const out = execFileSync(
      'git',
      ['diff', '--no-color', '--unified=0', ...rangeArgs, '--', '.', ...EXCLUDE_PATHSPECS],
      { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 }
    );
    const addedLines = out
      .split(/\r?\n/)
      .filter(line => line.startsWith('+') && !line.startsWith('+++'));
    return { text: addedLines.join('\n'), ok: true };
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
    artifact: diff.text,
    ingressPolicyId: 'gitops-secret-gate',
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
