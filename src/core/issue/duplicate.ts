/**
 * FlowOps - Issue Duplicate Handler
 *
 * Issue重複統合ロジック
 */

import { IssueStatus } from './types';

export interface DuplicateMergeContext {
  duplicateId: string;
  canonicalId: string;
  duplicateHumanId: string;
  canonicalHumanId: string;
  duplicateBranchName: string | null;
  canonicalBranchName: string | null;
}

export interface DuplicateMergeResult {
  success: boolean;
  cherryPickedCommits: string[];
  branchDeleted: boolean;
  error?: string;
}

/**
 * 重複統合が可能かチェック
 */
export function canMergeDuplicate(
  duplicateStatus: IssueStatus,
  canonicalStatus: IssueStatus
): { allowed: boolean; reason?: string } {
  // 既に統合済みの場合
  if (duplicateStatus === 'merged-duplicate') {
    return { allowed: false, reason: 'Issue is already merged as duplicate' };
  }

  // 既にマージ済みの場合
  if (duplicateStatus === 'merged') {
    return { allowed: false, reason: 'Issue is already merged' };
  }

  // 統合先がクローズ済みの場合
  if (canonicalStatus === 'merged' || canonicalStatus === 'rejected') {
    return { allowed: false, reason: 'Canonical issue is already closed' };
  }

  // 統合先が別のIssueに統合されている場合
  if (canonicalStatus === 'merged-duplicate') {
    return { allowed: false, reason: 'Canonical issue is itself a duplicate' };
  }

  return { allowed: true };
}

/**
 * 重複統合時のステータス変更を検証
 */
export function validateDuplicateMergeTransition(fromStatus: IssueStatus): boolean {
  // 以下のステータスからのみ統合可能
  const allowedFromStatuses: IssueStatus[] = ['new', 'triage', 'in-progress', 'proposed'];

  return allowedFromStatuses.includes(fromStatus);
}

/**
 * 重複統合の要約を生成
 */
export function generateDuplicateMergeSummary(
  duplicateHumanId: string,
  canonicalHumanId: string,
  cherryPickedCount: number
): string {
  if (cherryPickedCount > 0) {
    return `Merged ${duplicateHumanId} into ${canonicalHumanId} with ${cherryPickedCount} cherry-picked commit(s)`;
  }
  return `Merged ${duplicateHumanId} into ${canonicalHumanId} (no commits to transfer)`;
}
