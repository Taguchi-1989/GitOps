/**
 * FlowOps - Assumption Loader Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadAssumptionSet,
  listAssumptionSets,
  resolveAssumptions,
  AssumptionLoadError,
} from './assumption-loader';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

const mockReadFile = vi.mocked(fs.readFile);
const mockReaddir = vi.mocked(fs.readdir);

const validSetYaml = `
id: safety-review-assumptions
version: "1.0.0"
title: 安全レビューの前提
assumptions:
  - id: min-coverage
    statement: ISO 12100の10カテゴリの80%以上を検討する
    source: ISO 12100:2010
  - id: worst-case
    statement: ワーストケースで見積もる
metadata:
  author: safety-team
  description: assumptions
`;

describe('loadAssumptionSet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads and validates a valid assumption set', async () => {
    mockReadFile.mockResolvedValue(validSetYaml);
    const set = await loadAssumptionSet('safety-review-assumptions');
    expect(set.assumptions).toHaveLength(2);
    expect(set.assumptions[0].id).toBe('min-coverage');
  });

  it('throws FILE_NOT_FOUND when missing', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));
    try {
      await loadAssumptionSet('nope');
    } catch (e) {
      expect((e as AssumptionLoadError).code).toBe('FILE_NOT_FOUND');
    }
  });
});

describe('listAssumptionSets', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists assumption set ids', async () => {
    mockReaddir.mockResolvedValue(['safety-review-assumptions.yaml'] as never);
    expect(await listAssumptionSets()).toEqual(['safety-review-assumptions']);
  });
});

describe('resolveAssumptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flattens assumptions across sets and skips broken ones', async () => {
    mockReadFile.mockImplementation(async p => {
      if (String(p).includes('safety-review-assumptions')) return validSetYaml;
      throw new Error('ENOENT');
    });

    const resolved = await resolveAssumptions(['safety-review-assumptions', 'ghost']);
    expect(resolved).toHaveLength(2);
    expect(resolved[0]).toMatchObject({
      setId: 'safety-review-assumptions',
      setVersion: '1.0.0',
      id: 'min-coverage',
    });
  });
});
