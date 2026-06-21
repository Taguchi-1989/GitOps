/**
 * FlowOps - Case Signature (ガバナンス・ハーネス §5.1.1)
 *
 * 案件の「同型性」を決定論的に表すシグネチャを計算する。
 * 同じ特徴を持つ案件は同じシグネチャ → 前例マッチングのキーになる。
 * キー順非依存のハッシュ（audit/hash の stableStringify）を再利用する。
 */

import { hashContent } from '../audit';

/**
 * 案件特徴からシグネチャを計算する。
 * features には「案件の同一性を定める安定した特徴」のみを入れる
 * （タイムスタンプや決定内容など可変な値は入れない）。
 */
export function caseSignature(features: Record<string, unknown>): string {
  // hashContent はキー順非依存の sha256。null/undefined は空シグネチャにせず固定値へ。
  return hashContent(features) ?? hashContent({ __empty__: true })!;
}

/**
 * 承認リクエストの context から、前例同定に使う特徴を抽出する。
 * context.caseFeatures が明示されていればそれを、無ければ context 全体を用いる。
 * 決定や時刻など可変フィールドは呼び出し側で caseFeatures に含めない運用とする。
 *
 * ⚠ 信頼境界（重要 / セキュリティレビュー指摘）:
 * シグネチャは caseFeatures の中身だけで決まる。前例自動承認(§5.1.1)の「同型性」は
 * この特徴選択の質に等しい。したがって caseFeatures は
 *   - **システムが案件の実体から導出した特徴**であること（自由入力のユーザ値を直接入れない）。
 *   - 案件の本質を区別するに足る粒度（粗すぎる特徴は別案件を同型と誤認させる）。
 * を満たす必要がある。粗い/外部操作可能な特徴は「前例の事前仕込み」攻撃を許す。
 * 呼び出し側はシステム割当の caseType 等を含め、エンドユーザ入力をそのまま渡さないこと。
 */
export function signatureFromContext(context: Record<string, unknown>): string {
  const features =
    context.caseFeatures && typeof context.caseFeatures === 'object'
      ? (context.caseFeatures as Record<string, unknown>)
      : context;
  return caseSignature(features);
}
