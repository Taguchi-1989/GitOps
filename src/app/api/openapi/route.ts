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
      AimsEvidenceInput: {
        type: 'object',
        required: ['title', 'sourceText'],
        properties: {
          title: { type: 'string', minLength: 1, maxLength: 200 },
          sourceText: { type: 'string', minLength: 1, maxLength: 500000 },
          sourceType: { type: 'string', default: 'historical-text' },
          sourceLabel: { type: 'string', maxLength: 500 },
          sensitivityLevel: {
            type: 'string',
            enum: ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'],
            default: 'L2',
          },
          occurredAt: { type: 'string', format: 'date-time' },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 50 },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
      AimsReviewOutput: {
        type: 'object',
        required: ['schemaVersion', 'executiveSummary', 'humanDecisionRequired', 'confidence'],
        properties: {
          schemaVersion: { type: 'string', enum: ['aims-review.v1'] },
          reviewScope: { type: 'string' },
          executiveSummary: { type: 'string' },
          sourceSummary: { type: 'string' },
          claims: { type: 'array', items: { type: 'object' } },
          controlAssessments: { type: 'array', items: { type: 'object' } },
          risks: { type: 'array', items: { type: 'object' } },
          findings: { type: 'array', items: { type: 'object' } },
          uncertainties: { type: 'array', items: { type: 'string' } },
          disagreements: { type: 'array', items: { type: 'object' } },
          recommendedActions: { type: 'array', items: { type: 'object' } },
          humanDecisionRequired: { type: 'boolean', enum: [true] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          extensions: { type: 'object', additionalProperties: true },
        },
      },
      DexpiDocument: {
        type: 'object',
        required: ['schemaVersion', 'standard', 'profile', 'model', 'rootObjectIds', 'objects'],
        properties: {
          schemaVersion: { type: 'string', enum: ['flowops-dexpi.v1'] },
          standard: {
            type: 'object',
            properties: {
              name: { type: 'string', enum: ['DEXPI'] },
              version: { type: 'string', enum: ['2.0.0'] },
              serialization: { type: 'string', enum: ['DEXPI_XML'] },
            },
          },
          profile: {
            type: 'string',
            enum: ['dexpi-2.0-structural', 'flowops-conceptual'],
          },
          model: { type: 'object', additionalProperties: true },
          rootObjectIds: { type: 'array', items: { type: 'string' } },
          objects: { type: 'object', additionalProperties: true },
          metadata: { type: 'object', additionalProperties: { type: 'string' } },
        },
      },
    },
    securitySchemes: {
      session: {
        type: 'apiKey',
        in: 'cookie',
        name: 'authjs.session-token',
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
    '/aims/evidence': {
      get: {
        summary: 'AIMS証拠一覧（原文を除く）',
        tags: ['AIMS'],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: '証拠一覧とページネーション' } },
      },
      post: {
        summary: '過去テキストをAIMS証拠として取り込む',
        tags: ['AIMS'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AimsEvidenceInput' },
            },
          },
        },
        responses: {
          201: { description: '原文ハッシュ付きで取り込み完了' },
          400: { description: 'Validation error' },
        },
      },
    },
    '/aims/evidence/{id}': {
      get: {
        summary: 'AIMS証拠とレビュー履歴を取得',
        tags: ['AIMS'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '証拠詳細' }, 404: { description: 'Not found' } },
      },
    },
    '/aims/evidence/{id}/reviews': {
      post: {
        summary: '複数LLMによる独立レビューと統合を実行',
        description:
          '各モデル出力は助言であり、人の最終判断を必要とする。機密検査、モデル別記録、統合、出力検査を行う。',
        tags: ['AIMS'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  objective: { type: 'string', maxLength: 2000 },
                  reviewerIds: {
                    type: 'array',
                    minItems: 1,
                    maxItems: 8,
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'レビュー完了または一部成功' },
          413: { description: '設定されたレビュー長上限を超過' },
          422: { description: 'Ingress/Egress Gateがブロック' },
          502: { description: '全独立レビューが失敗' },
        },
      },
    },
    '/aims/reviews/{id}': {
      get: {
        summary: 'モデル別結果と統合結果を取得',
        tags: ['AIMS'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'レビュー詳細' }, 404: { description: 'Not found' } },
      },
    },
    '/aims/reviews/{id}/decision': {
      post: {
        summary: 'AIMSレビューに対する人の判断を理由付きで記録',
        tags: ['AIMS'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['decision', 'reason'],
                properties: {
                  decision: { type: 'string', enum: ['approved', 'revise', 'rejected'] },
                  reason: { type: 'string', minLength: 1, maxLength: 4000 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '判断記録完了' },
          409: { description: '未完了または判断記録済み' },
        },
      },
    },
    '/dexpi/import': {
      post: {
        summary: 'JSON・Mermaid・DeXPI XML 2.0を正規化JSONへ取り込む',
        description:
          'DeXPI 2.0 DEXPI XMLを対象とする。Mermaid入力は概念接続プロファイルとして警告付きで変換する。',
        tags: ['DeXPI'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['format', 'content'],
                properties: {
                  format: { type: 'string', enum: ['json', 'mermaid', 'dexpi-xml'] },
                  content: { type: 'string', maxLength: 5000000 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '正規化JSON、Mermaid、検証結果' },
          400: { description: '構文・参照・形式エラー' },
        },
      },
    },
    '/dexpi/export': {
      post: {
        summary: '正規化JSONをJSON・Mermaid・DeXPI XML 2.0へ出力する',
        tags: ['DeXPI'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['format', 'document'],
                properties: {
                  format: { type: 'string', enum: ['json', 'mermaid', 'dexpi-xml'] },
                  document: { $ref: '#/components/schemas/DexpiDocument' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: '出力内容、MIME type、ファイル名' },
          400: { description: '正規化JSONの検証エラー' },
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
    '/issues/{id}/standardize': {
      post: {
        summary: '効果確認済みの改善を標準化',
        tags: ['Issues'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '標準化成功' } },
      },
    },
    '/issues/{id}/proposals/import': {
      post: {
        summary: '外部エージェントの提案を取り込み',
        tags: ['Proposals'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: '提案取り込み成功' } },
      },
    },
    '/issues/{id}/proposals/prompt': {
      get: {
        summary: '外部エージェント向け提案プロンプトを取得',
        tags: ['Proposals'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'プロンプト' } },
      },
    },
    '/flows/create': {
      post: {
        summary: 'フローを新規作成',
        tags: ['Flows'],
        responses: { 201: { description: 'フロー作成成功' } },
      },
    },
    '/flows/draft': {
      post: {
        summary: 'LLMでフロー下書きを生成',
        tags: ['Flows'],
        responses: { 200: { description: 'フロー下書き' } },
      },
    },
    '/flows/import': {
      post: {
        summary: 'YAMLフローを取り込み',
        tags: ['Flows'],
        responses: { 201: { description: '取り込み成功' } },
      },
    },
    '/flows/from-image': {
      post: {
        summary: '画像からフロー下書きを生成',
        tags: ['Flows'],
        responses: { 200: { description: 'フロー下書き' } },
      },
    },
    '/flows/{id}/expand': {
      post: {
        summary: 'フロー階層を展開',
        tags: ['Flows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '展開結果' } },
      },
    },
    '/flows/{id}/grid-proposal': {
      post: {
        summary: 'グリッド編集内容から提案を生成',
        tags: ['Flows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: '提案生成成功' } },
      },
    },
    '/flows/{id}/validate-structure': {
      post: {
        summary: 'フロー構造を検証',
        tags: ['Flows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '構造検証結果' } },
      },
    },
    '/workflows': {
      get: {
        summary: 'ワークフロー実行一覧',
        tags: ['Workflows'],
        responses: { 200: { description: '実行一覧' } },
      },
      post: {
        summary: 'ワークフロー実行を開始',
        tags: ['Workflows'],
        responses: { 201: { description: '実行開始' } },
      },
    },
    '/workflows/{id}': {
      get: {
        summary: 'ワークフロー実行詳細',
        tags: ['Workflows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '実行詳細' } },
      },
    },
    '/workflows/{id}/approve': {
      post: {
        summary: '保留中の判断を承認・差戻し・停止',
        tags: ['Workflows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '判断を記録' } },
      },
    },
    '/workflows/{id}/cancel': {
      post: {
        summary: 'ワークフロー実行を中止',
        tags: ['Workflows'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '中止成功' } },
      },
    },
    '/tasks': {
      get: {
        summary: 'マイクロタスク一覧',
        tags: ['Tasks'],
        responses: { 200: { description: 'タスク一覧' } },
      },
    },
    '/tasks/{id}': {
      get: {
        summary: 'マイクロタスク詳細',
        tags: ['Tasks'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'タスク詳細' } },
      },
    },
    '/tasks/{id}/test': {
      post: {
        summary: 'マイクロタスクを試験実行',
        tags: ['Tasks'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '試験結果' } },
      },
    },
    '/data-objects': {
      get: {
        summary: 'データオブジェクト一覧',
        tags: ['Data Objects'],
        responses: { 200: { description: 'オブジェクト一覧' } },
      },
      post: {
        summary: 'データオブジェクト作成',
        tags: ['Data Objects'],
        responses: { 201: { description: '作成成功' } },
      },
    },
    '/data-objects/{id}': {
      get: {
        summary: 'データオブジェクト詳細',
        tags: ['Data Objects'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'オブジェクト詳細' } },
      },
      patch: {
        summary: 'データオブジェクト更新',
        tags: ['Data Objects'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '更新成功' } },
      },
      delete: {
        summary: 'データオブジェクト削除',
        tags: ['Data Objects'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '削除成功' } },
      },
    },
    '/data-objects/{id}/references': {
      get: {
        summary: 'データ参照関係を取得',
        tags: ['Data Objects'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: '参照一覧' } },
      },
      post: {
        summary: 'データ参照関係を追加',
        tags: ['Data Objects'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 201: { description: '参照追加成功' } },
      },
    },
    '/data-objects/{id}/access-check': {
      post: {
        summary: 'データオブジェクトへのアクセス可否を判定',
        tags: ['Data Objects'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'アクセス判定' } },
      },
    },
    '/governance/trace/{traceId}': {
      get: {
        summary: 'Trace IDに紐づくガバナンス判定を取得',
        tags: ['Governance'],
        parameters: [{ name: 'traceId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'ガバナンストレース' } },
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
    '/audit/export': {
      get: {
        summary: '監査ログをCSVまたはJSONで出力',
        tags: ['Audit'],
        parameters: [
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'json'] } },
          { name: 'actor', in: 'query', schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string' } },
        ],
        responses: { 200: { description: '監査ログファイル' } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
