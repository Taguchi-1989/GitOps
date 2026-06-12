/**
 * FlowOps - Proposal出力のセマンティック検証（共通）
 *
 * LLMクライアント経由・コピペ取り込みの両方から使う。
 * - 禁止パス（/id）の変更チェック
 * - role/system フィールドの辞書存在チェック
 */

import { ProposalOutput, JsonPatch } from '../patch/types';
import { checkForbiddenPaths } from '../patch/apply';

export function validateProposalConstraints(
  output: ProposalOutput,
  roles?: string[],
  systems?: string[]
): string[] {
  const violations: string[] = [];

  const forbidden = checkForbiddenPaths(output.patches as JsonPatch[], ['/id']);
  violations.push(...forbidden);

  for (const patch of output.patches) {
    if ((patch.op === 'add' || patch.op === 'replace') && patch.path.endsWith('/role')) {
      if (roles && roles.length > 0) {
        if (typeof patch.value !== 'string' || !roles.includes(patch.value)) {
          violations.push(`Invalid or unknown role in patch: ${String(patch.value)}`);
        }
      }
    }
    if ((patch.op === 'add' || patch.op === 'replace') && patch.path.endsWith('/system')) {
      if (systems && systems.length > 0) {
        if (typeof patch.value !== 'string' || !systems.includes(patch.value)) {
          violations.push(`Invalid or unknown system in patch: ${String(patch.value)}`);
        }
      }
    }
  }

  return violations;
}
