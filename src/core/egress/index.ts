/**
 * FlowOps - Egress Gate Module (ガバナンス・ハーネス §4.2 出口ゲート)
 *
 * 位置づけ(OUTG-3): 既知危険の確率的削減 + 入口の誤り検知の二重化トリップ。
 * ゼロデイ検出は担保しない。
 */

export * from './types';
export { scanEgress, EGRESS_MAX_VALUE_LENGTH } from './scanner';
export { EGRESS_RULES, shannonEntropy, countHighEntropyTokens, type EgressRule } from './rules';
export { guardEgress, EgressBlockedError, type GuardEgressOptions } from './guard';
