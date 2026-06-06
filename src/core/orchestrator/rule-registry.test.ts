/**
 * FlowOps - Validation Rule Registry Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ruleRegistry } from './rule-registry';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);
const mockReaddir = vi.mocked(fs.readdir);

function ruleYaml(id: string, taskId: string) {
  return `
id: ${id}
version: "1.0.0"
title: ${id}
ruleType: completeness
severity: warning
appliesTo:
  taskId: ${taskId}
  outputField: out
ruleLogic:
  field: out[].category
metadata:
  author: system
  description: test
`;
}

describe('ruleRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ruleRegistry.clear();
    mockReaddir.mockResolvedValue(['rule-a.yaml', 'rule-b.yaml'] as never);
    mockReadFile.mockImplementation(async p => {
      if (String(p).includes('rule-a')) return ruleYaml('rule-a', 'hazard-identification');
      if (String(p).includes('rule-b')) return ruleYaml('rule-b', 'other-task');
      throw new Error('ENOENT');
    });
  });

  it('getRulesForTask returns only rules whose appliesTo.taskId matches', async () => {
    const rules = await ruleRegistry.getRulesForTask('hazard-identification');
    expect(rules.map(r => r.id)).toEqual(['rule-a']);
  });

  it('getRulesForTask returns empty for an unknown task', async () => {
    const rules = await ruleRegistry.getRulesForTask('nonexistent');
    expect(rules).toEqual([]);
  });

  it('getRulesByIds preserves order and skips missing ids', async () => {
    const rules = await ruleRegistry.getRulesByIds(['rule-b', 'ghost', 'rule-a']);
    expect(rules.map(r => r.id)).toEqual(['rule-b', 'rule-a']);
  });

  it('getRule returns null for a missing rule', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    expect(await ruleRegistry.getRule('ghost')).toBeNull();
  });
});
