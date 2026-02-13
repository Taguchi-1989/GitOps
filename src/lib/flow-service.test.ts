import { describe, it, expect } from 'vitest';
import { sanitizeFlowId } from './api-utils';

describe('sanitizeFlowId', () => {
  it('accepts valid flow IDs', () => {
    expect(sanitizeFlowId('order-process')).toBe('order-process');
    expect(sanitizeFlowId('test_flow')).toBe('test_flow');
    expect(sanitizeFlowId('flow123')).toBe('flow123');
    expect(sanitizeFlowId('MyFlow')).toBe('MyFlow');
  });

  it('rejects path traversal attempts', () => {
    expect(sanitizeFlowId('../etc/passwd')).toBeNull();
    expect(sanitizeFlowId('../../secret')).toBeNull();
    expect(sanitizeFlowId('..\\windows\\system32')).toBeNull();
  });

  it('rejects IDs with slashes', () => {
    expect(sanitizeFlowId('path/to/file')).toBeNull();
    expect(sanitizeFlowId('path\\to\\file')).toBeNull();
  });

  it('rejects IDs with dots', () => {
    expect(sanitizeFlowId('file.yaml')).toBeNull();
    expect(sanitizeFlowId('.hidden')).toBeNull();
  });

  it('rejects empty string', () => {
    expect(sanitizeFlowId('')).toBeNull();
  });

  it('rejects IDs with special characters', () => {
    expect(sanitizeFlowId('flow id')).toBeNull();
    expect(sanitizeFlowId('flow@id')).toBeNull();
    expect(sanitizeFlowId('flow;id')).toBeNull();
  });
});
