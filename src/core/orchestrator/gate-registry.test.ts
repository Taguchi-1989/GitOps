/**
 * FlowOps - Acceptance Gate Registry Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gateRegistry } from './gate-registry';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);
const mockReaddir = vi.mocked(fs.readdir);

const gateYaml = `
id: safety-review-gate
version: "1.0.0"
title: gate
appliesTo:
  taskId: hazard-identification
ruleRefs: [iso-12100-coverage-check]
policy: {}
metadata:
  author: safety-team
  description: gate
`;

describe('gateRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gateRegistry.clear();
    mockReaddir.mockResolvedValue(['safety-review-gate.yaml'] as never);
    mockReadFile.mockResolvedValue(gateYaml);
  });

  it('getGateForTask returns the gate whose appliesTo.taskId matches', async () => {
    const gate = await gateRegistry.getGateForTask('hazard-identification');
    expect(gate?.id).toBe('safety-review-gate');
    // policy defaults applied from {}
    expect(gate?.policy.onCritical).toBe('stop');
  });

  it('getGateForTask returns null when no gate matches', async () => {
    const gate = await gateRegistry.getGateForTask('unrelated-task');
    expect(gate).toBeNull();
  });
});
