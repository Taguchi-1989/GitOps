/**
 * FlowOps - Audit Filter Parsing
 *
 * URLSearchParams から監査ログのフィルタ条件を抽出・検証する。
 * 監査ログ一覧 (/api/audit) とエクスポート (/api/audit/export) で共用。
 */

import {
  AuditActionSchema,
  AuditEntityTypeSchema,
  type AuditQueryOptions,
} from '@/core/audit/types';

export type AuditFilters = Pick<
  AuditQueryOptions,
  'entityType' | 'entityId' | 'action' | 'actor' | 'traceId' | 'startDate' | 'endDate'
>;

export type ParseAuditFiltersResult =
  | { ok: true; filters: AuditFilters }
  | { ok: false; error: string };

/**
 * 日付文字列をパースする。
 * - YYYY-MM-DD 形式 (date input) は時刻を補完する。
 * - endOfDay=true の場合は 23:59:59.999 に正規化する（期間「以下」を1日まるごと含めるため）。
 * - 不正な日付は null を返す（呼び出し側でエラー化）。
 */
function parseDate(raw: string, endOfDay: boolean): Date | null {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(isDateOnly ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (isDateOnly && endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

/**
 * searchParams から監査フィルタを構築する。
 * action / entityType は enum 検証し、不正値はエラー文字列を返す。
 */
export function parseAuditFilters(searchParams: URLSearchParams): ParseAuditFiltersResult {
  const filters: AuditFilters = {};

  const entityType = searchParams.get('entityType');
  if (entityType) {
    const result = AuditEntityTypeSchema.safeParse(entityType);
    if (!result.success) {
      return { ok: false, error: `不正な entityType: ${entityType}` };
    }
    filters.entityType = result.data;
  }

  const action = searchParams.get('action');
  if (action) {
    const result = AuditActionSchema.safeParse(action);
    if (!result.success) {
      return { ok: false, error: `不正な action: ${action}` };
    }
    filters.action = result.data;
  }

  const entityId = searchParams.get('entityId');
  if (entityId) {
    filters.entityId = entityId;
  }

  const actor = searchParams.get('actor');
  if (actor) {
    filters.actor = actor;
  }

  const traceId = searchParams.get('traceId');
  if (traceId) {
    filters.traceId = traceId;
  }

  const startDate = searchParams.get('startDate');
  if (startDate) {
    const parsed = parseDate(startDate, false);
    if (!parsed) {
      return { ok: false, error: `不正な startDate: ${startDate}` };
    }
    filters.startDate = parsed;
  }

  const endDate = searchParams.get('endDate');
  if (endDate) {
    const parsed = parseDate(endDate, true);
    if (!parsed) {
      return { ok: false, error: `不正な endDate: ${endDate}` };
    }
    filters.endDate = parsed;
  }

  return { ok: true, filters };
}
