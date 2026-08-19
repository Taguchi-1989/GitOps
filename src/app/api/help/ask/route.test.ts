/**
 * FlowOps - AIヘルプ API Route Tests
 *
 * POST /api/help/ask - 記事ヒット / LLM未構成フォールバック / バリデーション
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

// --------------------------------------------------------
// Mocks
// --------------------------------------------------------

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      body,
      status: init?.status || 200,
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('@/core/llm', () => ({
  getLLMClient: vi.fn(),
}));

vi.mock('@/core/audit', () => ({
  auditLog: { record: vi.fn() },
}));

// --------------------------------------------------------
// Imports
// --------------------------------------------------------

import { getLLMClient } from '@/core/llm';
import { auditLog } from '@/core/audit';

/** body と headers だけを持つ最小のリクエスト */
function makeRequest(body: unknown): any {
  return {
    json: async () => body,
    headers: { get: () => 'tester' },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // 既定はLLM未構成（本番でも LLM_API_KEY 未設定なら createLLMClient が投げる）
  vi.mocked(getLLMClient).mockImplementation(() => {
    throw new Error('LLM_API_KEY is not set');
  });
});

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('POST /api/help/ask', () => {
  it('質問が短すぎるときは400を返す', async () => {
    const result: any = await POST(makeRequest({ question: 'あ' }));

    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
    expect(result.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('question が無いときは400を返す', async () => {
    const result: any = await POST(makeRequest({ currentPath: '/issues' }));

    expect(result.status).toBe(400);
    expect(result.body.ok).toBe(false);
  });

  it('LLM未構成でも記事だけを返す（エラーにしない）', async () => {
    const result: any = await POST(
      makeRequest({ question: '改善カードはどうやって作るの？', currentPath: '/issues' })
    );

    expect(result.status).toBe(200);
    expect(result.body.ok).toBe(true);
    expect(result.body.data.answer).toBeNull();
    expect(result.body.data.sources.length).toBeGreaterThan(0);
    expect(result.body.data.sources[0]).toHaveProperty('screens');
  });

  it('自然文の質問から関連記事を選ぶ（キーワードの逆照合）', async () => {
    const result: any = await POST(makeRequest({ question: '承認待ちって何をすればいいの' }));

    const slugs = result.body.data.sources.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain('approvals');
  });

  it('currentPath に一致する記事を加点する', async () => {
    const result: any = await POST(
      makeRequest({ question: 'ステップの意味がわからない', currentPath: '/flows' })
    );

    const slugs = result.body.data.sources.map((s: { slug: string }) => s.slug);
    expect(slugs).toContain('view-and-edit-flow');
  });

  it('関連記事が無いときはLLMを呼ばず空で返す', async () => {
    const result: any = await POST(makeRequest({ question: 'zzzznotfoundzzzz について教えて' }));

    expect(result.body.data).toEqual({ answer: null, sources: [] });
    expect(getLLMClient).not.toHaveBeenCalled();
    expect(auditLog.record).not.toHaveBeenCalled();
  });

  it('LLM構成済みなら回答を返し、監査ログを残す', async () => {
    const generateText = vi.fn().mockResolvedValue('「新規作成」を押してください。 /issues/new');
    vi.mocked(getLLMClient).mockReturnValue({ generateText } as never);

    const result: any = await POST(
      makeRequest({ question: '改善カードはどうやって作るの？', currentPath: '/issues' })
    );

    expect(result.body.data.answer).toContain('新規作成');
    expect(generateText).toHaveBeenCalledTimes(1);
    // 記事本文だけを根拠にするようプロンプトへ載せている
    const prompt = generateText.mock.calls[0][0];
    expect(prompt.system).toContain('抜粋');
    expect(prompt.user).toContain('改善カードはどうやって作るの？');

    expect(auditLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'HELP_ASK',
        entityType: 'System',
        payload: expect.objectContaining({ answered: true }),
      })
    );
  });

  it('LLM呼び出しが失敗しても記事だけで200を返す', async () => {
    const generateText = vi.fn().mockRejectedValue(new Error('boom'));
    vi.mocked(getLLMClient).mockReturnValue({ generateText } as never);

    const result: any = await POST(makeRequest({ question: '効果確認のやり方を教えて' }));

    expect(result.status).toBe(200);
    expect(result.body.data.answer).toBeNull();
    expect(result.body.data.sources.length).toBeGreaterThan(0);
  });

  it('JSONとして壊れたボディは400を返す', async () => {
    const request: any = {
      json: async () => {
        throw new Error('bad json');
      },
      headers: { get: () => null },
    };

    const result: any = await POST(request);

    expect(result.status).toBe(400);
  });
});
