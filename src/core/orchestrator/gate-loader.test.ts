/**
 * FlowOps - Acceptance Gate Loader Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadGate, listGates, GateLoadError } from './gate-loader';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);
const mockReaddir = vi.mocked(fs.readdir);

const validGateYaml = `
id: safety-review-gate
version: "1.0.0"
title: 安全レビュー受入ゲート
appliesTo:
  taskId: hazard-identification
ruleRefs:
  - iso-12100-coverage-check
policy:
  onCritical: stop
  onError: hold
  onWarning: revise
  allPassed: go
  noRulesMatched: watch
metadata:
  author: safety-team
  description: gate
`;

describe('loadGate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads and validates a valid gate YAML', async () => {
    mockReadFile.mockResolvedValue(validGateYaml);
    const gate = await loadGate('safety-review-gate');
    expect(gate.id).toBe('safety-review-gate');
    expect(gate.appliesTo.taskId).toBe('hazard-identification');
    expect(gate.policy.onWarning).toBe('revise');
    expect(gate.ruleRefs).toEqual(['iso-12100-coverage-check']);
  });

  it('throws FILE_NOT_FOUND when the file is missing', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    try {
      await loadGate('nope');
    } catch (e) {
      expect((e as GateLoadError).code).toBe('FILE_NOT_FOUND');
    }
  });

  it('throws VALIDATION_ERROR when id mismatches filename', async () => {
    mockReadFile.mockResolvedValue(validGateYaml);
    try {
      await loadGate('wrong');
    } catch (e) {
      expect((e as GateLoadError).code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('listGates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists gate ids', async () => {
    mockReaddir.mockResolvedValue(['safety-review-gate.yaml', 'notes.txt'] as never);
    expect(await listGates()).toEqual(['safety-review-gate']);
  });

  it('returns empty array when dir missing', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
    expect(await listGates()).toEqual([]);
  });
});
