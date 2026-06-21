/**
 * FlowOps - Ingress Policy Loader Tests (POL-1 / POL-2 / fail-safe)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import { loadIngressPolicy, DEFAULT_INGRESS_POLICY, IngressPolicyLoadError } from './policy-loader';
import { IngressPolicySchema } from './types';

describe('DEFAULT_INGRESS_POLICY', () => {
  it('はスキーマ検証を通る（version 付き・パターン非空）', () => {
    expect(() => IngressPolicySchema.parse(DEFAULT_INGRESS_POLICY)).not.toThrow();
    expect(DEFAULT_INGRESS_POLICY.version).toBe('1.0.0');
    expect(DEFAULT_INGRESS_POLICY.patterns.length).toBeGreaterThan(0);
  });

  it('は failSafe が block 固定（POL-3 危険側フォールバック禁止）', () => {
    expect(DEFAULT_INGRESS_POLICY.failSafe).toBe('block');
  });
});

describe('loadIngressPolicy', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ファイル不在なら組込み既定へフォールバック（素通しにしない）', async () => {
    vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
    const policy = await loadIngressPolicy('does-not-exist');
    expect(policy).toEqual(DEFAULT_INGRESS_POLICY);
  });

  it('spec/gates の実ファイルを読み込める（id/version 整合）', async () => {
    const policy = await loadIngressPolicy('ingress-secret-gate');
    expect(policy.id).toBe('ingress-secret-gate');
    expect(policy.version).toBe('1.0.0');
    expect(policy.patterns.some(p => p.id === 'aws-access-key' && p.kind === 'value')).toBe(true);
  });

  it('壊れたYAMLは黙って既定に落とさずエラー（隠蔽防止）', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue('id: x\n  : : :bad');
    await expect(loadIngressPolicy('broken')).rejects.toBeInstanceOf(IngressPolicyLoadError);
  });

  it('スキーマ違反（failSafe が block 以外）は VALIDATION_ERROR', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue(
      'id: bad\nversion: "1.0.0"\nfailSafe: allow\npatterns: []\n'
    );
    await expect(loadIngressPolicy('bad')).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('組込み既定と spec/gates YAML の一致', () => {
  it('はパターンid集合が一致する（二重管理の乖離検知）', async () => {
    const fromFile = await loadIngressPolicy('ingress-secret-gate');
    const fileIds = fromFile.patterns.map(p => p.id).sort();
    const defaultIds = DEFAULT_INGRESS_POLICY.patterns.map(p => p.id).sort();
    expect(fileIds).toEqual(defaultIds);
  });
});
