/**
 * FlowOps - CSV Serialization
 *
 * 監査レポート / グリッド編集で共用する CSV シリアライザ。
 * - UTF-8 BOM 付与で Excel が日本語を文字化けせず開ける。
 * - CRLF 改行（Excel 標準）。
 * - CSV インジェクション対策（数式実行の防止）。
 */

/** UTF-8 BOM。Excel で日本語を正しく表示させるために先頭へ付与する。 */
export const UTF8_BOM = '﻿';

/** CSV インジェクションの起点となりうる先頭文字。 */
const INJECTION_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * 1セルを CSV 用にエスケープする。
 * - 数式起点文字で始まるセルは先頭に `'` を付与（表計算ソフトでの数式実行を防ぐ）。
 * - `"` `,` 改行を含む場合はダブルクォートで囲み、`"` を `""` にエスケープ。
 */
export function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);

  // CSV インジェクション対策: 危険な先頭文字をクォートで無害化
  if (str.length > 0 && INJECTION_PREFIXES.includes(str[0])) {
    str = `'${str}`;
  }

  // 区切り文字・クォート・改行を含む場合は囲む
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * `escapeCsvCell` のインジェクション対策（先頭 `'`）を取り消す。
 * export→import のラウンドトリップで元の値に戻すために使う。
 */
export function unescapeCsvCell(value: string): string {
  if (value.length >= 2 && value[0] === "'" && INJECTION_PREFIXES.includes(value[1])) {
    return value.slice(1);
  }
  return value;
}

/**
 * ヘッダー＋行データを CSV 文字列にする（BOM なし）。
 * BOM が必要な場合は呼び出し側で `UTF8_BOM` を前置する。
 */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  lines.push(headers.map(escapeCsvCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }
  return lines.join('\r\n');
}

/**
 * BOM 付き CSV を生成する（Excel 直接オープン用）。
 */
export function toCsvWithBom(headers: string[], rows: unknown[][]): string {
  return UTF8_BOM + toCsv(headers, rows);
}

/**
 * CSV テキストを2次元配列にパースする（RFC 4180 準拠の最小実装）。
 * - ダブルクォート囲み、`""` エスケープ、フィールド内改行に対応。
 * - CRLF / LF / 単独 CR の混在を許容。
 * - 先頭 BOM を除去。
 * 依存ライブラリを増やさず Excel 出力を取り込めるようにするための実装。
 */
export function parseCsvTable(text: string): string[][] {
  // 先頭 BOM を除去
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      endField();
      i++;
      continue;
    }
    if (c === '\r') {
      endRow();
      i += text[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (c === '\n') {
      endRow();
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // 末尾フィールド/行（末尾改行がない場合）
  if (field !== '' || row.length > 0) {
    endRow();
  }

  return rows;
}
