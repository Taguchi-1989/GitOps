/**
 * FlowOps - Grid Editing Types
 *
 * フロー(nodes/edges)を表計算グリッドで編集するための行表現。
 * スコープは nodes/edges のみ。フローメタデータ(title/layer等)は
 * 既存の YAML/キャンバスエディタが正本。
 */

/** ノード1件のグリッド行。`description` は node.meta.description にマップ。 */
export interface NodeRow {
  id: string;
  type: string;
  label: string;
  role: string;
  system: string;
  taskId: string;
  description: string;
}

/** エッジ1件のグリッド行。 */
export interface EdgeRow {
  id: string;
  from: string;
  to: string;
  label: string;
  condition: string;
  dataLayer: string;
}

/** セル単位の検証結果。UI でのセルハイライトに使う。 */
export interface CellError {
  scope: 'node' | 'edge' | 'flow';
  /** 該当行のインデックス。フロー全体の警告は -1。 */
  rowIndex: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/** ブロッキングなエラー(warning を除く)が存在するか。 */
export function hasBlockingErrors(errors: CellError[]): boolean {
  return errors.some(e => e.severity === 'error');
}

/** 空のノード行を生成する。 */
export function emptyNodeRow(): NodeRow {
  return { id: '', type: 'process', label: '', role: '', system: '', taskId: '', description: '' };
}

/** 空のエッジ行を生成する。 */
export function emptyEdgeRow(): EdgeRow {
  return { id: '', from: '', to: '', label: '', condition: '', dataLayer: '' };
}
