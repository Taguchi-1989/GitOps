import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Hoisted mock variables (available inside vi.mock factories) ---

const { mockRelease, mockGitInstance } = vi.hoisted(() => {
  const mockRelease = vi.fn();
  const mockGitInstance = {
    status: vi.fn(),
    revparse: vi.fn(),
    branch: vi.fn(),
    checkoutLocalBranch: vi.fn(),
    checkout: vi.fn(),
    add: vi.fn(),
    commit: vi.fn(),
    merge: vi.fn(),
    deleteLocalBranch: vi.fn(),
    log: vi.fn(),
    raw: vi.fn(),
    init: vi.fn(),
  };
  return { mockRelease, mockGitInstance };
});

// --- Module mocks ---

vi.mock('./lock', () => ({
  gitLock: {
    acquire: vi.fn().mockResolvedValue({ release: mockRelease }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('simple-git', () => ({
  default: vi.fn(() => mockGitInstance),
}));

// --- Imports (after mocks) ---

import { createGitManager, getGitManager, GitManager } from './manager';
import { gitLock } from './lock';

// --- Reset all mocks before each test ---

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================
// GitManager - constructor & factory functions
// ============================================================

describe('GitManager construction', () => {
  it('createGitManager returns a GitManager instance', () => {
    const manager = createGitManager('/some/repo');
    expect(manager).toBeInstanceOf(GitManager);
  });

  it('getGitManager returns the same singleton instance on repeated calls', () => {
    const a = getGitManager();
    const b = getGitManager();
    expect(a).toBe(b);
  });
});

// ============================================================
// GitManager methods
// ============================================================

describe('GitManager', () => {
  let manager: GitManager;

  beforeEach(() => {
    manager = createGitManager('/test/repo');
  });

  // ----------------------------------------------------------
  // getStatus
  // ----------------------------------------------------------
  describe('getStatus', () => {
    it('returns a properly mapped GitStatus object', async () => {
      mockGitInstance.status.mockResolvedValue({
        current: 'main',
        ahead: 2,
        behind: 1,
        isClean: () => true,
        modified: ['file1.ts'],
        staged: ['file2.ts'],
        not_added: ['file3.ts'],
      });

      const status = await manager.getStatus();

      expect(status).toEqual({
        branch: 'main',
        ahead: 2,
        behind: 1,
        isClean: true,
        modified: ['file1.ts'],
        staged: ['file2.ts'],
        untracked: ['file3.ts'],
      });
    });

    it('returns "unknown" when current branch is null', async () => {
      mockGitInstance.status.mockResolvedValue({
        current: null,
        ahead: 0,
        behind: 0,
        isClean: () => true,
        modified: [],
        staged: [],
        not_added: [],
      });

      const status = await manager.getStatus();
      expect(status.branch).toBe('unknown');
    });

    it('returns isClean=false when repo is dirty', async () => {
      mockGitInstance.status.mockResolvedValue({
        current: 'dev',
        ahead: 0,
        behind: 0,
        isClean: () => false,
        modified: ['dirty.ts'],
        staged: [],
        not_added: [],
      });

      const status = await manager.getStatus();
      expect(status.isClean).toBe(false);
      expect(status.modified).toEqual(['dirty.ts']);
    });
  });

  // ----------------------------------------------------------
  // getHead
  // ----------------------------------------------------------
  describe('getHead', () => {
    it('returns trimmed HEAD commit hash', async () => {
      mockGitInstance.revparse.mockResolvedValue('abc123\n');

      const head = await manager.getHead();

      expect(head).toBe('abc123');
      expect(mockGitInstance.revparse).toHaveBeenCalledWith(['HEAD']);
    });

    it('handles already-trimmed output', async () => {
      mockGitInstance.revparse.mockResolvedValue('def456');

      const head = await manager.getHead();
      expect(head).toBe('def456');
    });
  });

  // ----------------------------------------------------------
  // getBranches
  // ----------------------------------------------------------
  describe('getBranches', () => {
    it('returns branch info with current, all, and branches', async () => {
      const branchData = {
        current: 'main',
        all: ['main', 'feature/x'],
        branches: {
          main: { current: true, commit: 'aaa' },
          'feature/x': { current: false, commit: 'bbb' },
        },
      };
      mockGitInstance.branch.mockResolvedValue(branchData);

      const result = await manager.getBranches();

      expect(result).toEqual({
        current: 'main',
        all: ['main', 'feature/x'],
        branches: branchData.branches,
      });
      expect(mockGitInstance.branch).toHaveBeenCalledWith(['-a']);
    });
  });

  // ----------------------------------------------------------
  // createBranch
  // ----------------------------------------------------------
  describe('createBranch', () => {
    it('acquires lock, creates local branch, and releases lock', async () => {
      mockGitInstance.revparse.mockResolvedValue('head123');
      mockGitInstance.checkoutLocalBranch.mockResolvedValue(undefined);

      await manager.createBranch('feature/new');

      expect(gitLock.acquire).toHaveBeenCalledWith('createBranch:feature/new');
      expect(mockGitInstance.checkoutLocalBranch).toHaveBeenCalledWith('feature/new');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('calls getHead before creating branch', async () => {
      mockGitInstance.revparse.mockResolvedValue('head-before');
      mockGitInstance.checkoutLocalBranch.mockResolvedValue(undefined);

      await manager.createBranch('feature/traced');

      expect(mockGitInstance.revparse).toHaveBeenCalledWith(['HEAD']);
    });

    it('releases lock even when checkoutLocalBranch throws', async () => {
      mockGitInstance.revparse.mockResolvedValue('head123');
      mockGitInstance.checkoutLocalBranch.mockRejectedValue(new Error('branch exists'));

      await expect(manager.createBranch('feature/dup')).rejects.toThrow('branch exists');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // checkout
  // ----------------------------------------------------------
  describe('checkout', () => {
    it('acquires lock, checks out branch, and releases lock', async () => {
      mockGitInstance.checkout.mockResolvedValue(undefined);

      await manager.checkout('develop');

      expect(gitLock.acquire).toHaveBeenCalledWith('checkout:develop');
      expect(mockGitInstance.checkout).toHaveBeenCalledWith('develop');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases lock on checkout failure', async () => {
      mockGitInstance.checkout.mockRejectedValue(new Error('no such branch'));

      await expect(manager.checkout('nonexistent')).rejects.toThrow('no such branch');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // add
  // ----------------------------------------------------------
  describe('add', () => {
    it('stages the specified files', async () => {
      mockGitInstance.add.mockResolvedValue(undefined);

      await manager.add(['a.ts', 'b.ts']);

      expect(mockGitInstance.add).toHaveBeenCalledWith(['a.ts', 'b.ts']);
    });

    it('does not acquire a lock', async () => {
      mockGitInstance.add.mockResolvedValue(undefined);

      await manager.add(['c.ts']);

      expect(gitLock.acquire).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // commit
  // ----------------------------------------------------------
  describe('commit', () => {
    it('commits with message and returns result (no files parameter)', async () => {
      mockGitInstance.commit.mockResolvedValue({
        commit: 'hash111',
        summary: { changes: 3 },
      });

      const result = await manager.commit('fix: stuff');

      expect(gitLock.acquire).toHaveBeenCalledWith('commit');
      expect(mockGitInstance.add).not.toHaveBeenCalled();
      expect(mockGitInstance.commit).toHaveBeenCalledWith('fix: stuff');
      expect(result).toEqual({ hash: 'hash111', message: 'fix: stuff', filesChanged: 3 });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('stages files first when files parameter is provided', async () => {
      mockGitInstance.add.mockResolvedValue(undefined);
      mockGitInstance.commit.mockResolvedValue({
        commit: 'hash222',
        summary: { changes: 1 },
      });

      const result = await manager.commit('feat: add file', ['new.ts']);

      expect(mockGitInstance.add).toHaveBeenCalledWith(['new.ts']);
      expect(result.hash).toBe('hash222');
      expect(result.filesChanged).toBe(1);
    });

    it('does not call add when files is an empty array', async () => {
      mockGitInstance.commit.mockResolvedValue({
        commit: 'hash333',
        summary: { changes: 0 },
      });

      await manager.commit('chore: empty', []);

      expect(mockGitInstance.add).not.toHaveBeenCalled();
    });

    it('does not call add when files is undefined', async () => {
      mockGitInstance.commit.mockResolvedValue({
        commit: 'hash-undef',
        summary: { changes: 0 },
      });

      await manager.commit('chore: no files', undefined);

      expect(mockGitInstance.add).not.toHaveBeenCalled();
    });

    it('releases lock on commit failure', async () => {
      mockGitInstance.commit.mockRejectedValue(new Error('nothing to commit'));

      await expect(manager.commit('oops')).rejects.toThrow('nothing to commit');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // commitChanges
  // ----------------------------------------------------------
  describe('commitChanges', () => {
    it('stages files, commits, and returns result', async () => {
      mockGitInstance.add.mockResolvedValue(undefined);
      mockGitInstance.commit.mockResolvedValue({
        commit: 'hash444',
        summary: { changes: 2 },
      });

      const result = await manager.commitChanges('docs: update', ['readme.md', 'guide.md']);

      expect(gitLock.acquire).toHaveBeenCalledWith('commitChanges');
      expect(mockGitInstance.add).toHaveBeenCalledWith(['readme.md', 'guide.md']);
      expect(mockGitInstance.commit).toHaveBeenCalledWith('docs: update');
      expect(result).toEqual({ hash: 'hash444', message: 'docs: update', filesChanged: 2 });
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases lock when add fails', async () => {
      mockGitInstance.add.mockRejectedValue(new Error('add error'));

      await expect(manager.commitChanges('msg', ['x.ts'])).rejects.toThrow('add error');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases lock when commit fails after successful add', async () => {
      mockGitInstance.add.mockResolvedValue(undefined);
      mockGitInstance.commit.mockRejectedValue(new Error('commit error'));

      await expect(manager.commitChanges('msg', ['x.ts'])).rejects.toThrow('commit error');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // merge
  // ----------------------------------------------------------
  describe('merge', () => {
    it('acquires lock, merges branch, and releases lock', async () => {
      mockGitInstance.merge.mockResolvedValue(undefined);

      await manager.merge('feature/done');

      expect(gitLock.acquire).toHaveBeenCalledWith('merge:feature/done');
      expect(mockGitInstance.merge).toHaveBeenCalledWith(['feature/done']);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases lock on merge conflict', async () => {
      mockGitInstance.merge.mockRejectedValue(new Error('CONFLICTS'));

      await expect(manager.merge('conflict-branch')).rejects.toThrow('CONFLICTS');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // mergeAndClose
  // ----------------------------------------------------------
  describe('mergeAndClose', () => {
    it('checks out main, merges, deletes branch, and releases lock', async () => {
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.merge.mockResolvedValue(undefined);
      mockGitInstance.deleteLocalBranch.mockResolvedValue(undefined);

      await manager.mergeAndClose('feature/old');

      expect(gitLock.acquire).toHaveBeenCalledWith('mergeAndClose:feature/old');
      expect(mockGitInstance.checkout).toHaveBeenCalledWith('main');
      expect(mockGitInstance.merge).toHaveBeenCalledWith(['feature/old']);
      expect(mockGitInstance.deleteLocalBranch).toHaveBeenCalledWith('feature/old');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('executes checkout, merge, delete in correct order', async () => {
      const callOrder: string[] = [];
      mockGitInstance.checkout.mockImplementation(async () => {
        callOrder.push('checkout');
      });
      mockGitInstance.merge.mockImplementation(async () => {
        callOrder.push('merge');
      });
      mockGitInstance.deleteLocalBranch.mockImplementation(async () => {
        callOrder.push('delete');
      });

      await manager.mergeAndClose('feature/order');

      expect(callOrder).toEqual(['checkout', 'merge', 'delete']);
    });

    it('releases lock when checkout fails', async () => {
      mockGitInstance.checkout.mockRejectedValue(new Error('checkout failed'));

      await expect(manager.mergeAndClose('branch')).rejects.toThrow('checkout failed');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases lock when merge fails mid-operation', async () => {
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.merge.mockRejectedValue(new Error('merge failed'));

      await expect(manager.mergeAndClose('branch')).rejects.toThrow('merge failed');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases lock when deleteLocalBranch fails', async () => {
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.merge.mockResolvedValue(undefined);
      mockGitInstance.deleteLocalBranch.mockRejectedValue(new Error('delete failed'));

      await expect(manager.mergeAndClose('branch')).rejects.toThrow('delete failed');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // deleteBranch
  // ----------------------------------------------------------
  describe('deleteBranch', () => {
    it('deletes branch without force by default', async () => {
      mockGitInstance.deleteLocalBranch.mockResolvedValue(undefined);

      await manager.deleteBranch('feature/stale');

      expect(gitLock.acquire).toHaveBeenCalledWith('deleteBranch:feature/stale');
      expect(mockGitInstance.deleteLocalBranch).toHaveBeenCalledWith('feature/stale');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('deletes branch with force=true', async () => {
      mockGitInstance.deleteLocalBranch.mockResolvedValue(undefined);

      await manager.deleteBranch('feature/unmerged', true);

      expect(mockGitInstance.deleteLocalBranch).toHaveBeenCalledWith('feature/unmerged', true);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('deletes branch with force=false explicitly', async () => {
      mockGitInstance.deleteLocalBranch.mockResolvedValue(undefined);

      await manager.deleteBranch('feature/safe', false);

      expect(mockGitInstance.deleteLocalBranch).toHaveBeenCalledWith('feature/safe');
    });

    it('releases lock when delete fails', async () => {
      mockGitInstance.deleteLocalBranch.mockRejectedValue(new Error('not fully merged'));

      await expect(manager.deleteBranch('feature/x')).rejects.toThrow('not fully merged');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // hasCommits
  // ----------------------------------------------------------
  describe('hasCommits', () => {
    it('returns true when there are commits ahead of base branch', async () => {
      mockGitInstance.log.mockResolvedValue({ total: 3, all: [] });

      const result = await manager.hasCommits('feature/x');

      expect(result).toBe(true);
      expect(mockGitInstance.log).toHaveBeenCalledWith(['main..feature/x']);
    });

    it('returns false when there are no commits', async () => {
      mockGitInstance.log.mockResolvedValue({ total: 0, all: [] });

      const result = await manager.hasCommits('feature/empty');
      expect(result).toBe(false);
    });

    it('uses custom baseBranch when provided', async () => {
      mockGitInstance.log.mockResolvedValue({ total: 1, all: [] });

      await manager.hasCommits('feature/y', 'develop');

      expect(mockGitInstance.log).toHaveBeenCalledWith(['develop..feature/y']);
    });

    it('returns false when git log throws an error', async () => {
      mockGitInstance.log.mockRejectedValue(new Error('unknown revision'));

      const result = await manager.hasCommits('nonexistent');
      expect(result).toBe(false);
    });

    it('does not acquire a lock', async () => {
      mockGitInstance.log.mockResolvedValue({ total: 0, all: [] });

      await manager.hasCommits('feature/z');

      expect(gitLock.acquire).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------
  // cherryPick
  // ----------------------------------------------------------
  describe('cherryPick', () => {
    it('returns empty array when no commits to cherry-pick', async () => {
      mockGitInstance.log.mockResolvedValue({ total: 0, all: [] });

      const result = await manager.cherryPick('feature/empty', 'release');

      expect(gitLock.acquire).toHaveBeenCalledWith('cherryPick:feature/empty->release');
      expect(result).toEqual([]);
      expect(mockGitInstance.checkout).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('cherry-picks single commit from source to target', async () => {
      mockGitInstance.log.mockResolvedValue({
        total: 1,
        all: [{ hash: 'commit1' }],
      });
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.raw.mockResolvedValue('');

      const result = await manager.cherryPick('feature/one', 'release');

      expect(mockGitInstance.checkout).toHaveBeenCalledWith('release');
      expect(mockGitInstance.raw).toHaveBeenCalledWith(['cherry-pick', 'commit1']);
      expect(result).toEqual(['commit1']);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('cherry-picks multiple commits in reverse order', async () => {
      mockGitInstance.log.mockResolvedValue({
        total: 3,
        all: [{ hash: 'newest' }, { hash: 'middle' }, { hash: 'oldest' }],
      });
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.raw.mockResolvedValue('');

      const result = await manager.cherryPick('feature/multi', 'release');

      // Commits should be reversed so oldest is applied first
      expect(mockGitInstance.raw).toHaveBeenCalledTimes(3);
      expect(mockGitInstance.raw).toHaveBeenNthCalledWith(1, ['cherry-pick', 'oldest']);
      expect(mockGitInstance.raw).toHaveBeenNthCalledWith(2, ['cherry-pick', 'middle']);
      expect(mockGitInstance.raw).toHaveBeenNthCalledWith(3, ['cherry-pick', 'newest']);
      // .reverse() mutates in-place, so returned array is reversed
      expect(result).toEqual(['oldest', 'middle', 'newest']);
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('uses main as the base branch for log', async () => {
      mockGitInstance.log.mockResolvedValue({ total: 0, all: [] });

      await manager.cherryPick('feature/a', 'target');

      expect(mockGitInstance.log).toHaveBeenCalledWith(['main..feature/a']);
    });

    it('releases lock when cherry-pick fails mid-way', async () => {
      mockGitInstance.log.mockResolvedValue({
        total: 2,
        all: [{ hash: 'c1' }, { hash: 'c2' }],
      });
      mockGitInstance.checkout.mockResolvedValue(undefined);
      mockGitInstance.raw
        .mockResolvedValueOnce('')
        .mockRejectedValueOnce(new Error('conflict during cherry-pick'));

      await expect(manager.cherryPick('src', 'dst')).rejects.toThrow('conflict during cherry-pick');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });

    it('releases lock when checkout fails', async () => {
      mockGitInstance.log.mockResolvedValue({
        total: 1,
        all: [{ hash: 'c1' }],
      });
      mockGitInstance.checkout.mockRejectedValue(new Error('checkout failed'));

      await expect(manager.cherryPick('src', 'dst')).rejects.toThrow('checkout failed');
      expect(mockRelease).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // init
  // ----------------------------------------------------------
  describe('init', () => {
    it('initializes a git repository', async () => {
      mockGitInstance.init.mockResolvedValue(undefined);

      await manager.init();

      expect(mockGitInstance.init).toHaveBeenCalledOnce();
    });
  });

  // ----------------------------------------------------------
  // branchExists
  // ----------------------------------------------------------
  describe('branchExists', () => {
    it('returns true when branch is in the list', async () => {
      mockGitInstance.branch.mockResolvedValue({
        current: 'main',
        all: ['main', 'develop', 'feature/x'],
        branches: {},
      });

      const result = await manager.branchExists('feature/x');
      expect(result).toBe(true);
    });

    it('returns false when branch is not in the list', async () => {
      mockGitInstance.branch.mockResolvedValue({
        current: 'main',
        all: ['main', 'develop'],
        branches: {},
      });

      const result = await manager.branchExists('feature/nope');
      expect(result).toBe(false);
    });

    it('delegates to getBranches internally', async () => {
      mockGitInstance.branch.mockResolvedValue({
        current: 'main',
        all: [],
        branches: {},
      });

      await manager.branchExists('any');

      expect(mockGitInstance.branch).toHaveBeenCalledWith(['-a']);
    });
  });
});
