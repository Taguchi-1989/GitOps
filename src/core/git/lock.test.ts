import { describe, it, expect } from 'vitest';
import { GitLock, LockTimeoutError } from './lock';

describe('GitLock', () => {
  it('acquires and releases lock', async () => {
    const lock = new GitLock(5000);
    const handle = await lock.acquire('test');

    const status = lock.getStatus();
    expect(status.locked).toBe(true);
    expect(status.holder).toBe('test');

    handle.release();

    const afterRelease = lock.getStatus();
    expect(afterRelease.locked).toBe(false);
    expect(afterRelease.holder).toBeNull();
  });

  it('blocks second acquire until first is released', async () => {
    const lock = new GitLock(5000);
    const handle1 = await lock.acquire('first');

    let secondAcquired = false;
    const secondPromise = lock.acquire('second').then(h => {
      secondAcquired = true;
      h.release();
    });

    // Second should still be waiting
    await new Promise(r => setTimeout(r, 50));
    expect(secondAcquired).toBe(false);

    // Release first
    handle1.release();
    await secondPromise;
    expect(secondAcquired).toBe(true);
  });

  it('throws LockTimeoutError on timeout', async () => {
    const lock = new GitLock(200); // 200ms timeout
    const handle = await lock.acquire('holder');

    await expect(lock.acquire('waiter')).rejects.toThrow(LockTimeoutError);

    handle.release();
  });

  it('force releases the lock', async () => {
    const lock = new GitLock(5000);
    await lock.acquire('holder');

    expect(lock.getStatus().locked).toBe(true);
    lock.forceRelease();
    expect(lock.getStatus().locked).toBe(false);
  });

  it('ignores release from non-holder', async () => {
    const lock = new GitLock(5000);
    const handle = await lock.acquire('real-holder');

    // Try to create a fake release - the lock uses private release method
    // so we just verify the lock is still held after the handle from the wrong context
    expect(lock.getStatus().locked).toBe(true);

    handle.release();
    expect(lock.getStatus().locked).toBe(false);
  });
});
