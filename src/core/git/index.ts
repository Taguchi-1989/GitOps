/**
 * FlowOps - Git Module Index
 * 
 * Git操作関連のエクスポート
 */

export { gitLock, GitLock, LockTimeoutError, type LockHandle } from './lock';
export { 
  GitManager, 
  createGitManager, 
  getGitManager,
  type GitStatus,
  type CommitResult,
  type BranchInfo,
} from './manager';
