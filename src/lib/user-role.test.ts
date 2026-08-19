import { describe, expect, it } from 'vitest';
import { canWrite, isAdmin, normalizeRole, ROLE_LABELS } from './user-role';

describe('normalizeRole', () => {
  it('keeps known roles', () => {
    expect(normalizeRole('admin')).toBe('admin');
    expect(normalizeRole('editor')).toBe('editor');
    expect(normalizeRole('viewer')).toBe('viewer');
  });

  it('falls back to viewer for unknown or missing values', () => {
    expect(normalizeRole(undefined)).toBe('viewer');
    expect(normalizeRole(null)).toBe('viewer');
    expect(normalizeRole('')).toBe('viewer');
    expect(normalizeRole('superuser')).toBe('viewer');
    expect(normalizeRole(42)).toBe('viewer');
  });
});

describe('canWrite', () => {
  // proxy.ts の WRITE_ROLES と同じ集合であること
  it('allows admin and editor only', () => {
    expect(canWrite('admin')).toBe(true);
    expect(canWrite('editor')).toBe(true);
    expect(canWrite('viewer')).toBe(false);
  });
});

describe('isAdmin', () => {
  it('is true only for admin', () => {
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('editor')).toBe(false);
    expect(isAdmin('viewer')).toBe(false);
  });
});

describe('ROLE_LABELS', () => {
  it('has a Japanese label for every role', () => {
    expect(ROLE_LABELS.admin).toBeTruthy();
    expect(ROLE_LABELS.editor).toBeTruthy();
    expect(ROLE_LABELS.viewer).toBeTruthy();
  });
});
