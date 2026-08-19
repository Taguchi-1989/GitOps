/**
 * FlowOps - グローバル検索 API
 *
 * GET /api/search?q= - 改善カード・フロー・ヘルプ記事を横断検索
 *
 * 認証・レート制限は proxy.ts（middleware）が担当する。
 */

import { NextRequest } from 'next/server';
import { successResponse, internalErrorResponse } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';
import { listFlows } from '@/lib/flow-service';
import { searchHelp } from '@/lib/help-content';
import type { SearchResults } from '@/core/types/search';

export const dynamic = 'force-dynamic';

/** グループごとの最大件数 */
const GROUP_LIMIT = 5;

/**
 * GET /api/search
 * q が空のときは空の結果を返す（クエリ無しで全件を舐めない）
 */
export async function GET(request: NextRequest) {
  try {
    const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

    const empty: SearchResults = { issues: [], flows: [], help: [] };
    if (!query) {
      return successResponse(empty);
    }

    const [issues, flows] = await Promise.all([
      // 改善カードはステータスタブに依存せず全件から探す。
      // contains は SQLite（正本DB）では大小文字を区別しないため mode 指定は不要。
      // PostgreSQL へ移行する際は mode: 'insensitive' が必要になる。
      prisma.issue.findMany({
        where: {
          deletedAt: null,
          OR: [
            { title: { contains: query } },
            { description: { contains: query } },
            { humanId: { contains: query } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        take: GROUP_LIMIT,
        select: { id: true, humanId: true, title: true, status: true },
      }),
      listFlows(),
    ]);

    const lowered = query.toLowerCase();
    const flowHits = flows
      .filter(
        flow =>
          flow.title.toLowerCase().includes(lowered) || flow.id.toLowerCase().includes(lowered)
      )
      .slice(0, GROUP_LIMIT)
      .map(flow => ({ id: flow.id, title: flow.title, layer: flow.layer }));

    const results: SearchResults = {
      issues,
      flows: flowHits,
      help: searchHelp(query, GROUP_LIMIT).map(hit => ({
        slug: hit.slug,
        title: hit.title,
        excerpt: hit.excerpt,
      })),
    };

    return successResponse(results);
  } catch (error) {
    return internalErrorResponse(error);
  }
}
