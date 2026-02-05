/**
 * FlowOps - Git Lock Manager
 * 
 * Repo単位でのMutex Lock機構
 * 同時操作の防止とタイムアウト時の自動解除
 */

export class LockTimeoutError extends Error {
  constructor(message = 'Failed to acquire git lock: timeout') {
    super(message);
    this.name = 'LockTimeoutError';
  }
}

export interface LockHandle {
  release: () => void;
}

class GitLock {
  private locked = false;
  private lockHolder: string | null = null;
  private lockTime: number | null = null;
  private timeout: number;

  constructor(timeoutMs = 30000) {
    this.timeout = timeoutMs;
  }

  /**
   * ロックを取得する
   * @param holder ロック取得者の識別子（デバッグ用）
   * @returns ロックハンドル
   * @throws LockTimeoutError タイムアウト時
   */
  async acquire(holder = 'unknown'): Promise<LockHandle> {
    const start = Date.now();
    
    while (this.locked) {
      // タイムアウトチェック
      if (Date.now() - start > this.timeout) {
        throw new LockTimeoutError(
          `Failed to acquire git lock: timeout after ${this.timeout}ms. ` +
          `Current holder: ${this.lockHolder}`
        );
      }
      
      // 古いロックの自動解除（2倍のタイムアウト時間を超えたら）
      if (this.lockTime && Date.now() - this.lockTime > this.timeout * 2) {
        console.warn(`[GitLock] Force releasing stale lock held by: ${this.lockHolder}`);
        this.forceRelease();
      }
      
      // 100ms待機
      await this.sleep(100);
    }
    
    this.locked = true;
    this.lockHolder = holder;
    this.lockTime = Date.now();
    
    return {
      release: () => this.release(holder),
    };
  }

  /**
   * ロックを解放する
   */
  private release(holder: string): void {
    if (this.lockHolder !== holder) {
      console.warn(`[GitLock] Attempted to release lock by non-holder: ${holder}`);
      return;
    }
    
    this.locked = false;
    this.lockHolder = null;
    this.lockTime = null;
  }

  /**
   * 強制的にロックを解放する（緊急用）
   */
  forceRelease(): void {
    console.warn(`[GitLock] Force releasing lock held by: ${this.lockHolder}`);
    this.locked = false;
    this.lockHolder = null;
    this.lockTime = null;
  }

  /**
   * 現在のロック状態を取得
   */
  getStatus(): { locked: boolean; holder: string | null; duration: number | null } {
    return {
      locked: this.locked,
      holder: this.lockHolder,
      duration: this.lockTime ? Date.now() - this.lockTime : null,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// シングルトンとしてエクスポート
export const gitLock = new GitLock();

// クラスもエクスポート（テスト用）
export { GitLock };
