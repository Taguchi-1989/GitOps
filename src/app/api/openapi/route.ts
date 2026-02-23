/**
 * FlowOps - OpenAPI Specification
 *
 * GET /api/openapi - OpenAPI 3.0 JSON仕様を返す
 */

import { NextResponse } from 'next/server';

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'FlowOps API',
    version: '0.1.0',
    description: '業務フローをYAMLとGitで管理するGitOpsプラットフォーム',
  },
  servers: [{ url: '/api', description: 'FlowOps API' }],
  components: {
    schemas: {
      ApiResponse: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          data: {},
          errorCode: { type: 'string' },
          details: { type: 'string' },
        },
        required: ['ok'],
      },
      Issue: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          humanId: { type: 'string', example: 'ISS-001' },
          title: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: [
              'new',
              'triage',
              'in-progress',
              'proposed',
              'merged',
              'rejected',
              'merged-duplicate',
            ],
          },
          targetFlowId: { type: 'string', nullable: true },
          targetNodeId: { type: 'string', nullable: true },
          branchName: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      Proposal: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          issueId: { type: 'string' },
          intent: { type: 'string' },
          jsonPatch: { type: 'string', description: 'RFC 6902 JSON Patch array (stringified)' },
          diffPreview: { type: 'string', nullable: true },
          baseHash: { type: 'string', nullable: true },
          isApplied: { type: 'boolean' },
          appliedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Flow: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          layer: { type: 'string', enum: ['L0', 'L1', 'L2'] },
          nodeCount: { type: 'integer' },
          edgeCount: { type: 'integer' },
        },
      },
      AuditLog: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          actor: { type: 'string' },
          action: { type: 'string' },
          entityType: { type: 'string' },
          entityId: { type: 'string' },
          payload: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
          hasMore: { type: 'boolean' },
        },
      },
    },
    securitySchemes: {
      session: {
        type: 'apiKey',
        in: 'cookie',
        name: 'next-auth.session-token',
      },
    },
  },
  security: [{ session: [] }],
  paths: {
    '/health': {
      get: {
        summary: 'ヘルスチェック',
        tags: ['System'],
        security: [],
        responses: {
          200: { description: 'Healthy' },
        },
      },
    },
    '/flows': {
      get: {
        summary: 'フロー一覧',
        tags: ['Flows'],
        responses: {
          200: { description: 'フロー一覧' },
        },
      },
    },
    '/flows/{id}': {
      get: {
        summary: 'フロー詳細（Mermaid付き）',
        tags: ['Flows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'フロー詳細' },
          404: { description: 'Not found' },
        },
      },
    },
    '/issues': {
      get: {
        summary: 'Issue一覧',
        tags: ['Issues'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'targetFlowId', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: 'Issue一覧とページネーション' } },
      },
      post: {
        summary: 'Issue作成',
        tags: ['Issues'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'description'],
                properties: {
                  title: { type: 'string', minLength: 1 },
                  description: { type: 'string', minLength: 1 },
                  targetFlowId: { type: 'string' },
                  targetNodeId: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Issue created' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/issues/{id}': {
      get: {
        summary: 'Issue詳細',
        tags: ['Issues'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Issue詳細' }, 404: { description: 'Not found' } },
      },
      patch: {
        summary: 'Issue更新',
        tags: ['Issues'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
      },
      delete: {
        summary: 'Issue削除',
        tags: ['Issues'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
      },
    },
    '/issues/{id}/start': {
      post: {
        summary: '作業開始（ブランチ作成）',
        tags: ['Issues'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'ブランチ作成成功' },
          400: { description: 'ステータスエラー' },
          404: { description: 'Not found' },
        },
      },
    },
    '/issues/{id}/proposals/generate': {
      post: {
        summary: 'LLM提案生成',
        tags: ['Proposals'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          201: { description: '提案生成成功' },
          400: { description: 'ステータスエラー' },
          500: { description: 'LLMエラー' },
        },
      },
    },
    '/proposals/{id}/apply': {
      post: {
        summary: '提案をYAMLに適用',
        tags: ['Proposals'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: '適用成功' },
          400: { description: 'パッチ適用失敗' },
          409: { description: '陳腐化（baseHash不一致）' },
        },
      },
    },
    '/issues/{id}/merge-close': {
      post: {
        summary: 'マージ＆クローズ',
        tags: ['Issues'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'マージ成功' },
          400: { description: 'ステータスエラー' },
        },
      },
    },
    '/issues/{id}/merge-duplicate': {
      post: {
        summary: '重複Issue統合',
        tags: ['Issues'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['canonicalId'],
                properties: { canonicalId: { type: 'string' } },
              },
            },
          },
        },
        responses: { 200: { description: '統合成功' } },
      },
    },
    '/audit': {
      get: {
        summary: '監査ログ照会',
        tags: ['Audit'],
        parameters: [
          { name: 'entityType', in: 'query', schema: { type: 'string' } },
          { name: 'entityId', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: '監査ログ一覧' } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
