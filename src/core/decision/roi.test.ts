/**
 * FlowOps - ROI / IRR Engine Tests (golden values)
 *
 * 手計算で確定した既知値に固定し、決定論性と HTML 埋込JS とのパリティを担保する。
 */

import { describe, it, expect } from 'vitest';
import { computeRoi, straightLineDepreciation, npv, irr, paybackYears } from './roi';
import { RoiInputs } from './roi-schema';

const base: RoiInputs = {
  investment: 1_000_000,
  salvageRate: 0,
  depreciationYears: 5,
  maintenanceRate: 0,
  discountRate: 0,
  taxRate: 0,
  horizonYears: 5,
  laborReduction: 0,
  wagePerPersonYear: 0,
  baselineUnitPrice: 0,
  improvedUnitPrice: 0,
  annualVolume: 0,
  addedValuePerYear: 0,
  negativeImpactPerYear: 0,
};

describe('helpers', () => {
  it('straightLineDepreciation: inside vs outside the period', () => {
    expect(straightLineDepreciation(1_000_000, 0, 5, 1)).toBe(200_000);
    expect(straightLineDepreciation(1_000_000, 0, 5, 5)).toBe(200_000);
    expect(straightLineDepreciation(1_000_000, 0, 5, 6)).toBe(0);
    expect(straightLineDepreciation(1_000_000, 0.1, 5, 1)).toBe(180_000); // salvage 10%
    expect(straightLineDepreciation(1_000_000, 0, 0, 1)).toBe(0); // years 0 guard
  });

  it('npv at rate 0 equals the simple sum', () => {
    expect(npv(0, [-1_000_000, 300_000, 300_000, 300_000, 300_000, 300_000])).toBeCloseTo(
      500_000,
      6
    );
  });

  it('irr returns null when there is no sign change', () => {
    expect(irr([-1_000_000, -100_000, -100_000])).toBeNull();
  });

  it('irr drives npv to ~0', () => {
    const cf = [-1_000_000, 300_000, 300_000, 300_000, 300_000, 300_000];
    const r = irr(cf);
    expect(r).not.toBeNull();
    expect(r as number).toBeGreaterThan(0.1);
    expect(r as number).toBeLessThan(0.2);
    expect(npv(r as number, cf)).toBeCloseTo(0, 2);
  });

  it('paybackYears interpolates the crossing year', () => {
    // cumulative: y0 -1e6, y1 -.7, y2 -.4, y3 -.1, y4 +.2, y5 +.5 (×1e6)
    expect(paybackYears([-1_000_000, -700_000, -400_000, -100_000, 200_000, 500_000])).toBeCloseTo(
      3.3333,
      3
    );
    expect(paybackYears([-1_000_000, -900_000, -800_000])).toBeNull();
  });
});

describe('computeRoi — Scenario A (no tax, added value only)', () => {
  const r = computeRoi({ ...base, addedValuePerYear: 300_000 });

  it('annual benefit and accounting profit', () => {
    expect(r.annualBenefit).toBe(300_000);
    expect(r.annualDepreciation).toBe(200_000);
    expect(r.annualAccountingProfit).toBe(100_000); // 300k - dep 200k
  });

  it('ROI metrics', () => {
    expect(r.roiAnnual).toBeCloseTo(0.1, 6);
    expect(r.roiTotal).toBeCloseTo(0.5, 6); // (1.5M - 1M)/1M
    expect(r.npv).toBeCloseTo(500_000, 6); // discount 0
  });

  it('payback and IRR', () => {
    expect(r.paybackYears).toBeCloseTo(3.3333, 3);
    expect(r.irr).not.toBeNull();
    expect(r.irr as number).toBeGreaterThan(0.1);
  });

  it('rows include year 0 investment outflow', () => {
    expect(r.rows[0]).toMatchObject({ year: 0, netCashflow: -1_000_000 });
    expect(r.rows).toHaveLength(6);
  });
});

describe('computeRoi — Scenario B (negative benefit → no payback, no IRR)', () => {
  const r = computeRoi({ ...base, negativeImpactPerYear: 100_000 });

  it('benefit is negative and never recovers', () => {
    expect(r.annualBenefit).toBe(-100_000);
    expect(r.paybackYears).toBeNull();
    expect(r.irr).toBeNull();
    expect(r.npv).toBeCloseTo(-1_500_000, 6);
  });
});

describe('computeRoi — Scenario C (tax + depreciation shield)', () => {
  const r = computeRoi({ ...base, taxRate: 0.3, addedValuePerYear: 500_000 });

  it('tax uses depreciation shield', () => {
    // taxableIncome = 500k - dep 200k = 300k; tax = 90k
    expect(r.rows[1].tax).toBeCloseTo(90_000, 6);
    expect(r.rows[1].netCashflow).toBeCloseTo(410_000, 6);
    expect(r.annualAccountingProfit).toBeCloseTo(210_000, 6);
  });

  it('ROI total and payback', () => {
    expect(r.roiTotal).toBeCloseTo(1.05, 6); // (2.05M - 1M)/1M
    expect(r.paybackYears).toBeCloseTo(2.439, 2);
  });
});

describe('computeRoi — Scenario E (horizon shorter than depreciation period)', () => {
  const r = computeRoi({
    ...base,
    horizonYears: 3,
    depreciationYears: 5,
    addedValuePerYear: 300_000,
  });

  it('keeps depreciation at the full-period rate within the horizon', () => {
    // dep = 1,000,000 / 5 = 200,000 for years 1..3 (period not yet complete)
    expect(r.rows.filter(row => row.year >= 1).every(row => row.depreciation === 200_000)).toBe(
      true
    );
    expect(r.rows).toHaveLength(4); // year 0..3
  });

  it('does not reach payback within the short horizon', () => {
    // cumulative: y0 -1M, y1 -700k, y2 -400k, y3 -100k → never >= 0
    expect(r.paybackYears).toBeNull();
    expect(r.rows[3].cumulativeCashflow).toBeCloseTo(-100_000, 6);
  });
});

describe('computeRoi — Scenario D (labor + unit price drivers)', () => {
  it('sums labor saving and revenue gain', () => {
    const r = computeRoi({
      ...base,
      laborReduction: 2,
      wagePerPersonYear: 5_000_000,
      baselineUnitPrice: 1_000,
      improvedUnitPrice: 1_200,
      annualVolume: 100_000,
    });
    // labor 10,000,000 + revenue (200 * 100,000)=20,000,000 = 30,000,000
    expect(r.annualBenefit).toBe(30_000_000);
  });
});
