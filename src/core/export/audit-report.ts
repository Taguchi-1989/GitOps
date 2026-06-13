/**
 * FlowOps - Audit Report Generation
 *
 * 監査ログを「誰が・いつ・何を・なぜ・AIがどう関与したか」の
 * 一気通貫レポート（CSV / 印刷可能HTML）として出力する。
 *
 * AuditLog 単体では分からない AI 関与情報（使用モデル・トークン・
 * 人間承認・Gitコミット・Langfuse）を traceId 経由で WorkflowExecution
 * から補完する。補完ロジックは /api/governance/trace/[traceId] を踏襲。
 */

import { prisma } from '@/lib/prisma';
import { buildAuditWhere } from '@/lib/audit-repository';
import type { AuditLogRecord } from '@/core/audit';
import type { AuditFilters } from './audit-filters';
import { toCsvWithBom } from './csv';

/** traceId から補完した AI 関与・承認情報。 */
export interface TraceEnrichment {
  flowId: string | null;
  workflowStatus: string | null;
  llmModelsUsed: string[];
  totalTokensInput: number;
  totalTokensOutput: number;
  gitCommitHashes: string[];
  approvals: {
    decision: string | null;
    decidedBy: string | null;
    reason: string | null;
    decidedAt: Date | null;
  }[];
  langfuseTraceUrl: string | null;
}

/** payload を解析し trace 情報を補完した監査行。 */
export interface EnrichedAuditRow extends AuditLogRecord {
  payloadParsed: Record<string, unknown> | null;
  payloadParseError: boolean;
  trace?: TraceEnrichment;
}

/** 監査行収集の既定上限。 */
export const DEFAULT_MAX_ROWS = 10000;

export interface CollectResult {
  rows: EnrichedAuditRow[];
  truncated: boolean;
}

/**
 * フィルタに合致する監査ログを収集し、AI関与情報を補完する。
 * - 500件バッチでページング、maxRows で打ち切り（truncated フラグで通知）。
 * - payload の JSON 解析失敗は payloadParseError=true で続行（例外を投げない）。
 */
export async function collectAuditRows(
  filters: AuditFilters,
  maxRows: number = DEFAULT_MAX_ROWS
): Promise<CollectResult> {
  const where = buildAuditWhere(filters);
  const batchSize = 500;
  const records: AuditLogRecord[] = [];
  let truncated = false;

  let skip = 0;
  // 上限+1件まで読み、超過を検知して truncated を立てる
  while (records.length < maxRows) {
    const take = Math.min(batchSize, maxRows - records.length + 1);
    const batch = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    });
    if (batch.length === 0) break;

    for (const r of batch) {
      if (records.length >= maxRows) {
        truncated = true;
        break;
      }
      records.push(r as AuditLogRecord);
    }
    if (batch.length < take) break; // これ以上ない
    skip += batch.length;
  }

  // payload を解析
  const rows: EnrichedAuditRow[] = records.map(r => {
    let payloadParsed: Record<string, unknown> | null = null;
    let payloadParseError = false;
    if (r.payload != null) {
      try {
        const parsed = JSON.parse(typeof r.payload === 'string' ? r.payload : String(r.payload));
        payloadParsed =
          parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
      } catch {
        payloadParseError = true;
      }
    }
    return { ...r, payloadParsed, payloadParseError };
  });

  // traceId をまとめて補完
  const traceIds = [...new Set(rows.map(r => r.traceId).filter((t): t is string => !!t))];
  if (traceIds.length > 0) {
    const enrichmentMap = await buildTraceEnrichments(traceIds);
    for (const row of rows) {
      if (row.traceId && enrichmentMap.has(row.traceId)) {
        row.trace = enrichmentMap.get(row.traceId);
      }
    }
  }

  return { rows, truncated };
}

/**
 * traceId 群に対する WorkflowExecution を1回のクエリで取得し補完情報を構築する。
 */
async function buildTraceEnrichments(traceIds: string[]): Promise<Map<string, TraceEnrichment>> {
  const executions = await prisma.workflowExecution.findMany({
    where: { traceId: { in: traceIds } },
    include: {
      taskExecutions: {
        select: {
          gitCommitHash: true,
          llmModelUsed: true,
          llmTokensInput: true,
          llmTokensOutput: true,
        },
      },
      approvalRequests: {
        orderBy: { createdAt: 'asc' },
        select: { decision: true, decidedBy: true, reason: true, decidedAt: true },
      },
    },
  });

  const langfuseHost = process.env.LANGFUSE_HOST || process.env.NEXT_PUBLIC_LANGFUSE_HOST;
  const map = new Map<string, TraceEnrichment>();

  for (const exec of executions) {
    const llmModelsUsed = [
      ...new Set(
        exec.taskExecutions.map(t => t.llmModelUsed).filter((m): m is string => m !== null)
      ),
    ];
    const gitCommitHashes = [
      ...new Set(exec.taskExecutions.map(t => t.gitCommitHash).filter((h): h is string => !!h)),
    ];
    const totalTokensInput = exec.taskExecutions.reduce((s, t) => s + (t.llmTokensInput ?? 0), 0);
    const totalTokensOutput = exec.taskExecutions.reduce((s, t) => s + (t.llmTokensOutput ?? 0), 0);

    map.set(exec.traceId, {
      flowId: exec.flowId,
      workflowStatus: exec.status,
      llmModelsUsed,
      totalTokensInput,
      totalTokensOutput,
      gitCommitHashes,
      approvals: exec.approvalRequests.map(a => ({
        decision: a.decision,
        decidedBy: a.decidedBy,
        reason: a.reason,
        decidedAt: a.decidedAt,
      })),
      langfuseTraceUrl: langfuseHost ? `${langfuseHost}/trace/${exec.traceId}` : null,
    });
  }

  return map;
}

