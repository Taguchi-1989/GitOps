/**
 * FlowOps - GitOps Portability Invariant (第II部 / GIT-4 / §2.1)
 *
 * GIT-4: GitOps アダプタは GitHub Actions SDK / Octokit に依存しない（移植性）。
 * かつ 第I部コア（ingress/egress/approval/audit）は gitops アダプタに依存しない
 * （依存はコア→アダプタの一方向。器の乗り換えがコアに波及しない = §2.1）。
 *
 * ソースを静的に走査して import 文を検査する（実行時依存ではなく構造の不変条件）。
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const coreDir = join(here, '..'); // src/core

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...tsFiles(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

const FORBIDDEN_IN_ADAPTER = ['@actions/core', '@actions/github', '@octokit', 'octokit'];

describe('GIT-4: アダプタは GitHub SDK に依存しない', () => {
  it('src/core/gitops/* は @actions/* / octokit を import しない', () => {
    const offenders: string[] = [];
    for (const f of tsFiles(here)) {
      const src = readFileSync(f, 'utf-8');
      for (const bad of FORBIDDEN_IN_ADAPTER) {
        if (src.includes(`'${bad}`) || src.includes(`"${bad}`)) {
          offenders.push(`${f} imports ${bad}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('§2.1: 第I部コアは gitops アダプタに依存しない（一方向依存）', () => {
  const CORE_MODULES = ['ingress', 'egress', 'approval', 'audit'];

  it('ingress/egress/approval/audit は ../gitops を import しない', () => {
    const offenders: string[] = [];
    for (const mod of CORE_MODULES) {
      for (const f of tsFiles(join(coreDir, mod))) {
        const src = readFileSync(f, 'utf-8');
        if (src.includes('gitops')) {
          offenders.push(`${f} references gitops`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
