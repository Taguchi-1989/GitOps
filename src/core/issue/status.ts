/**
 * FlowOps - Issue Status Transition Rules
 *
 * ステータス遷移のガード。現状は「効果なし終了（closed-ineffective）」のみ
 * 厳密な前提条件を持つため、その最小限の検証を提供する。
 */

import { IssueStatus } from './types';

/** closed-ineffective へ遷移できる元ステータス（フローに反映済み＝merged のみ） */
const CLOSED_INEFFECTIVE_ALLOWED_FROM: IssueStatus[] = ['merged'];

export interface StatusTransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * ステータス遷移の可否を判定する。
 * closed-ineffective は「フローに反映したが効果が出なかった」ことを表すため、
 * merged からの遷移のみ許可する。
 */
export function validateStatusTransition(
  from: IssueStatus,
  to: IssueStatus
): StatusTransitionResult {
  if (to === 'closed-ineffective' && !CLOSED_INEFFECTIVE_ALLOWED_FROM.includes(from)) {
    return {
      allowed: false,
      reason: `Cannot transition from "${from}" to "closed-ineffective" (allowed from: ${CLOSED_INEFFECTIVE_ALLOWED_FROM.join(', ')})`,
    };
  }

  return { allowed: true };
}
