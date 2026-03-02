/**
 * FlowOps - Structural Validator Tests
 */

import { describe, it, expect } from 'vitest';
import { analyzeFlowStructure, StructuralFinding } from './structural-validator';
import { Flow, Dictionary } from '../parser/schema';

// --------------------------------------------------------
// Helper: 最小限のフロー生成
// --------------------------------------------------------

function makeFlow(overrides: Partial<Flow> = {}): Flow {
  return {
    id: 'test-flow',
    title: 'テストフロー',
    layer: 'L1',
    updatedAt: '2026-03-02T00:00:00Z',
    nodes: {
      start: { id: 'start', type: 'start', label: '開始' },
      end: { id: 'end', type: 'end', label: '完了' },
    },
    edges: {
      e1: { id: 'e1', from: 'start', to: 'end' },
    },
    ...overrides,
  };
}

function findByCode(findings: StructuralFinding[], code: string): StructuralFinding[] {
  return findings.filter(f => f.code === code);
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('analyzeFlowStructure', () => {
  describe('健全なフロー', () => {
    it('最小限の正常フローはスコア100', () => {
      const flow = makeFlow();
      const result = analyzeFlowStructure(flow);

      expect(result.score).toBe(100);
      expect(result.summary.errors).toBe(0);
      expect(result.summary.warnings).toBe(0);
    });

    it('分岐ありの正常フローはスコア100', () => {
      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          check: { id: 'check', type: 'decision', label: '判定' },
          path_a: { id: 'path_a', type: 'process', label: 'A' },
          path_b: { id: 'path_b', type: 'process', label: 'B' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'check' },
          e2: { id: 'e2', from: 'check', to: 'path_a', label: 'Yes', condition: 'flag == "true"' },
          e3: { id: 'e3', from: 'check', to: 'path_b' }, // default path
          e4: { id: 'e4', from: 'path_a', to: 'end' },
          e5: { id: 'e5', from: 'path_b', to: 'end' },
        },
      });

      const result = analyzeFlowStructure(flow);
      expect(result.score).toBe(100);
    });
  });

  describe('Check 1: End到達可能性', () => {
    it('Endに到達できないノードを検出する', () => {
      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          orphan: { id: 'orphan', type: 'process', label: '孤立' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'end' },
          e2: { id: 'e2', from: 'start', to: 'orphan' },
          // orphan → end へのエッジがない
        },
      });

      const result = analyzeFlowStructure(flow);
      const noPathFindings = findByCode(result.findings, 'NO_PATH_TO_END');

      expect(noPathFindings.length).toBe(1);
      expect(noPathFindings[0].nodeId).toBe('orphan');
      expect(noPathFindings[0].severity).toBe('error');
    });
  });

  describe('Check 2: デッドロック検出', () => {
    it('出口のないサイクルを検出する', () => {
      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          loop_a: { id: 'loop_a', type: 'process', label: 'ループA' },
          loop_b: { id: 'loop_b', type: 'process', label: 'ループB' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'loop_a' },
          e2: { id: 'e2', from: 'loop_a', to: 'loop_b' },
          e3: { id: 'e3', from: 'loop_b', to: 'loop_a' }, // 出口のないループ
          // loop → end へのエッジがない
        },
      });

      const result = analyzeFlowStructure(flow);
      const deadlockFindings = findByCode(result.findings, 'POTENTIAL_DEADLOCK');

      expect(deadlockFindings.length).toBe(1);
      expect(deadlockFindings[0].severity).toBe('error');
      expect(deadlockFindings[0].path).toEqual(expect.arrayContaining(['loop_a', 'loop_b']));
    });

    it('出口のあるサイクルはデッドロックとしない', () => {
      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          check: { id: 'check', type: 'decision', label: '判定' },
          retry: { id: 'retry', type: 'process', label: 'リトライ' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'check' },
          e2: { id: 'e2', from: 'check', to: 'retry', label: 'NG' },
          e3: { id: 'e3', from: 'retry', to: 'check' },
          e4: { id: 'e4', from: 'check', to: 'end', label: 'OK' },
        },
      });

      const result = analyzeFlowStructure(flow);
      const deadlockFindings = findByCode(result.findings, 'POTENTIAL_DEADLOCK');

      expect(deadlockFindings.length).toBe(0);
    });
  });

  describe('Check 3: 分岐網羅性', () => {
    it('decisionノードに出力エッジが1つしかない場合をエラーにする', () => {
      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          check: { id: 'check', type: 'decision', label: '判定' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'check' },
          e2: { id: 'e2', from: 'check', to: 'end' }, // 1本のみ
        },
      });

      const result = analyzeFlowStructure(flow);
      const singlePath = findByCode(result.findings, 'DECISION_SINGLE_PATH');

      expect(singlePath.length).toBe(1);
      expect(singlePath[0].severity).toBe('error');
      expect(singlePath[0].nodeId).toBe('check');
    });

    it('全エッジにconditionがありデフォルトパスがない場合を警告する', () => {
      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          check: { id: 'check', type: 'decision', label: '判定' },
          a: { id: 'a', type: 'process', label: 'A' },
          b: { id: 'b', type: 'process', label: 'B' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'check' },
          e2: { id: 'e2', from: 'check', to: 'a', condition: 'x == "a"' },
          e3: { id: 'e3', from: 'check', to: 'b', condition: 'x == "b"' },
          e4: { id: 'e4', from: 'a', to: 'end' },
          e5: { id: 'e5', from: 'b', to: 'end' },
        },
      });

      const result = analyzeFlowStructure(flow);
      const noDefault = findByCode(result.findings, 'DECISION_NO_DEFAULT');

      expect(noDefault.length).toBe(1);
      expect(noDefault[0].severity).toBe('warning');
      expect(noDefault[0].nodeId).toBe('check');
    });
  });

  describe('Check 4: ロール権限遷移', () => {
    it('高権限→低権限の遷移をinfoとして報告する', () => {
      const dictionary: Dictionary = {
        roles: {
          staff: { id: 'staff', name: 'スタッフ' },
          supervisor: { id: 'supervisor', name: '管理者' },
        },
        systems: {},
      };

      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          approve: { id: 'approve', type: 'process', label: '承認', role: 'supervisor' },
          execute: { id: 'execute', type: 'process', label: '実行', role: 'staff' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'approve' },
          e2: { id: 'e2', from: 'approve', to: 'execute' },
          e3: { id: 'e3', from: 'execute', to: 'end' },
        },
      });

      const result = analyzeFlowStructure(flow, dictionary);
      const deescalation = findByCode(result.findings, 'ROLE_DEESCALATION');

      expect(deescalation.length).toBe(1);
      expect(deescalation[0].severity).toBe('info');
    });
  });

  describe('スコア計算', () => {
    it('errorで-20, warningで-5が減点される', () => {
      // 1 error (decision single path) + 1 warning (no default) = 100 - 20 - 5 = 75
      // Plus potentially NO_PATH_TO_END errors
      const flow = makeFlow({
        nodes: {
          start: { id: 'start', type: 'start', label: '開始' },
          check_a: { id: 'check_a', type: 'decision', label: '判定A' },
          check_b: { id: 'check_b', type: 'decision', label: '判定B' },
          p1: { id: 'p1', type: 'process', label: 'P1' },
          p2: { id: 'p2', type: 'process', label: 'P2' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'check_a' },
          e2: { id: 'e2', from: 'check_a', to: 'end' }, // single path → error
          e3: { id: 'e3', from: 'start', to: 'check_b' },
          e4: { id: 'e4', from: 'check_b', to: 'p1', condition: 'a == "1"' },
          e5: { id: 'e5', from: 'check_b', to: 'p2', condition: 'a == "2"' }, // no default → warning
          e6: { id: 'e6', from: 'p1', to: 'end' },
          e7: { id: 'e7', from: 'p2', to: 'end' },
        },
      });

      const result = analyzeFlowStructure(flow);
      expect(result.summary.errors).toBeGreaterThanOrEqual(1);
      expect(result.summary.warnings).toBeGreaterThanOrEqual(1);
      expect(result.score).toBeLessThan(100);
    });

    it('スコアは最小0', () => {
      // 多数のエラーがあっても0を下回らない
      const nodes: Record<string, { id: string; type: 'decision'; label: string }> = {};
      const edges: Record<string, { id: string; from: string; to: string }> = {};

      // 大量のdecisionノードを作成（出力エッジなし）
      for (let i = 0; i < 10; i++) {
        nodes[`d${i}`] = { id: `d${i}`, type: 'decision', label: `判定${i}` };
      }
      nodes['start'] = { id: 'start', type: 'start' as 'decision', label: '開始' };

      const flow = makeFlow({
        nodes: {
          ...nodes,
          start: { id: 'start', type: 'start', label: '開始' },
          end: { id: 'end', type: 'end', label: '完了' },
        },
        edges: {
          e1: { id: 'e1', from: 'start', to: 'end' },
        },
      });

      const result = analyzeFlowStructure(flow);
      expect(result.score).toBe(0);
    });
  });
});
