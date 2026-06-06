/**
 * FlowOps - ROI / IRR Deterministic Engine
 *
 * 投資判断の決定論的試算。LLM を使わない純関数群。
 * 同じ入力には同じ出力（監査可能・再現可能）。最終判断は人が行う。
 *
 * 注意: この TS 実装は正本。生成される単体HTML（roi-html.ts）の埋込JSは
 *   この関数群の忠実な移植であり、roi.test.ts の golden 値で一致を担保する。
 */

import { RoiInputs, RoiResult, RoiYearRow } from './roi-schema';

/**
 * 定額法による t 年目の償却費（償却期間外は 0）
 *   dep_t = (investment − salvage) / years   (1 ≤ t ≤ years)
 */
export function straightLineDepreciation(
  investment: number,
  salvageRate: number,
  years: number,
  t: number
): number {
  if (years <= 0) return 0;
  if (t < 1 || t > years) return 0;
  const salvage = investment * salvageRate;
  return (investment - salvage) / years;
}

/**
 * 正味現在価値
 *   NPV = Σ_{t=0..N} CF_t / (1 + rate)^t
 */
export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
}

/**
 * 内部収益率（二分法）。範囲内で符号反転が無ければ null（解なし）。
 */
export function irr(cashflows: number[]): number | null {
  const f = (r: number) => npv(r, cashflows);
  let lo = -0.9999;
  let hi = 10;
  let flo = f(lo);
  let fhi = f(hi);

  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return null;
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return null; // 符号反転なし＝範囲内に解なし

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-7 || (hi - lo) / 2 < 1e-9) return mid;
    if (flo * fm < 0) {
      hi = mid;
      fhi = fm;
    } else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

/**
 * 回収年数（累積キャッシュフローが初めて 0 以上になる年, 線形補間）。
 * 期間内に達しなければ null。
 */
export function paybackYears(cumulative: number[]): number | null {
  for (let t = 1; t < cumulative.length; t++) {
    if (cumulative[t] >= 0) {
      const prev = cumulative[t - 1];
      const cur = cumulative[t];
      if (cur === prev) return t;
      const frac = -prev / (cur - prev); // prev < 0 <= cur
      return t - 1 + Math.min(Math.max(frac, 0), 1);
    }
  }
  return null;
}

/**
 * ROI 試算を計算する。
 */
export function computeRoi(inputs: RoiInputs): RoiResult {
  const {
    investment,
    salvageRate,
    depreciationYears,
    maintenanceRate,
    discountRate,
    taxRate,
    horizonYears,
    laborReduction,
    wagePerPersonYear,
    baselineUnitPrice,
    improvedUnitPrice,
    annualVolume,
    addedValuePerYear,
    negativeImpactPerYear,
  } = inputs;

  const salvage = investment * salvageRate;
  const maintenance = investment * maintenanceRate;

  // 年間便益 = 人件費削減 + 売上増(単価差×数量) + 付加価値 − 負の差分
  const laborSaving = laborReduction * wagePerPersonYear;
  const revenueGain = (improvedUnitPrice - baselineUnitPrice) * annualVolume;
  const annualBenefit = laborSaving + revenueGain + addedValuePerYear - negativeImpactPerYear;

  const rows: RoiYearRow[] = [];
  const cashflows: number[] = [];

  // 年0: 投資の流出
  let cumulative = -investment;
  cashflows.push(-investment);
  rows.push({
    year: 0,
    benefit: 0,
    maintenance: 0,
    depreciation: 0,
    taxableIncome: 0,
    tax: 0,
    netCashflow: -investment,
    cumulativeCashflow: cumulative,
    discountedCashflow: -investment,
  });

  let annualAccountingProfit = 0;
  for (let t = 1; t <= horizonYears; t++) {
    const dep = straightLineDepreciation(investment, salvageRate, depreciationYears, t);
    const taxableIncome = annualBenefit - maintenance - dep;
    const tax = Math.max(0, taxableIncome) * taxRate;
    let netCf = annualBenefit - maintenance - tax;
    if (t === horizonYears) netCf += salvage; // 残存価額の回収
    cumulative += netCf;
    cashflows.push(netCf);
    rows.push({
      year: t,
      benefit: annualBenefit,
      maintenance,
      depreciation: dep,
      taxableIncome,
      tax,
      netCashflow: netCf,
      cumulativeCashflow: cumulative,
      discountedCashflow: netCf / Math.pow(1 + discountRate, t),
    });
    if (t === 1) {
      annualAccountingProfit = annualBenefit - maintenance - dep - tax;
    }
  }

  const cumulativeArr = rows.map(r => r.cumulativeCashflow);
  const totalNet = rows.slice(1).reduce((a, r) => a + r.netCashflow, 0);
  const roiTotal = investment > 0 ? (totalNet - investment) / investment : 0;
  const roiAnnual = investment > 0 ? annualAccountingProfit / investment : 0;

  return {
    annualBenefit,
    maintenance,
    annualDepreciation: straightLineDepreciation(investment, salvageRate, depreciationYears, 1),
    annualAccountingProfit,
    rows,
    roiAnnual,
    roiTotal,
    npv: npv(discountRate, cashflows),
    irr: irr(cashflows),
    paybackYears: paybackYears(cumulativeArr),
  };
}
