/**
 * FlowOps - Approval Workflow Module (ガバナンス・ハーネス §5 / Phase 0)
 *
 * 全件人手承認 + 前例蓄積。自動承認はしない（§5.3）。
 */

export * from './types';
export { caseSignature, signatureFromContext } from './case-signature';
export {
  recordPrecedent,
  findPrecedents,
  requiredApprovalLine,
  deriveRiskGrade,
} from './precedent';
export { sampleHash, shouldSampleAudit } from './sample-audit';
export {
  decideAutoApproval,
  tryAutoApprove,
  loadAutoApprovalConfig,
  DEFAULT_AUTO_APPROVAL_CONFIG,
  type AutoApprovalConfig,
  type AutoApprovalInput,
  type AutoApprovalResult,
  type TryAutoApproveOptions,
} from './auto-approve';
