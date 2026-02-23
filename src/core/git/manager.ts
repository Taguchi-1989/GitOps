/**
 * FlowOps - Git Manager
 *
 * simple-git を使用したGit操作のラッパー
 * すべての操作はロックを取得してから実行
 */

import simpleGit, { SimpleGit, StatusResult } from 'simple-git';
import { gitLock, LockHandle } from './lock';
import { logger } from '@/lib/logger';

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  isClean: boolean;
  modified: string[];
  staged: string[];
  untracked: string[];
}

export interface CommitResult {
  hash: string;
  message: string;
  filesChanged: number;
}

export interface BranchInfo {
  current: string;
  all: string[];
  branches: Record<string, { current: boolean; commit: string }>;
}

class GitManager {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
  }

  /**
   * リポジトリの状態を取得
   */
  async getStatus(): Promise<GitStatus> {
    const status: StatusResult = await this.git.status();

    return {
      branch: status.current || 'unknown',
      ahead: status.ahead,
      behind: status.behind,
      isClean: status.isClean(),
      modified: status.modified,
      staged: status.staged,
      untracked: status.not_added,
    };
  }

  /**
   * 現在のHEADコミットハッシュを取得
   */
  async getHead(): Promise<string> {
    const result = await this.git.revparse(['HEAD']);
    return result.trim();
  }

  /**
   * ブランチ情報を取得
   */
  async getBranches(): Promise<BranchInfo> {
    const result = await this.git.branch(['-a']);
    return {
      current: result.current,
      all: result.all,
      branches: result.branches,
    };
  }

  /**
   * 新しいブランチを作成してチェックアウト
   * @param branchName ブランチ名
   */
  async createBranch(branchName: string): Promise<void> {
    const lock = await gitLock.acquire(`createBranch:${branchName}`);
    try {
      // 現在のブランチを記録
      const beforeHead = await this.getHead();
      logger.info({ branch: branchName, from: beforeHead }, 'Creating branch');

      await this.git.checkoutLocalBranch(branchName);

      logger.info({ branch: branchName }, 'Branch created and checked out');
    } finally {
      lock.release();
    }
  }

  /**
   * 指定したブランチにチェックアウト
   * @param branchName ブランチ名
   */
  async checkout(branchName: string): Promise<void> {
    const lock = await gitLock.acquire(`checkout:${branchName}`);
    try {
      await this.git.checkout(branchName);
      logger.info({ branch: branchName }, 'Checked out branch');
    } finally {
      lock.release();
    }
  }

  /**
   * ファイルをステージング
   * @param files ファイルパスの配列
   */
  async add(files: string[]): Promise<void> {
    await this.git.add(files);
    logger.info({ files }, 'Staged files');
  }

  /**
   * コミットを作成
   * @param message コミットメッセージ
   * @param files オプション：特定のファイルのみコミット
   */
  async commit(message: string, files?: string[]): Promise<CommitResult> {
    const lock = await gitLock.acquire(`commit`);
    try {
      if (files && files.length > 0) {
        await this.git.add(files);
      }

      const result = await this.git.commit(message);

      logger.info({ hash: result.commit, message }, 'Committed');

      return {
        hash: result.commit,
        message,
        filesChanged: result.summary.changes,
      };
    } finally {
      lock.release();
    }
  }

  /**
   * 変更をコミット（add + commit）
   * @param message コミットメッセージ
   * @param files コミットするファイル
   */
  async commitChanges(message: string, files: string[]): Promise<CommitResult> {
    const lock = await gitLock.acquire(`commitChanges`);
    try {
      // ファイルをステージング
      await this.git.add(files);

      // コミット
      const result = await this.git.commit(message);

      logger.info({ hash: result.commit }, 'Committed changes');

      return {
        hash: result.commit,
        message,
        filesChanged: result.summary.changes,
      };
    } finally {
      lock.release();
    }
  }

  /**
   * ブランチをマージ
   * @param branchName マージするブランチ名
   */
  async merge(branchName: string): Promise<void> {
    const lock = await gitLock.acquire(`merge:${branchName}`);
    try {
      await this.git.merge([branchName]);
      logger.info({ branch: branchName }, 'Merged branch');
    } finally {
      lock.release();
    }
  }

  /**
   * ブランチをmainにマージしてクローズ
   * @param branchName クローズするブランチ名
   */
  async mergeAndClose(branchName: string): Promise<void> {
    const lock = await gitLock.acquire(`mergeAndClose:${branchName}`);
    try {
      // mainにチェックアウト
      await this.git.checkout('main');

      // マージ
      await this.git.merge([branchName]);

      // ブランチ削除
      await this.git.deleteLocalBranch(branchName);

      logger.info({ branch: branchName }, 'Merged and closed branch');
    } finally {
      lock.release();
    }
  }

  /**
   * ブランチを削除
   * @param branchName 削除するブランチ名
   * @param force 強制削除するか
   */
  async deleteBranch(branchName: string, force = false): Promise<void> {
    const lock = await gitLock.acquire(`deleteBranch:${branchName}`);
    try {
      if (force) {
        await this.git.deleteLocalBranch(branchName, true);
      } else {
        await this.git.deleteLocalBranch(branchName);
      }
      logger.info({ branch: branchName }, 'Deleted branch');
    } finally {
      lock.release();
    }
  }

  /**
   * ブランチにコミットがあるか確認
   * @param branchName ブランチ名
   * @param baseBranch 比較対象のブランチ（デフォルト: main）
   */
  async hasCommits(branchName: string, baseBranch = 'main'): Promise<boolean> {
    try {
      const log = await this.git.log([`${baseBranch}..${branchName}`]);
      return log.total > 0;
    } catch {
      return false;
    }
  }

  /**
   * Cherry-pick コミット
   * @param fromBranch 取得元ブランチ
   * @param toBranch 適用先ブランチ
   */
  async cherryPick(fromBranch: string, toBranch: string): Promise<string[]> {
    const lock = await gitLock.acquire(`cherryPick:${fromBranch}->${toBranch}`);
    try {
      // 取得元ブランチのコミットを取得
      const log = await this.git.log([`main..${fromBranch}`]);
      const commits = log.all.map(c => c.hash);

      if (commits.length === 0) {
        logger.info({ branch: fromBranch }, 'No commits to cherry-pick');
        return [];
      }

      // 適用先ブランチにチェックアウト
      await this.git.checkout(toBranch);

      // 各コミットをcherry-pick（古い順に）
      for (const hash of commits.reverse()) {
        await this.git.raw(['cherry-pick', hash]);
        logger.info({ hash }, 'Cherry-picked commit');
      }

      return commits;
    } finally {
      lock.release();
    }
  }

  /**
   * Gitリポジトリを初期化
   */
  async init(): Promise<void> {
    await this.git.init();
    logger.info({ path: this.repoPath }, 'Initialized repository');
  }

  /**
   * ブランチが存在するか確認
   */
  async branchExists(branchName: string): Promise<boolean> {
    const branches = await this.getBranches();
    return branches.all.includes(branchName);
  }
}

// ファクトリ関数
export function createGitManager(repoPath: string): GitManager {
  return new GitManager(repoPath);
}

// デフォルトインスタンス（プロジェクトルート）
let defaultManager: GitManager | null = null;

export function getGitManager(): GitManager {
  if (!defaultManager) {
    // プロジェクトルートを取得（cwd）
    defaultManager = new GitManager(process.cwd());
  }
  return defaultManager;
}

export { GitManager };
