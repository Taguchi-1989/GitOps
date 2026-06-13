/**
 * FlowOps - Grid CSV Import/Export
 *
 * グリッド行と CSV の相互変換。Excel での編集を想定:
 *  - 出力は BOM + CRLF + インジェクション対策(core/export/csv)。
 *  - 取込は core/export/csv の RFC 4180 パーサ(引用符・改行・BOM 混在に対応)。
 *  - ヘッダーは括弧前の ASCII 部を大文字小文字無視で照合するため、
 *    Excel 側で "label(ラベル)" のような日本語併記を保持/変更しても壊れない。
 *  - export→import を無編集で行うと元の行に一致する(インジェクション対策の `'` も除去)。
 */

import { toCsvWithBom, unescapeCsvCell, parseCsvTable } from '@/core/export/csv';
import { emptyNodeRow, emptyEdgeRow, type NodeRow, type EdgeRow } from './types';

interface Column<T> {
  key: keyof T & string;
  header: string;
}

const NODE_COLUMNS: Column<NodeRow>[] = [
  { key: 'id', header: 'id' },
  { key: 'type', header: 'type' },
  { key: 'label', header: 'label(ラベル)' },
  { key: 'role', header: 'role(役割)' },
  { key: 'system', header: 'system(システム)' },
  { key: 'taskId', header: 'taskId' },
  { key: 'description', header: 'description(説明)' },
];

const EDGE_COLUMNS: Column<EdgeRow>[] = [
  { key: 'id', header: 'id' },
  { key: 'from', header: 'from' },
  { key: 'to', header: 'to' },
  { key: 'label', header: 'label(ラベル)' },
  { key: 'condition', header: 'condition(条件)' },
  { key: 'dataLayer', header: 'dataLayer' },
];

/** ヘッダー文字列を照合キーへ正規化(括弧前 ASCII を小文字化)。 */
function normalizeHeader(header: string): string {
  return header.split('(')[0].trim().toLowerCase();
}

function rowsToCsv<T>(columns: Column<T>[], rows: T[]): string {
  const headers = columns.map(c => c.header);
  const data = rows.map(row => columns.map(c => row[c.key] as unknown));
  return toCsvWithBom(headers, data);
}

export interface ParseResult<T> {
  rows: T[];
  errors: string[];
}

function parseCsv<T>(columns: Column<T>[], make: () => T, text: string): ParseResult<T> {
  const errors: string[] = [];
  const table = parseCsvTable(text);

  if (table.length === 0) {
    return { rows: [], errors: ['CSVが空です'] };
  }

  // ヘッダー行 -> 正規化キー -> 列インデックス
  const headerRow = table[0];
  const headerIndex = new Map<string, number>();
  headerRow.forEach((h, idx) => {
    headerIndex.set(normalizeHeader(h), idx);
  });

  if (!headerIndex.has('id')) {
    errors.push('ヘッダーに id 列が見つかりません');
  }

  // 空行(全セル空)はスキップ
  const dataRows = table.slice(1).filter(cells => cells.some(c => c.trim() !== ''));

  const rows: T[] = dataRows.map(cells => {
    const row = make();
    for (const col of columns) {
      const idx = headerIndex.get(col.key.toLowerCase());
      if (idx !== undefined) {
        (row as Record<string, unknown>)[col.key] = unescapeCsvCell(cells[idx] ?? '');
      }
    }
    return row;
  });

  return { rows, errors };
}

export function nodeRowsToCsv(rows: NodeRow[]): string {
  return rowsToCsv(NODE_COLUMNS, rows);
}

export function edgeRowsToCsv(rows: EdgeRow[]): string {
  return rowsToCsv(EDGE_COLUMNS, rows);
}

export function parseNodeCsv(text: string): ParseResult<NodeRow> {
  return parseCsv(NODE_COLUMNS, emptyNodeRow, text);
}

export function parseEdgeCsv(text: string): ParseResult<EdgeRow> {
  return parseCsv(EDGE_COLUMNS, emptyEdgeRow, text);
}
