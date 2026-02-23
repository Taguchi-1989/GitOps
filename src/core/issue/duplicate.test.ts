import { describe, it, expect } from 'vitest';
import {
  canMergeDuplicate,
  validateDuplicateMergeTransition,
  generateDuplicateMergeSummary,
} from './duplicate';

describe('canMergeDuplicate', () => {
  it('allows merging new issue into in-progress canonical', () => {
    const result = canMergeDuplicate('new', 'in-progress');
    expect(result.allowed).toBe(true);
  });

  it('rejects already merged-duplicate issue', () => {
    const result = canMergeDuplicate('merged-duplicate', 'new');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('already merged');
  });

  it('rejects already merged issue', () => {
    const result = canMergeDuplicate('merged', 'new');
    expect(result.allowed).toBe(false);
  });

  it('rejects when canonical is closed (merged)', () => {
    const result = canMergeDuplicate('new', 'merged');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('closed');
  });

  it('rejects when canonical is closed (rejected)', () => {
    const result = canMergeDuplicate('new', 'rejected');
    expect(result.allowed).toBe(false);
  });

  it('rejects when canonical is itself a duplicate', () => {
    const result = canMergeDuplicate('new', 'merged-duplicate');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('itself a duplicate');
  });
});

describe('validateDuplicateMergeTransition', () => {
  it('allows transition from valid statuses', () => {
    expect(validateDuplicateMergeTransition('new')).toBe(true);
    expect(validateDuplicateMergeTransition('triage')).toBe(true);
    expect(validateDuplicateMergeTransition('in-progress')).toBe(true);
    expect(validateDuplicateMergeTransition('proposed')).toBe(true);
  });

  it('rejects transition from terminal statuses', () => {
    expect(validateDuplicateMergeTransition('merged')).toBe(false);
    expect(validateDuplicateMergeTransition('rejected')).toBe(false);
    expect(validateDuplicateMergeTransition('merged-duplicate')).toBe(false);
  });
});

describe('generateDuplicateMergeSummary', () => {
  it('generates summary with cherry-picked commits', () => {
    const summary = generateDuplicateMergeSummary('ISS-002', 'ISS-001', 3);
    expect(summary).toContain('ISS-002');
    expect(summary).toContain('ISS-001');
    expect(summary).toContain('3 cherry-picked');
  });

  it('generates summary without commits', () => {
    const summary = generateDuplicateMergeSummary('ISS-002', 'ISS-001', 0);
    expect(summary).toContain('no commits');
  });
});
