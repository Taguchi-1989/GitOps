/**
 * FlowOps - Editable Grid
 *
 * 汎用の編集可能テーブル。enum 列は <select>、それ以外は text input。
 * セル単位のエラーを赤枠 + tooltip で表示する。
 */

'use client';

import React from 'react';
import type { CellError } from '@/core/grid';

export interface GridColumn<T> {
  key: keyof T & string;
  label: string;
  kind: 'text' | 'select';
  options?: readonly string[];
}

interface EditableGridProps<T> {
  columns: GridColumn<T>[];
  rows: T[];
  /** この表(scope)に対応する CellError のみを渡すこと。 */
  errors: CellError[];
  onCellChange: (rowIndex: number, key: keyof T & string, value: string) => void;
  selected: Set<number>;
  onToggleSelect: (rowIndex: number) => void;
  onBlur?: () => void;
}

export function EditableGrid<T>({
  columns,
  rows,
  errors,
  onCellChange,
  selected,
  onToggleSelect,
  onBlur,
}: EditableGridProps<T>) {
  const errorFor = (rowIndex: number, field: string): CellError | undefined =>
    errors.find(e => e.rowIndex === rowIndex && e.field === field);

  const inputBase =
    'w-full px-2 py-1 text-sm bg-transparent rounded border focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-900 dark:text-gray-100';

  return (
    <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr>
            <th className="w-10 px-2 py-2 border-b border-gray-200 dark:border-gray-700" />
            {columns.map(col => (
              <th
                key={col.key}
                className="text-left px-2 py-2 font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="px-3 py-6 text-center text-gray-400 dark:text-gray-500"
              >
                行がありません。「行を追加」または「CSVインポート」で追加してください。
              </td>
            </tr>
          )}
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={selected.has(rowIndex) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
            >
              <td className="px-2 py-1 border-b border-gray-100 dark:border-gray-800 text-center">
                <input
                  type="checkbox"
                  checked={selected.has(rowIndex)}
                  onChange={() => onToggleSelect(rowIndex)}
                  aria-label={`行 ${rowIndex + 1} を選択`}
                />
              </td>
              {columns.map(col => {
                const err = errorFor(rowIndex, col.key);
                const borderClass = err ? 'border-red-500' : 'border-gray-300 dark:border-gray-600';
                return (
                  <td
                    key={col.key}
                    className="px-1 py-1 border-b border-gray-100 dark:border-gray-800"
                  >
                    {col.kind === 'select' ? (
                      <select
                        value={String(row[col.key] ?? '')}
                        title={err?.message}
                        onChange={e => onCellChange(rowIndex, col.key, e.target.value)}
                        onBlur={onBlur}
                        className={`${inputBase} ${borderClass} bg-white dark:bg-gray-900`}
                      >
                        {(col.options ?? []).map(opt => (
                          <option key={opt} value={opt}>
                            {opt === '' ? '(なし)' : opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={String(row[col.key] ?? '')}
                        title={err?.message}
                        onChange={e => onCellChange(rowIndex, col.key, e.target.value)}
                        onBlur={onBlur}
                        className={`${inputBase} ${borderClass}`}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
