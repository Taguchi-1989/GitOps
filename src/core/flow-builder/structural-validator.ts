/**
 * FlowOps - Structural Validator
 *
 * フローの構造的健全性を検証する「構造計算」エンジン。
 * validateFlow.ts の参照整合性チェックに加え、
 * デッドロック検出、分岐網羅性、End到達可能性を静的に検証する。
 *
 * 検証項目:
 *   1. End到達可能性 (NO_PATH_TO_END)
 *   2. デッドロック検出 (POTENTIAL_DEADLOCK)
 *   3. 分岐網羅性 (DECISION_SINGLE_PATH / DECISION_NO_DEFAULT)
 *   4. ロール権限逆転 (ROLE_DEESCALATION)
 *   5. 外部システム境界 (EXTERNAL_SYSTEM_NO_ERROR_PATH)
 */

import type { Flow, Node, Edge, Dictionary } from '../parser/schema';

// --------------------------------------------------------
// Public Types
// --------------------------------------------------------

/** Finding の重大度 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * 構造検証で検出された単一の所見。
 * code によって一意に分類され、severity で深刻度を示す。
 */
export interface StructuralFinding {
  /** 機械可読な検出コード */
  code: string;
  /** 深刻度 */
  severity: Severity;
  /** 人間可読な説明メッセージ */
  message: string;
  /** 問題に関連するノードID */
  nodeId?: string;
  /** 問題に関連するエッジID */
  edgeId?: string;
  /** 問題に関連するパス（ノードIDの配列） */
  path?: string[];
}

/**
 * 構造分析の結果。
 * score は 0-100 のヘルススコアで、error -20, warning -5 で減点される。
 */
export interface StructuralAnalysisResult {
  /** 0-100 の構造健全性スコア */
  score: number;
  /** 検出された所見の一覧 */
  findings: StructuralFinding[];
  /** 重大度別の集計 */
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

// --------------------------------------------------------
// Internal Helpers - Typed Record Access
// --------------------------------------------------------

/**
 * Flow.nodes を型安全に [id, Node][] として列挙するヘルパー。
 * z.record() 由来の Record では Object.entries の値が unknown になるため、
 * 明示的にキャストする。
 */
function nodeEntries(nodes: Flow['nodes']): [string, Node][] {
  return Object.entries(nodes) as [string, Node][];
}

/**
 * Flow.edges を型安全に [id, Edge][] として列挙するヘルパー。
 */
function edgeEntries(edges: Flow['edges']): [string, Edge][] {
  return Object.entries(edges) as [string, Edge][];
}

/**
 * Flow.edges の値のみを型安全に Edge[] として列挙するヘルパー。
 */
function edgeValues(edges: Flow['edges']): Edge[] {
  return Object.values(edges) as Edge[];
}

// --------------------------------------------------------
// Internal Helpers - Graph Adjacency
// --------------------------------------------------------

/**
 * フローのエッジ一覧から隣接リスト（順方向）を構築する。
 * @param nodes ノードのRecord
 * @param edges エッジのRecord
 * @returns nodeId -> Set<nodeId> の Map
 */
function buildAdjacencyList(nodes: Flow['nodes'], edges: Flow['edges']): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const nodeId of Object.keys(nodes)) {
    adj.set(nodeId, new Set());
  }
  for (const edge of edgeValues(edges)) {
    // エッジの from/to が実在するノードの場合のみ追加
    if (adj.has(edge.from)) {
      adj.get(edge.from)!.add(edge.to);
    }
  }
  return adj;
}

/**
 * 指定ノードから BFS で到達可能なノードIDの集合を返す。
 * @param start 開始ノードID
 * @param adj 隣接リスト
 * @returns 到達可能なノードIDの Set（start 自身を含む）
 */
function bfsReachable(start: string, adj: Map<string, Set<string>>): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const neighbors = adj.get(current);
    if (neighbors) {
      for (const next of neighbors) {
        if (!visited.has(next)) {
          queue.push(next);
        }
      }
    }
  }
  return visited;
}

// --------------------------------------------------------
// Internal Helpers - Strongly Connected Components (Tarjan)
// --------------------------------------------------------

