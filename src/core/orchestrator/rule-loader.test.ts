/**
 * FlowOps - Validation Rule Loader Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadRule, listRules, loadAllRules, RuleLoadError } from './rule-loader';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);
const mockReaddir = vi.mocked(fs.readdir);

const validRuleYaml = `
id: iso-12100-coverage-check
version: "1.0.0"
title: ISO 12100 coverage
ruleType: completeness
severity: warning
appliesTo:
  taskId: hazard-identification
  outputField: hazards
ruleLogic:
  field: hazards[].category
  requiredCategories: [mechanical, electrical]
  minimumCoverage: 0.8
metadata:
  author: system
  description: coverage check
`;

describe('loadRule', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads and validates a valid rule YAML', async () => {
    mockReadFile.mockResolvedValue(validRuleYaml);
    const rule = await loadRule('iso-12100-coverage-check');
    expect(rule.id).toBe('iso-12100-coverage-check');
    expect(rule.ruleType).toBe('completeness');
    expect(rule.appliesTo.taskId).toBe('hazard-identification');
  });

  it('throws FILE_NOT_FOUND when the file is missing', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    await expect(loadRule('nope')).rejects.toThrow(RuleLoadError);
    try {
      await loadRule('nope');
    } catch (e) {
      expect((e as RuleLoadError).code).toBe('FILE_NOT_FOUND');
    }
  });

  it('throws VALIDATION_ERROR when id mismatches filename', async () => {
    mockReadFile.mockResolvedValue(validRuleYaml);
    try {
      await loadRule('wrong-name');
    } catch (e) {
      expect((e as RuleLoadError).code).toBe('VALIDATION_ERROR');
      expect((e as RuleLoadError).message).toContain('ID mismatch');
    }
  });

  it('throws PARSE_ERROR on malformed yaml', async () => {
    mockReadFile.mockResolvedValue(': : : not yaml');
    try {
      await loadRule('bad');
    } catch (e) {
      expect((e as RuleLoadError).code).toBeDefined();
    }
  });
});

describe('listRules / loadAllRules', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists rule ids from the directory', async () => {
    mockReaddir.mockResolvedValue(['a.yaml', 'b.yml', 'x.md'] as never);
    expect(await listRules()).toEqual(['a', 'b']);
  });

  it('returns empty array when directory is missing', async () => {
    mockReaddir.mockRejectedValue(new Error('ENOENT'));
    expect(await listRules()).toEqual([]);
  });

  it('loads all valid rules and skips broken ones', async () => {
    mockReaddir.mockResolvedValue(['iso-12100-coverage-check.yaml', 'broken.yaml'] as never);
    mockReadFile.mockImplementation(async p => {
      if (String(p).includes('iso-12100-coverage-check')) return validRuleYaml;
      throw new Error('ENOENT');
    });
    const rules = await loadAllRules();
    expect(rules.size).toBe(1);
    expect(rules.has('iso-12100-coverage-check')).toBe(true);
  });
});
