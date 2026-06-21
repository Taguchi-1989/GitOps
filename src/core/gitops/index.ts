/**
 * FlowOps - GitOps Binding Module (ガバナンス・ハーネス 第II部)
 *
 * GIT-4: 本アダプタは GitHub Actions SDK / Octokit に依存しない純データ境界。
 * in-line / gateway いずれのモードでも同一に動作する（§2.1 / §10）。
 */

export * from './types';
export { gitContextFromEnv } from './git-context';
export { runGovernanceGate } from './gate-runner';
export { renderDecisionPackage, decisionPackageTitle } from './decision-package';