/**
 * Tarjan のアルゴリズムで強連結成分 (SCC) を求める。
 *
 * 各ノードに index と lowLink を割り当て、DFS でグラフを走査する。
 * lowLink が自身の index と等しいノードが SCC のルートとなり、
 * スタックからそのノードまでをポップして1つの SCC とする。
 *
 * @param adj 隣接リスト
 * @returns SCC の配列。各 SCC はノードIDの配列。
 */
function findSCCs(adj: Map<string, Set<string>>): string[][] {
  let index = 0;
  const stack: string[] = [];
  const onStack = new Set<string>();
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const result: string[][] = [];

  function strongConnect(v: string): void {
    indices.set(v, index);
    lowLinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adj.get(v);
    if (neighbors) {
      for (const w of neighbors) {
        if (!indices.has(w)) {
          // w は未訪問: 再帰的に探索
          strongConnect(w);
          lowLinks.set(v, Math.min(lowLinks.get(v)!, lowLinks.get(w)!));
        } else if (onStack.has(w)) {
          // w はスタック上にあり、現在の SCC 内
          lowLinks.set(v, Math.min(lowLinks.get(v)!, indices.get(w)!));
        }
      }
    }

    // v がルートノードの場合、スタックをポップして SCC を生成
    if (lowLinks.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      result.push(scc);
    }
  }

  for (const v of adj.keys()) {
    if (!indices.has(v)) {
      strongConnect(v);
    }
  }

  return result;
}

// --------------------------------------------------------
// Check 1: End Reachability
// --------------------------------------------------------

/**
 * すべての非Endノードから少なくとも1つのEndノードに到達できるかを検証する。
 *
 * アルゴリズム:
 *   1. Endノードの集合を特定
 *   2. 各非Endノードから順方向 BFS を実行
 *   3. BFS で到達可能なノードの中に End ノードが含まれなければ報告
 *
 * @param flow フロー定義
 * @returns 検出された所見の配列
 */
function checkEndReachability(flow: Flow): StructuralFinding[] {
  const findings: StructuralFinding[] = [];
  const adj = buildAdjacencyList(flow.nodes, flow.edges);

  // Endノードの集合を特定
  const endNodeIds = new Set<string>();
  for (const [nodeId, node] of nodeEntries(flow.nodes)) {
    if (node.type === 'end') {
      endNodeIds.add(nodeId);
    }
  }

  // Endノードが存在しない場合は validateFlow 側で検出されるため、ここではスキップ
  if (endNodeIds.size === 0) {
    return findings;
  }

  // 各非Endノードから BFS で End に到達できるかチェック
  for (const [nodeId, node] of nodeEntries(flow.nodes)) {
    if (node.type === 'end') continue;

    const reachable = bfsReachable(nodeId, adj);

    // 到達可能なノードの中に End ノードが含まれているかチェック
    let canReachEnd = false;
    for (const endId of endNodeIds) {
      if (reachable.has(endId)) {
        canReachEnd = true;
        break;
      }
    }

    if (!canReachEnd) {
      findings.push({
        code: 'NO_PATH_TO_END',
        severity: 'error',
        message: `Node "${nodeId}" (${node.label}) has no path to any end node`,
        nodeId,
      });
    }
  }

  return findings;
}

// --------------------------------------------------------
// Check 2: Deadlock Detection
// --------------------------------------------------------

/**
 * デッドロック（出口のないサイクル）を検出する。
 *
 * 手順:
 *   1. Tarjan のアルゴリズムで強連結成分 (SCC) を求める
 *   2. サイズ2以上の SCC（または自己ループを持つサイズ1の SCC）について、
 *      SCC 内のいずれかのノードから SCC 外へ出るエッジが存在するかチェック
 *   3. SCC 外への出口がなく、かつ SCC 内に End ノードが含まれない場合、
 *      デッドロックとして報告
 *
 * @param flow フロー定義
 * @returns 検出された所見の配列
 */
