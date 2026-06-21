/**
 * FlowOps - Ingress Gate Module (ガバナンス・ハーネス §4.1 入口ゲート)
 */

export * from './types';
export { scanIngress } from './scanner';
export { loadIngressPolicy, DEFAULT_INGRESS_POLICY, IngressPolicyLoadError } from './policy-loader';
export { guardIngress, IngressBlockedError, type GuardIngressOptions } from './guard';
