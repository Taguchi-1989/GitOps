/**
 * FlowOps - Egress Gate Types (ガバナンス・ハーネス §4.2 出口ゲート)
 *
 * ハーネス出力（LLM生成の提案＝intent + patches）を検査する独立検出系。
 * 入口ゲート(§4.1)とは「多様性のある独立検出系」として別ロジックで実装する（OUTG-2）。
 * - 入口: ポリシー駆動の正規表現でマスク/ブロックを決める
 * - 出口: ルール＋エントロピーで finding を分類し pass/flag/block を決める（手法を変える）
 *
 * 位置づけ（OUTG-3）: 本ゲートは「既知危険の確率的削減」＋「入口の誤り検知」であり、
 * ゼロデイ（未知の悪意あるコード）検出を担保しない。安全性そのものは謳わない。
 */

// 検出カテゴリ（既知危険の型）
export type EgressCategory =
  | 'secret' // 出力に混入した資格情報・鍵（入口の取りこぼし or LLMの反射）
  | 'high-entropy' // 高エントロピー文字列（未知形式の秘密の疑い）
  | 'command-injection' // シェル/SQL 破壊的コマンド片
  | 'path-traversal' // パストラバーサル
  | 'script-injection' // スクリプト注入（<script>, eval 等）
  | 'suspicious-url'; // 平文httpや生IP等の疑わしいURL

// finding の重大度 → 出口判定へ写す
export type EgressSeverity = 'medium' | 'high';

export interface EgressFinding {
  ruleId: string;
  category: EgressCategory;
  severity: EgressSeverity;
  /** 検出されたフィールド経路（例: intent, patches[0].value）。実体は載せない */
  field: string;
  count: number;
}

export type EgressDecision = 'pass' | 'flag' | 'block';

// 監査の重大度層（§6.2）: block=full(違反検出) / flag=thick(エスカレ) / pass=thin
export type EgressTier = 'thin' | 'thick' | 'full';

export interface EgressEvaluation {
  decision: EgressDecision;
  tier: EgressTier;
  findings: EgressFinding[];
}