function checkDeadlocks(flow: Flow): StructuralFinding[] {
  const findings: StructuralFinding[] = [];
  const adj = buildAdjacencyList(flow.nodes, flow.edges);
  const sccs = findSCCs(adj);

  // Endノードの集合
  const endNodeIds = new Set<string>();
  for (const [nodeId, node] of nodeEntries(flow.nodes)) {
    if (node.type === 'end') {
      endNodeIds.add(nodeId);
    }
  }

  for (const scc of sccs) {
    // サイズ1の SCC はサイクルではない（自己ループでない限り）
    if (scc.length < 2) {
      const nodeId = scc[0];
      const neighbors = adj.get(nodeId);
      if (!neighbors || !neighbors.has(nodeId)) {
        continue; // 自己ループなし -> サイクルではない
      }
      // 自己ループがある場合は以降のロジックで外部出口を判定
    }

    const sccSet = new Set(scc);

    // SCC 内に End ノードが含まれていればデッドロックではない
    let containsEnd = false;
    for (const nodeId of scc) {
      if (endNodeIds.has(nodeId)) {
        containsEnd = true;
        break;
      }
    }
    if (containsEnd) continue;

    // SCC から外部へ出るエッジが存在するかチェック
    let hasExternalExit = false;
    for (const nodeId of scc) {
      const neighbors = adj.get(nodeId);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!sccSet.has(neighbor)) {
            hasExternalExit = true;
            break;
          }
        }
      }
      if (hasExternalExit) break;
    }

    // 外部への出口がなく、End も含まない SCC はデッドロック
    if (!hasExternalExit) {
      findings.push({
        code: 'POTENTIAL_DEADLOCK',
        severity: 'error',
        message: `Cycle detected with no exit path to end: nodes [${scc.join(', ')}]`,
        path: scc,
      });
    }
  }

  return findings;
}

// --------------------------------------------------------
// Check 3: Decision Coverage
// --------------------------------------------------------

/**
 * Decision ノードの分岐網羅性を検証する。
 *
 * ルール:
 * - 各 decision ノードは少なくとも2つの出力エッジを持つべき
 *   (1つ以下の場合は error: DECISION_SINGLE_PATH)
 * - condition が未設定のエッジ（デフォルトパス）が少なくとも1つあるべき
 *   (ない場合は warning: DECISION_NO_DEFAULT)
 *
 * @param flow フロー定義
 * @returns 検出された所見の配列
 */
function checkDecisionCoverage(flow: Flow): StructuralFinding[] {
  const findings: StructuralFinding[] = [];

  // ノードごとの出力エッジを収集
  const outgoingEdges = new Map<string, Edge[]>();
  for (const edge of edgeValues(flow.edges)) {
    if (!outgoingEdges.has(edge.from)) {
      outgoingEdges.set(edge.from, []);
    }
    outgoingEdges.get(edge.from)!.push(edge);
  }

  for (const [nodeId, node] of nodeEntries(flow.nodes)) {
    if (node.type !== 'decision') continue;

    const edges = outgoingEdges.get(nodeId) ?? [];

    // 分岐が2つ未満: error
    if (edges.length < 2) {
      findings.push({
        code: 'DECISION_SINGLE_PATH',
        severity: 'error',
        message: `Decision node "${nodeId}" (${node.label}) has ${edges.length} outgoing edge(s), expected at least 2`,
        nodeId,
      });
    }

    // デフォルトパス（condition なし）が存在しない: warning
    // 2つ以上のエッジがある場合のみチェック（1つ以下はそもそもエラー）
    if (edges.length >= 2) {
      const hasDefault = edges.some(
        e => e.condition === undefined || e.condition === null || e.condition === ''
      );
      if (!hasDefault) {
        findings.push({
          code: 'DECISION_NO_DEFAULT',
          severity: 'warning',
          message: `Decision node "${nodeId}" (${node.label}) has no default path (all edges have conditions)`,
          nodeId,
        });
      }
    }
  }

  return findings;
}

// --------------------------------------------------------
// Check 4: Role Transitions
// --------------------------------------------------------

/**
 * ロール権限の逆転（高権限ロールから低権限ロールへの遷移）を検出する。
 *
 * Dictionary の roles のキー順序を権限レベルの代理指標として使用する。
 * インデックスが大きいほど権限が高いと見なす。
 * 高権限から低権限への遷移がある場合、info レベルで報告する。
 *
 * この検出は参考情報であり、意図的なデザインパターンの場合もある。
 * 例: 部長承認後に担当者が実作業を行うケース。
 *
 * @param flow フロー定義
 * @param dictionary ロール/システム辞書
 * @returns 検出された所見の配列
 */
