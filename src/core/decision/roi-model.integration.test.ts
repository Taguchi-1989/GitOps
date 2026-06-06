/**
 * FlowOps - ROI Model Integration Test
 *
 * 実際の spec/decision-models/roi-v0.yaml と spec/assumptions/roi-baseline-assumptions.yaml
 * をロードし、スキーマ適合・既定値で有限な指標が出ることを担保する（fsはモックしない）。
 */

import { describe, it, expect } from 'vitest';
import { loadRoiModel } from './roi-loader';
import { computeRoi } from './roi';
import { resolveAssumptions } from '../orchestrator/assumption-loader';

describe('roi-v0 model (real spec files)', () => {
  it('loads and validates against the schema', async () => {
    const model = await loadRoiModel('roi-v0');
    expect(model.id).toBe('roi-v0');
    expect(model.sliders.length).toBeGreaterThan(0);
    expect(model.formulas.length).toBeGreaterThan(0);
    // すべてのスライダーキーが defaults に存在する
    for (const s of model.sliders) {
      expect(model.defaults).toHaveProperty(s.key);
    }
  });

  it('produces finite metrics from the defaults', async () => {
    const model = await loadRoiModel('roi-v0');
    const result = computeRoi(model.defaults);
    expect(Number.isFinite(result.annualBenefit)).toBe(true);
    expect(Number.isFinite(result.npv)).toBe(true);
    expect(Number.isFinite(result.roiTotal)).toBe(true);
    expect(result.rows).toHaveLength(model.defaults.horizonYears + 1);
  });

  it('resolves the referenced assumptions', async () => {
    const model = await loadRoiModel('roi-v0');
    const resolved = await resolveAssumptions(model.assumptionRefs ?? []);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved[0]).toHaveProperty('statement');
  });
});
