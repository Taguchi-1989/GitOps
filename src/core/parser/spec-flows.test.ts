/**
 * spec/flows 実ファイルの検証
 *
 * - 同梱フローがすべてパース・辞書参照・構造検証を通ること
 * - 新規取引先・口座登録フローのガバナンス上の約束（承認・証跡・フェイルセーフ分岐）が崩れていないこと
 */

import fs from 'fs';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { describe, it, expect, vi } from 'vitest';
import { parseFlowYaml, Flow } from './index';
import { validateFlowIntegrity } from './validateFlow';
import { DictionarySchema } from './schema';
import { analyzeFlowStructure } from '@/core/flow-builder/structural-validator';
import {
  evaluateConditionExpression,
  isSupportedConditionExpression,
} from '@/core/orchestrator/condition-expression';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const SPEC_DIR = path.join(process.cwd(), 'spec');
const FLOWS_DIR = path.join(SPEC_DIR, 'flows');

function loadDictionary() {
  const read = (file: string) =>
    parseYaml(fs.readFileSync(path.join(SPEC_DIR, 'dictionary', file), 'utf-8'));
  return DictionarySchema.parse({ roles: read('roles.yaml'), systems: read('systems.yaml') });
}

function loadFlow(fileName: string): Flow {
  const result = parseFlowYaml(fs.readFileSync(path.join(FLOWS_DIR, fileName), 'utf-8'), fileName);
  expect(result.errors).toEqual([]);
  return result.flow!;
}

/** エンジンと同じ規則（条件付きエッジを順に評価し、どれも成立しなければ無条件エッジ）で次ノードを決める */
function nextNode(flow: Flow, nodeId: string, state: Record<string, unknown>): string | undefined {
  const outgoing = Object.values(flow.edges).filter(e => e.from === nodeId);
  const matched = outgoing.find(
    e => e.condition && evaluateConditionExpression(e.condition, state)
  );
  return (matched ?? outgoing.find(e => !e.condition))?.to;
}

/** start から end まで state に従って進み、通過したノードIDを返す */
function walk(flow: Flow, state: Record<string, unknown>): string[] {
  const start = Object.values(flow.nodes).find(n => n.type === 'start')!;
  const visited = [start.id];
  let current: string | undefined = start.id;
  while (current && flow.nodes[current].type !== 'end' && visited.length < 100) {
    current = nextNode(flow, current, state);
    if (current) visited.push(current);
  }
  return visited;
}

/** blocked を通らずに start から target へ到達できるか */
function reachableAvoiding(flow: Flow, target: string, blocked: string): boolean {
  const start = Object.values(flow.nodes).find(n => n.type === 'start')!.id;
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (id === target) return true;
    if (seen.has(id) || id === blocked) continue;
    seen.add(id);
    for (const e of Object.values(flow.edges)) if (e.from === id) queue.push(e.to);
  }
  return false;
}

const flowFiles = fs.readdirSync(FLOWS_DIR).filter(f => /\.ya?ml$/.test(f));

describe('spec/flows 同梱フロー', () => {
  const dictionary = loadDictionary();

  it.each(flowFiles)('%s はパース・辞書参照・構造検証を通る', fileName => {
    const flow = loadFlow(fileName);
    expect(validateFlowIntegrity(flow, dictionary).errors).toEqual([]);
    const structural = analyzeFlowStructure(flow, dictionary);
    expect(structural.findings.filter(f => f.severity === 'error')).toEqual([]);
  });
});

describe('vendor-registration（新規取引先・口座登録）', () => {
  const dictionary = loadDictionary();
  const flow = loadFlow('vendor-registration.yaml');

  it('構造上の警告がなく、条件式はすべてエンジンが評価できる形式', () => {
    const structural = analyzeFlowStructure(flow, dictionary);
    expect(structural.findings.filter(f => f.severity === 'warning')).toEqual([]);
    for (const edge of Object.values(flow.edges)) {
      if (edge.condition) expect(isSupportedConditionExpression(edge.condition)).toBe(true);
    }
  });

  it('判断材料が不明なときは、より厳しい側へ進む（フェイルセーフ）', () => {
    expect(nextNode(flow, 'evidence_check', {})).toBe('return_to_requester');
    expect(nextNode(flow, 'anti_social_result', {})).toBe('end_rejected');
    expect(nextNode(flow, 'overseas_check', {})).toBe('overseas_additional_check');
    expect(nextNode(flow, 'credit_required', {})).toBe('credit_check');
    expect(nextNode(flow, 'request_type_check', {})).toBe('collect_company_info');
  });

  it('取引予定額がしきい値以上なら与信確認を必須にする', () => {
    expect(nextNode(flow, 'credit_required', { annual_amount: 9_999_999 })).toBe(
      'validate_bank_account'
    );
    expect(nextNode(flow, 'credit_required', { annual_amount: 10_000_000 })).toBe('credit_check');
  });

  it('新規登録は反社チェック・部門承認・証跡保管・標準化を経て登録完了する', () => {
    const path = walk(flow, {
      evidence_complete: true,
      anti_social_clear: true,
      is_overseas: false,
      annual_amount: 1_000_000,
    });
    expect(path.at(-1)).toBe('end_registered');
    for (const id of ['anti_social_check', 'department_approval', 'evidence_archive', 'standardize']) {
      expect(path).toContain(id);
    }
    expect(path).not.toContain('credit_check');
    expect(path.indexOf('department_approval')).toBeLessThan(
      path.indexOf('master_data_registration')
    );
  });

  it('口座変更は本人確認のうえ経理承認と部門承認の二重承認を経る', () => {
    const path = walk(flow, { evidence_complete: true, request_type: 'bank_change' });
    expect(path.at(-1)).toBe('end_registered');
    const registration = path.indexOf('master_data_registration');
    expect(path.indexOf('verify_bank_change')).toBeGreaterThan(-1);
    expect(path.indexOf('accounting_approval')).toBeGreaterThan(-1);
    expect(path.indexOf('accounting_approval')).toBeLessThan(registration);
    expect(path.indexOf('department_approval')).toBeLessThan(registration);
  });

  it('どの経路でも部門承認を経ずにマスタ登録へは到達できない', () => {
    expect(flow.nodes.department_approval.type).toBe('human-review');
    expect(reachableAvoiding(flow, 'master_data_registration', 'department_approval')).toBe(false);
  });

  it('口座・反社情報を扱うノードはAI利用不可・持出禁止', () => {
    for (const id of [
      'anti_social_check',
      'verify_bank_change',
      'validate_bank_account',
      'master_data_registration',
    ]) {
      expect(flow.nodes[id].dataClassification).toMatchObject({
        aiUsageAllowed: false,
        exportPolicy: 'prohibited',
      });
    }
  });
});