// --------------------------------------------------------
// 表示用ヘルパー
// --------------------------------------------------------

/** 日時を JST 表記にする。 */
function formatJst(date: Date): string {
  return new Date(date).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** payload から「理由・意図」を抽出する。 */
function extractReason(payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  for (const key of ['intent', 'reason', 'description', 'summary']) {
    const v = payload[key];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return '';
}

/** payload の生表現（CSV/詳細列用）。 */
function payloadDisplay(row: EnrichedAuditRow): string {
  if (row.payloadParseError) {
    return typeof row.payload === 'string' ? row.payload : '[解析エラー]';
  }
  if (row.payloadParsed) return JSON.stringify(row.payloadParsed);
  return '';
}

// --------------------------------------------------------
// CSV レンダリング
// --------------------------------------------------------

const CSV_HEADERS = [
  '日時',
  '操作者',
  'アクション',
  '対象種別',
  '対象ID',
  'TraceID',
  '理由・意図',
  '詳細(JSON)',
  'AIモデル',
  'トークン(入力/出力)',
  '承認者',
  '承認判断',
  '承認理由',
  'Gitコミット',
  'LangfuseURL',
];

/** 監査行を BOM 付き CSV にする（Excel 直接オープン対応）。 */
export function renderAuditCsv(rows: EnrichedAuditRow[]): string {
  const data = rows.map(row => {
    const t = row.trace;
    const approvals = t?.approvals ?? [];
    return [
      formatJst(row.createdAt),
      row.actor,
      row.action,
      row.entityType,
      row.entityId,
      row.traceId ?? '',
      extractReason(row.payloadParsed),
      payloadDisplay(row),
      t ? t.llmModelsUsed.join('; ') : '',
      t ? `${t.totalTokensInput}/${t.totalTokensOutput}` : '',
      approvals
        .map(a => a.decidedBy ?? '')
        .filter(Boolean)
        .join('; '),
      approvals
        .map(a => a.decision ?? '')
        .filter(Boolean)
        .join('; '),
      approvals
        .map(a => a.reason ?? '')
        .filter(Boolean)
        .join('; '),
      t ? t.gitCommitHashes.join('; ') : '',
      t?.langfuseTraceUrl ?? '',
    ];
  });
  return toCsvWithBom(CSV_HEADERS, data);
}

// --------------------------------------------------------
// HTML レンダリング
// --------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function describeFilters(filters: AuditFilters): string {
  const parts: string[] = [];
  if (filters.startDate) parts.push(`開始: ${formatJst(filters.startDate)}`);
  if (filters.endDate) parts.push(`終了: ${formatJst(filters.endDate)}`);
  if (filters.action) parts.push(`アクション: ${filters.action}`);
  if (filters.entityType) parts.push(`対象種別: ${filters.entityType}`);
  if (filters.entityId) parts.push(`対象ID: ${filters.entityId}`);
  if (filters.actor) parts.push(`操作者: ${filters.actor}`);
  if (filters.traceId) parts.push(`TraceID: ${filters.traceId}`);
  return parts.length > 0 ? parts.join(' / ') : '（フィルタなし: 全件）';
}

/**
 * 監査行を自己完結の印刷可能HTMLレポートにする。
 * - 外部アセットなし（保存・メール送付可）。
 * - @media print でブラウザのPDF印刷に最適化。
 */
export function renderAuditHtml(
  rows: EnrichedAuditRow[],
  filters: AuditFilters,
  generatedBy: string,
  options: { truncated?: boolean; maxRows?: number; generatedAt?: Date } = {}
): string {
  const generatedAt = options.generatedAt ?? new Date();

  // サマリー: アクション別件数
  const actionCounts = new Map<string, number>();
  const actors = new Set<string>();
  for (const row of rows) {
    actionCounts.set(row.action, (actionCounts.get(row.action) ?? 0) + 1);
    actors.add(row.actor);
  }
  const actionSummaryRows = [...actionCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(
      ([action, count]) => `<tr><td>${escapeHtml(action)}</td><td class="num">${count}</td></tr>`
    )
    .join('\n');

  const truncationNote = options.truncated
    ? `<p class="warn">⚠ 件数が上限（${options.maxRows ?? DEFAULT_MAX_ROWS}件）に達したため、最新の${
        options.maxRows ?? DEFAULT_MAX_ROWS
      }件のみを表示しています。期間やフィルタを絞って再出力してください。</p>`
    : '';

  const detailRows = rows
    .map(row => {
      const t = row.trace;
      const reason = extractReason(row.payloadParsed);
      const aiParts: string[] = [];
      if (t) {
        if (t.llmModelsUsed.length)
          aiParts.push(`モデル: ${escapeHtml(t.llmModelsUsed.join(', '))}`);
        if (t.totalTokensInput || t.totalTokensOutput)
          aiParts.push(`トークン: ${t.totalTokensInput}/${t.totalTokensOutput}`);
        for (const a of t.approvals) {
          if (a.decision) {
            const who = a.decidedBy ? ` by ${escapeHtml(a.decidedBy)}` : '';
            const why = a.reason ? `（理由: ${escapeHtml(a.reason)}）` : '';
            aiParts.push(`承認判断: ${escapeHtml(a.decision)}${who}${why}`);
          }
        }
        if (t.gitCommitHashes.length)
          aiParts.push(`Gitコミット: ${escapeHtml(t.gitCommitHashes.join(', '))}`);
        if (t.langfuseTraceUrl)
          aiParts.push(
            `<a href="${escapeHtml(t.langfuseTraceUrl)}" target="_blank" rel="noopener">Langfuseトレース</a>`
          );
      }
      const aiCell = aiParts.length ? aiParts.join('<br>') : '—';
      const payloadCell = row.payloadParseError
        ? `<span class="badge-error">payload解析エラー</span> <code>${escapeHtml(
            payloadDisplay(row)
          )}</code>`
        : row.payloadParsed
          ? `<code>${escapeHtml(JSON.stringify(row.payloadParsed))}</code>`
          : '—';

      return `<tr>
        <td class="nowrap">${escapeHtml(formatJst(row.createdAt))}</td>
        <td>${escapeHtml(row.actor)}</td>
        <td>${escapeHtml(row.action)}</td>
        <td>${escapeHtml(row.entityType)} / ${escapeHtml(row.entityId)}</td>
        <td>${reason ? escapeHtml(reason) : '—'}</td>
        <td>${aiCell}</td>
        <td class="payload">${payloadCell}</td>
      </tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>FlowOps 監査レポート</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif; color: #1a1a1a; margin: 24px; font-size: 13px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 24px 0 8px; border-bottom: 2px solid #2563eb; padding-bottom: 4px; }
  .meta { color: #444; font-size: 12px; line-height: 1.7; }
  .meta strong { color: #000; }
  .warn { background: #fef3c7; border: 1px solid #f59e0b; padding: 8px 12px; border-radius: 6px; color: #92400e; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f3f4f6; font-weight: 600; }
  td.num { text-align: right; }
  td.nowrap { white-space: nowrap; }
  td.payload { max-width: 320px; word-break: break-all; }
  code { font-family: "SFMono-Regular", Consolas, monospace; font-size: 11px; }
  .summary-table { width: auto; min-width: 280px; }
  .badge-error { display: inline-block; background: #fee2e2; color: #b91c1c; border-radius: 4px; padding: 1px 6px; font-size: 11px; }
  a { color: #2563eb; }
  @media print {
    body { margin: 0; font-size: 11px; }
    h2 { break-after: avoid; }
    tr { break-inside: avoid; }
    a { color: #000; text-decoration: underline; }
  }
</style>
</head>
<body>
  <h1>FlowOps 監査レポート</h1>
  <div class="meta">
    <div><strong>生成日時:</strong> ${escapeHtml(formatJst(generatedAt))}</div>
    <div><strong>生成者:</strong> ${escapeHtml(generatedBy)}</div>
    <div><strong>適用フィルタ:</strong> ${escapeHtml(describeFilters(filters))}</div>
    <div><strong>総件数:</strong> ${rows.length} 件</div>
  </div>
  ${truncationNote}

  <h2>サマリー</h2>
  <table class="summary-table">
    <thead><tr><th>アクション</th><th>件数</th></tr></thead>
    <tbody>
      ${actionSummaryRows || '<tr><td colspan="2">該当なし</td></tr>'}
    </tbody>
  </table>
  <p class="meta"><strong>操作者一覧:</strong> ${
    actors.size ? escapeHtml([...actors].join(', ')) : '—'
  }</p>

  <h2>明細（誰が・いつ・何を・なぜ・AI関与）</h2>
  <table>
    <thead>
      <tr>
        <th>日時</th><th>操作者</th><th>アクション</th><th>対象</th>
        <th>理由・意図</th><th>AI関与</th><th>詳細(payload)</th>
      </tr>
    </thead>
    <tbody>
      ${detailRows || '<tr><td colspan="7">該当する監査ログはありません。</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}