function checkRoleTransitions(flow: Flow, dictionary: Dictionary): StructuralFinding[] {
  const findings: StructuralFinding[] = [];

  // ロールの権限順序を構築（キーの出現順でインデックス化）
  const roleKeys = Object.keys(dictionary.roles);
  const roleOrder = new Map<string, number>();
  for (let i = 0; i < roleKeys.length; i++) {
    roleOrder.set(roleKeys[i], i);
  }

  // エッジをたどって隣接ノード間のロール遷移を確認
  for (const [edgeId, edge] of edgeEntries(flow.edges)) {
    const fromNode = flow.nodes[edge.from] as Node | undefined;
    const toNode = flow.nodes[edge.to] as Node | undefined;

    // 両方のノードが存在し、ロールが設定されている場合のみチェック
    if (!fromNode || !toNode) continue;
    if (!fromNode.role || !toNode.role) continue;
    if (fromNode.role === toNode.role) continue;

    const fromOrder = roleOrder.get(fromNode.role);
    const toOrder = roleOrder.get(toNode.role);

    // 両方のロールが辞書に存在する場合のみ比較
    if (fromOrder === undefined || toOrder === undefined) continue;

    // 高い権限（大きいインデックス）から低い権限（小さいインデックス）への遷移を検出
    if (fromOrder > toOrder) {
      findings.push({
        code: 'ROLE_DEESCALATION',
        severity: 'info',
        message: `Edge "${edgeId}": role transition from "${fromNode.role}" to "${toNode.role}" is a de-escalation without explicit approval`,
        edgeId,
        nodeId: edge.from,
      });
    }
  }

  return findings;
}

// --------------------------------------------------------
// Check 5: System Boundaries
// --------------------------------------------------------

/**
 * 外部システム境界でのエラーハンドリング欠如を検出する。
 *
 * あるノードから別のシステム（特に external タイプ）のノードへ遷移する際、
 * 遷移先ノードの出力エッジにエラー系のパスが含まれない場合に警告する。
 *
 * エラー系パスの判定は、エッジの label または condition に
 * "error", "fail", "exception", "timeout", "retry" などのキーワードが
 * 含まれるかどうかで行う（大文字小文字不問、日本語キーワードも対応）。
 *
 * @param flow フロー定義
 * @param dictionary ロール/システム辞書
 * @returns 検出された所見の配列
 */
function checkSystemBoundaries(flow: Flow, dictionary: Dictionary): StructuralFinding[] {
  const findings: StructuralFinding[] = [];

  // エラーハンドリング関連のキーワード（英語・日本語）
  const errorKeywords =
    /error|fail|exception|timeout|retry|fallback|異常|エラー|タイムアウト|失敗/i;

  // ノードごとの出力エッジを収集
  const outgoingEdges = new Map<string, Edge[]>();
  for (const edge of edgeValues(flow.edges)) {
    if (!outgoingEdges.has(edge.from)) {
      outgoingEdges.set(edge.from, []);
    }
    outgoingEdges.get(edge.from)!.push(edge);
  }

  /**
   * システムが「外部」かどうかを判定する。
   * System 型に type プロパティが存在する場合はそれを使用する。
   * 現在の schema.ts の SystemSchema には type フィールドが定義されていないが、
   * 将来的な拡張や YAML 上に追加フィールドがある場合に対応するため、
   * Record 経由で安全にアクセスする。
   */
  function isExternalSystem(systemKey: string): boolean {
    const sys = dictionary.systems[systemKey];
    if (!sys) return false;
    const sysRecord = sys as Record<string, unknown>;
    return sysRecord['type'] === 'external';
  }

  for (const [edgeId, edge] of edgeEntries(flow.edges)) {
    const fromNode = flow.nodes[edge.from] as Node | undefined;
    const toNode = flow.nodes[edge.to] as Node | undefined;

    if (!fromNode || !toNode) continue;

    // システム境界をまたぐ遷移かチェック
    if (!fromNode.system || !toNode.system) continue;
    if (fromNode.system === toNode.system) continue;

    // 遷移先が外部システムかチェック
    const targetIsExternal = isExternalSystem(toNode.system);
    if (!targetIsExternal) continue;

    // 遷移先ノードの出力エッジにエラー処理パスがあるかチェック
    const toNodeOutgoing = outgoingEdges.get(edge.to) ?? [];

    const hasErrorPath = toNodeOutgoing.some(outEdge => {
      const labelMatch = outEdge.label ? errorKeywords.test(outEdge.label) : false;
      const conditionMatch = outEdge.condition ? errorKeywords.test(outEdge.condition) : false;
      return labelMatch || conditionMatch;
    });

    if (!hasErrorPath) {
      findings.push({
        code: 'EXTERNAL_SYSTEM_NO_ERROR_PATH',
        severity: 'warning',
        message: `Node "${edge.to}" (${toNode.label}) interacts with external system "${toNode.system}" but has no error handling path`,
        nodeId: edge.to,
        edgeId,
      });
    }
  }

  return findings;
}

