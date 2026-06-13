/**
 * FlowOps - Audit Report Export API
 *
 * GET /api/audit/export?format=csv|html&...filters
 * 監査ログを CSV / 印刷可能HTML レポートとして出力する。
 *
 * - CSV: Excel 直接オープン用（BOM付き、attachment ダウンロード）
 * - HTML: 印刷/PDF用の自己完結レポート（inline 表示）
 * エクスポート操作自体を DATA_EXPORT として監査ログに記録する。
 */

import { NextRequest } from 'next/server';
import { errorResponse, internalErrorResponse, getAuditActor } from '@/lib/api-utils';
import { API_ERROR_CODES } from '@/core/types/api';
import { auditLog } from '@/core/audit';
import { parseAuditFilters, type AuditFilters } from '@/core/export/audit-filters';
import {
  collectAuditRows,
  renderAuditCsv,
  renderAuditHtml,
  DEFAULT_MAX_ROWS,
} from '@/core/export/audit-report';

export const dynamic = 'force-dynamic';

/** ファイル名用のタイムスタンプ (YYYYMMDD-HHmm, JST)。 */
function fileStamp(date: Date): string {
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}${p(jst.getUTCMonth() + 1)}${p(jst.getUTCDate())}-${p(
    jst.getUTCHours()
  )}${p(jst.getUTCMinutes())}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const format = searchParams.get('format') ?? 'csv';
    if (format !== 'csv' && format !== 'html') {
      return errorResponse(
        API_ERROR_CODES.VALIDATION_ERROR,
        'format は csv または html を指定してください',
        400
      );
    }

    const parsed = parseAuditFilters(searchParams);
    if (!parsed.ok) {
      return errorResponse(API_ERROR_CODES.VALIDATION_ERROR, parsed.error, 400);
    }

    const { rows, truncated } = await collectAuditRows(parsed.filters);
    const actor = getAuditActor(request) ?? 'you';
    const generatedAt = new Date();

    // エクスポート操作の自己監査（持出記録）
    await auditLog.record({
      action: 'DATA_EXPORT',
      entityType: 'System',
      entityId: 'audit-log',
      actor,
      payload: {
        format,
        filters: serializeFilters(parsed.filters),
        rowCount: rows.length,
        truncated,
      },
    });

    const stamp = fileStamp(generatedAt);

    if (format === 'csv') {
      const body = renderAuditCsv(rows);
      const filename = `監査レポート_${stamp}.csv`;
      return new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-report-${stamp}.csv"; filename*=UTF-8''${encodeURIComponent(
            filename
          )}`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const body = renderAuditHtml(rows, parsed.filters, actor, {
      truncated,
      maxRows: DEFAULT_MAX_ROWS,
      generatedAt,
    });
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return internalErrorResponse(error);
  }
}

/** Date を含むフィルタを監査 payload 用に文字列化する。 */
function serializeFilters(filters: AuditFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(filters)) {
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}
