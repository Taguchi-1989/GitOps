/**
 * FlowOps - Decision Package Tests (第II部 §11 / GIT-2)
 */

import { describe, it, expect } from 'vitest';
import { renderDecisionPackage, decisionPackageTitle } from './decision-package';
import { GovernanceGateResult } from './types';

const base: GovernanceGateResult = {
  action: 'block',
  riskGrade: 'high',
  reasons: ['入口ゲート: 機密混入を検出（block）'],
  ingress: { decision: 'block', count: 1, policyVersion: '1.0.0' },
  egress: null,
  git: {
    commitSha: 'abcdef1234567',
    prNumber: 42,
    branch: 'feature/x',
    repo: 'o/r',
    actor: 'taguchi',
  },
};

describe('decisionPackageTitle', () => {
  it('PR 番号・action・risk を含む', () => {
    expect(decisionPackageTitle(base)).toContain('PR #42');
    expect(decisionPackageTitle(base)).toContain('block');
    expect(decisionPackageTitle(base)).toContain('high');
  });
});

describe('renderDecisionPackage', () => {
  it('決裁パッケージのチェックリストと決裁ラインを含む（§5.1.2）', () => {
    const md = renderDecisionPackage(base);
    expect(md).toContain('これが揃えば Yes と言える');
    expect(md).toContain('executive'); // high → executive 決裁ライン
    expect(md).toContain('PR | #42');
    expect(md).toContain('機密の外部流出が無いことを確認');
  });

  it('理由とゲート結果を展開する', () => {
    const md = renderDecisionPackage(base);
    expect(md).toContain('入口ゲート: 機密混入を検出（block）');
    expect(md).toContain('decision=`block`');
  });
});
