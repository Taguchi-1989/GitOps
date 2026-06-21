/**
 * FlowOps - Decision Package Renderer (第II部 §11 / GIT-2)
 *
 * high 等級・block 時にマージを止め、承認 issue 本文へ展開する決裁パッケージ（§5.1.2）。
 * 「これが揃えば Yes と言える」テンプレを含む。純関数（Markdown 文字列を返すのみ）。
 * 実際の issue 起票は CLI / workflow が gh で行う（GIT-4: アダプタは GitHub API を叩かない）。
 */

import { GovernanceGateResult } from './types';
import { requiredApprovalLine, deriveRiskGrade } from '../approval';

export function decisionPackageTitle(result: GovernanceGateResult): string {
  const pr = result.git.prNumber ? `PR #${result.git.prNumber}` : result.git.commitSha.slice(0, 7);
  return `[ガバナンス承認待ち] ${pr} — ${result.action}（risk: ${result.riskGrade}）`;
}

/**
 * 承認 issue 本文（Markdown）を生成する。
 */
export function renderDecisionPackage(result: GovernanceGateResult): string {
  const { git } = result;
  const line = requiredApprovalLine(deriveRiskGrade({ riskGrade: result.riskGrade }));
  const prRef = git.prNumber ? `#${git.prNumber}` : '(push)';

  const reasons = result.reasons.length
    ? result.reasons.map(r => `- ${r}`).join('\n')
    : '- （理由なし）';

  const ingress = result.ingress
    ? `decision=\`${result.ingress.decision}\` / 検出 ${result.ingress.count} 件 / policy \`${result.ingress.policyVersion ?? '-'}\``
    : '（未実施）';
  const egress = result.egress
    ? `decision=\`${result.egress.decision}\` / finding ${result.egress.count} 件`
    : '（未実施）';

  return [
    `## ガバナンス・ハーネス判定: ${result.action}`,
    '',
    '| 項目 | 値 |',
    '|---|---|',
    `| PR | ${prRef} |`,
    `| commit | \`${git.commitSha || '-'}\` |`,
    `| repo | ${git.repo ?? '-'} |`,
    `| branch | ${git.branch ?? '-'} |`,
    `| リスク等級 | **${result.riskGrade}** |`,
    `| 決裁ライン | **${line}** |`,
    '',
    '### 判定理由',
    reasons,
    '',
    '### ゲート結果',
    `- 入口ゲート: ${ingress}`,
    `- 出口ゲート: ${egress}`,
    '',
    '### 決裁パッケージ（これが揃えば Yes と言える / §5.1.2）',
    '- [ ] 検出内容を確認し、機密の外部流出が無いことを確認した',
    '- [ ] 変更内容がリスク等級に見合うことを確認した',
    '- [ ] 当時のポリシー版で妥当であることを確認した',
    '- [ ] （high のみ）上位決裁者の承認を得た',
    '',
    '### 承認方法',
    `- 承認: この issue に \`/approve <一言理由>\` をコメント（決裁ライン: **${line}**）`,
    '- 否認: \`/reject <一言理由>\`',
    '',
    '> 判断は人・記録は機械（§5.1.3）。本 issue の決定は監査ログへ前例として蓄積されます。',
  ].join('\n');
}