// --------------------------------------------------------
// Score Calculation
// --------------------------------------------------------

/**
 * 所見一覧からヘルススコアを算出する。
 *
 * 算出ルール:
 *   - 初期値: 100
 *   - error 1件ごとに: -20
 *   - warning 1件ごとに: -5
 *   - info: 減点なし
 *   - 最小値: 0
 *
 * @param findings 所見の配列
 * @returns 0-100 のスコア
 */
function calculateScore(findings: StructuralFinding[]): number {
  let score = 100;
  for (const finding of findings) {
    switch (finding.severity) {
      case 'error':
        score -= 20;
        break;
      case 'warning':
        score -= 5;
        break;
      case 'info':
        // info は減点なし
        break;
    }
  }
  return Math.max(0, score);
}

// --------------------------------------------------------
// Main Analysis Function
// --------------------------------------------------------

/**
 * フローの構造的健全性を包括的に分析する。
 *
 * validateFlow.ts が行う参照整合性チェックの上位レイヤーとして、
 * グラフ理論に基づく以下の構造検証を実施する:
 *
 * 1. **End到達可能性**: 全非Endノードから少なくとも1つのEndノードへの経路が存在するか
 * 2. **デッドロック検出**: 出口のないサイクル（強連結成分）が存在しないか
 * 3. **分岐網羅性**: Decisionノードが適切な分岐を持ち、デフォルトパスがあるか
 * 4. **ロール権限遷移** (辞書必要): 高権限ロールから低権限ロールへの暗黙的な逆転がないか
 * 5. **外部システム境界** (辞書必要): 外部システムとの連携にエラーハンドリングがあるか
 *
 * @param flow 検証対象のフロー定義
 * @param dictionary オプション: ロール/システム辞書。提供された場合、チェック4/5も実行。
 * @returns 構造分析結果（スコア、所見一覧、集計）
 *
 * @example
 * ```typescript
 * import { analyzeFlowStructure } from '@/core/flow-builder/structural-validator';
 *
 * const result = analyzeFlowStructure(flow, dictionary);
 * if (result.score < 60) {
 *   console.warn('Flow has significant structural issues:', result.findings);
 * }
 * ```
 */
export function analyzeFlowStructure(
  flow: Flow,
  dictionary?: Dictionary
): StructuralAnalysisResult {
  const findings: StructuralFinding[] = [];

  // Check 1: End到達可能性
  findings.push(...checkEndReachability(flow));

  // Check 2: デッドロック検出
  findings.push(...checkDeadlocks(flow));

  // Check 3: 分岐網羅性
  findings.push(...checkDecisionCoverage(flow));

  // Check 4 & 5: 辞書依存チェック（辞書が提供された場合のみ）
  if (dictionary) {
    findings.push(...checkRoleTransitions(flow, dictionary));
    findings.push(...checkSystemBoundaries(flow, dictionary));
  }

  // 重大度別の集計
  const summary = {
    errors: findings.filter(f => f.severity === 'error').length,
    warnings: findings.filter(f => f.severity === 'warning').length,
    infos: findings.filter(f => f.severity === 'info').length,
  };

  return {
    score: calculateScore(findings),
    findings,
    summary,
  };
}
