/**
 * FlowOps - Trace Context
 *
 * AsyncLocalStorageベースのTrace ID伝播
 * リクエスト単位でUUID v4を生成し、全レイヤーに伝播させる
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

interface TraceContext {
  traceId: string;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * 新しいTrace IDでコンテキストを開始
 */
export function runWithTraceId<T>(traceId: string, fn: () => T): T {
  return traceStorage.run({ traceId }, fn);
}

/**
 * 新しいUUID v4 Trace IDを生成してコンテキストを開始
 */
export function runWithNewTraceId<T>(fn: () => T): T {
  return runWithTraceId(randomUUID(), fn);
}

/**
 * 現在のTrace IDを取得（コンテキスト外の場合はundefined）
 */
export function getTraceId(): string | undefined {
  return traceStorage.getStore()?.traceId;
}

/**
 * Trace IDを生成（単独使用向け）
 */
export function generateTraceId(): string {
  return randomUUID();
}
