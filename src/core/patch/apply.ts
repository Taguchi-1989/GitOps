/**
 * FlowOps - JSON Patch Apply
 * 
 * JSON Patch (RFC 6902) の適用ロジック
 */

import { JsonPatch, ProposalErrorCode } from './types';
import { Flow } from '../parser/schema';
import { sha256 } from './hash';

export class PatchApplyError extends Error {
  code: ProposalErrorCode;
  
  constructor(code: ProposalErrorCode, message: string) {
    super(message);
    this.name = 'PatchApplyError';
    this.code = code;
  }
}

/**
 * JSON Pointer をパスの配列に変換
 * 例: "/nodes/node_123/label" -> ["nodes", "node_123", "label"]
 */
function parseJsonPointer(pointer: string): string[] {
  if (!pointer.startsWith('/')) {
    throw new PatchApplyError(
      'PATCH_APPLY_FAILED',
      `Invalid JSON Pointer: must start with /`
    );
  }
  
  return pointer
    .substring(1)
    .split('/')
    .map(segment => 
      segment
        .replace(/~1/g, '/')
        .replace(/~0/g, '~')
    );
}

/**
 * パスに従ってオブジェクト内の値を取得
 */
function getValueAtPath(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const segment of path) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * パスに従ってオブジェクト内の値を設定
 */
function setValueAtPath(obj: Record<string, unknown>, path: string[], value: unknown): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i];
    if (current[segment] === undefined) {
      // 次のセグメントが数字なら配列、そうでなければオブジェクト
      const nextSegment = path[i + 1];
      current[segment] = /^\d+$/.test(nextSegment) ? [] : {};
    }
    current = current[segment] as Record<string, unknown>;
  }
  
  const lastSegment = path[path.length - 1];
  current[lastSegment] = value;
}

/**
 * パスに従ってオブジェクト内の値を削除
 */
function deleteValueAtPath(obj: Record<string, unknown>, path: string[]): void {
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (current === undefined || current === null) {
      return;
    }
    current = current[path[i]] as Record<string, unknown>;
  }
  
  if (current !== undefined && current !== null) {
    const lastSegment = path[path.length - 1];
    if (Array.isArray(current)) {
      current.splice(parseInt(lastSegment, 10), 1);
    } else {
      delete current[lastSegment];
    }
  }
}

/**
 * 単一のJSON Patchを適用
 */
function applySinglePatch(obj: Record<string, unknown>, patch: JsonPatch): void {
  const path = parseJsonPointer(patch.path);
  
  switch (patch.op) {
    case 'add':
      setValueAtPath(obj, path, patch.value);
      break;
      
    case 'remove':
      deleteValueAtPath(obj, path);
      break;
      
    case 'replace':
      const current = getValueAtPath(obj, path);
      if (current === undefined) {
        throw new PatchApplyError(
          'PATCH_APPLY_FAILED',
          `Cannot replace: path "${patch.path}" does not exist`
        );
      }
      setValueAtPath(obj, path, patch.value);
      break;
      
    case 'move':
      if (!patch.from) {
        throw new PatchApplyError(
          'PATCH_APPLY_FAILED',
          `Move operation requires "from" field`
        );
      }
      const fromPath = parseJsonPointer(patch.from);
      const valueToMove = getValueAtPath(obj, fromPath);
      deleteValueAtPath(obj, fromPath);
      setValueAtPath(obj, path, valueToMove);
      break;
      
    case 'copy':
      if (!patch.from) {
        throw new PatchApplyError(
          'PATCH_APPLY_FAILED',
          `Copy operation requires "from" field`
        );
      }
      const copyFromPath = parseJsonPointer(patch.from);
      const valueToCopy = getValueAtPath(obj, copyFromPath);
      setValueAtPath(obj, path, JSON.parse(JSON.stringify(valueToCopy)));
      break;
      
    case 'test':
      const testValue = getValueAtPath(obj, path);
      if (JSON.stringify(testValue) !== JSON.stringify(patch.value)) {
        throw new PatchApplyError(
          'PATCH_APPLY_FAILED',
          `Test failed: value at "${patch.path}" does not match`
        );
      }
      break;
      
    default:
      throw new PatchApplyError(
        'PATCH_APPLY_FAILED',
        `Unknown operation: ${patch.op}`
      );
  }
}

/**
 * JSON Patchの配列をオブジェクトに適用
 * @param obj 対象オブジェクト（破壊的に変更される）
 * @param patches 適用するパッチの配列
 */
export function applyPatches<T>(obj: T, patches: JsonPatch[]): T {
  // ディープコピーを作成
  const result = JSON.parse(JSON.stringify(obj));
  
  for (const patch of patches) {
    applySinglePatch(result, patch);
  }
  
  return result;
}

/**
 * FlowオブジェクトにJSON Patchを適用
 * @param flow Flowオブジェクト
 * @param patches 適用するパッチの配列
 * @param expectedHash 期待されるbaseHash（陳腐化検知用）
 */
export function applyPatchesToFlow(
  flow: Flow,
  patches: JsonPatch[],
  expectedHash?: string
): { flow: Flow; newHash: string } {
  // baseHashチェック
  if (expectedHash) {
    const currentHash = sha256(JSON.stringify(flow));
    if (currentHash !== expectedHash) {
      throw new PatchApplyError(
        'STALE_PROPOSAL',
        'Flow has been modified since proposal was generated'
      );
    }
  }
  
  // パッチ適用
  const patchedFlow = applyPatches(flow, patches);
  
  // 新しいハッシュを計算
  const newHash = sha256(JSON.stringify(patchedFlow));
  
  return {
    flow: patchedFlow,
    newHash,
  };
}

/**
 * パッチが禁止されたパスを変更しようとしていないかチェック
 * @param patches チェック対象のパッチ
 * @param forbiddenPaths 禁止されたパスのパターン
 */
export function checkForbiddenPaths(
  patches: JsonPatch[],
  forbiddenPaths: string[] = ['/id']
): string[] {
  const violations: string[] = [];
  
  for (const patch of patches) {
    for (const forbidden of forbiddenPaths) {
      if (patch.path.startsWith(forbidden)) {
        violations.push(`Forbidden path modification: ${patch.path}`);
      }
    }
  }
  
  return violations;
}
