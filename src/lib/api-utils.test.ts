/**
 * FlowOps - API Utilities Tests
 *
 * API Route用のユーティリティ関数のテスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  internalErrorResponse,
  validationErrorResponse,
  parseBody,
  sanitizeFlowId,
  getIdParam,
} from './api-utils';
import { API_ERROR_CODES } from '@/core/types/api';

// --------------------------------------------------------
// Mocks
// --------------------------------------------------------

// next/server のモック
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body, init) => ({
      body,
      status: init?.status || 200,
    })),
  },
}));

// logger のモック
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

/** モックレスポンスからbodyを取得するヘルパー */
function getBody(result: any): any {
  return result.body;
}

// --------------------------------------------------------
// Tests
// --------------------------------------------------------

describe('api-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --------------------------------------------------------
  // successResponse
  // --------------------------------------------------------
  describe('successResponse', () => {
    it('should return success response with data and default status 200', () => {
      const data = { id: '123', name: 'Test' };
      const result = successResponse(data);

      expect(NextResponse.json).toHaveBeenCalledWith({ ok: true, data }, { status: 200 });
      expect(getBody(result)).toEqual({ ok: true, data });
      expect(result.status).toBe(200);
    });

    it('should return success response with custom status code', () => {
      const data = { created: true };
      const result = successResponse(data, 201);

      expect(NextResponse.json).toHaveBeenCalledWith({ ok: true, data }, { status: 201 });
      expect(result.status).toBe(201);
    });

    it('should handle null data', () => {
      const result = successResponse(null);

      expect(getBody(result)).toEqual({ ok: true, data: null });
      expect(result.status).toBe(200);
    });

    it('should handle array data', () => {
      const data = [1, 2, 3];
      const result = successResponse(data);

      expect(getBody(result)).toEqual({ ok: true, data: [1, 2, 3] });
    });
  });

  // --------------------------------------------------------
  // errorResponse
  // --------------------------------------------------------
  describe('errorResponse', () => {
    it('should return error response with error code and default status 400', () => {
      const result = errorResponse(API_ERROR_CODES.VALIDATION_ERROR, 'Invalid input');

      expect(NextResponse.json).toHaveBeenCalledWith(
        {
          ok: false,
          errorCode: 'VALIDATION_ERROR',
          details: 'Invalid input',
        },
        { status: 400 }
      );
      expect(getBody(result).ok).toBe(false);
      expect(result.status).toBe(400);
    });

    it('should return error response with custom status code', () => {
      const result = errorResponse(API_ERROR_CODES.INTERNAL_ERROR, 'Server error', 500);

      expect(getBody(result)).toEqual({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        details: 'Server error',
      });
      expect(result.status).toBe(500);
    });

    it('should handle error response without details', () => {
      const result = errorResponse(API_ERROR_CODES.NOT_FOUND);

      expect(getBody(result)).toEqual({
        ok: false,
        errorCode: 'NOT_FOUND',
        details: undefined,
      });
    });
  });

  // --------------------------------------------------------
  // notFoundResponse
  // --------------------------------------------------------
  describe('notFoundResponse', () => {
    it('should return 404 with default message', () => {
      const result = notFoundResponse();

      expect(getBody(result)).toEqual({
        ok: false,
        errorCode: 'NOT_FOUND',
        details: 'Resource not found',
      });
      expect(result.status).toBe(404);
    });

    it('should return 404 with custom resource name', () => {
      const result = notFoundResponse('Issue');

      expect(getBody(result)).toEqual({
        ok: false,
        errorCode: 'NOT_FOUND',
        details: 'Issue not found',
      });
      expect(result.status).toBe(404);
    });
  });

  // --------------------------------------------------------
  // internalErrorResponse
  // --------------------------------------------------------
  describe('internalErrorResponse', () => {
    it('should handle Error objects and log error', () => {
      const error = new Error('Database connection failed');
      const result = internalErrorResponse(error);

      expect(getBody(result)).toEqual({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        details: 'Database connection failed',
      });
      expect(result.status).toBe(500);
    });

    it('should handle non-Error objects', () => {
      const error = { message: 'Something went wrong' };
      const result = internalErrorResponse(error);

      expect(getBody(result)).toEqual({
        ok: false,
        errorCode: 'INTERNAL_ERROR',
        details: 'Unknown error',
      });
      expect(result.status).toBe(500);
    });

    it('should handle string errors', () => {
      const error = 'String error message';
      const result = internalErrorResponse(error);

      expect(getBody(result).errorCode).toBe('INTERNAL_ERROR');
      expect(getBody(result).details).toBe('Unknown error');
    });

    it('should handle null/undefined errors', () => {
      const result = internalErrorResponse(null);

      expect(getBody(result).errorCode).toBe('INTERNAL_ERROR');
      expect(getBody(result).details).toBe('Unknown error');
    });
  });

  // --------------------------------------------------------
  // validationErrorResponse
  // --------------------------------------------------------
  describe('validationErrorResponse', () => {
    it('should format Zod errors correctly with single error', () => {
      const schema = z.object({ name: z.string() });
      const parseResult = schema.safeParse({ name: 123 });

      if (!parseResult.success) {
        const result = validationErrorResponse(parseResult.error);

        expect(getBody(result).ok).toBe(false);
        expect(getBody(result).errorCode).toBe('VALIDATION_ERROR');
        expect(getBody(result).details).toContain('name');
        expect(result.status).toBe(400);
      }
    });

    it('should format Zod errors correctly with multiple errors', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().min(0),
        email: z.string().email(),
      });
      const parseResult = schema.safeParse({
        name: 123,
        age: -1,
        email: 'invalid',
      });

      if (!parseResult.success) {
        const result = validationErrorResponse(parseResult.error);

        expect(getBody(result).errorCode).toBe('VALIDATION_ERROR');
        const details = getBody(result).details || '';
        expect(details).toContain('name');
        expect(details).toContain('age');
        expect(details).toContain('email');
      }
    });

    it('should format nested field errors', () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
        }),
      });
      const parseResult = schema.safeParse({ user: { name: 123 } });

      if (!parseResult.success) {
        const result = validationErrorResponse(parseResult.error);

        expect(getBody(result).details).toContain('user.name');
      }
    });
  });

  // --------------------------------------------------------
  // parseBody
  // --------------------------------------------------------
  describe('parseBody', () => {
    it('should parse valid JSON and validate successfully', async () => {
      const schema = z.object({
        title: z.string(),
        count: z.number(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({ title: 'Test', count: 42 }),
      } as unknown as Request;

      const result = await parseBody(mockRequest, schema);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({ title: 'Test', count: 42 });
    });

    it('should return validation error for invalid data', async () => {
      const schema = z.object({
        title: z.string(),
        count: z.number(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({ title: 'Test', count: 'invalid' }),
      } as unknown as Request;

      const result = await parseBody(mockRequest, schema);

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(getBody(result.error).errorCode).toBe('VALIDATION_ERROR');
      expect(getBody(result.error).details).toContain('count');
    });

    it('should return validation error for missing required fields', async () => {
      const schema = z.object({
        title: z.string(),
        count: z.number(),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({ title: 'Test' }),
      } as unknown as Request;

      const result = await parseBody(mockRequest, schema);

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(getBody(result.error).errorCode).toBe('VALIDATION_ERROR');
    });

    it('should return error for invalid JSON', async () => {
      const schema = z.object({ name: z.string() });

      const mockRequest = {
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      } as unknown as Request;

      const result = await parseBody(mockRequest, schema);

      expect(result.data).toBeNull();
      expect(result.error).toBeDefined();
      expect(getBody(result.error).errorCode).toBe('VALIDATION_ERROR');
      expect(getBody(result.error).details).toBe('Invalid JSON body');
    });

    it('should handle empty request body', async () => {
      const schema = z.object({});

      const mockRequest = {
        json: vi.fn().mockResolvedValue({}),
      } as unknown as Request;

      const result = await parseBody(mockRequest, schema);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({});
    });

    it('should validate complex nested schemas', async () => {
      const schema = z.object({
        user: z.object({
          name: z.string(),
          age: z.number().min(0),
        }),
        tags: z.array(z.string()),
      });

      const mockRequest = {
        json: vi.fn().mockResolvedValue({
          user: { name: 'Alice', age: 25 },
          tags: ['tag1', 'tag2'],
        }),
      } as unknown as Request;

      const result = await parseBody(mockRequest, schema);

      expect(result.error).toBeNull();
      expect(result.data).toEqual({
        user: { name: 'Alice', age: 25 },
        tags: ['tag1', 'tag2'],
      });
    });
  });

  // --------------------------------------------------------
  // sanitizeFlowId
  // --------------------------------------------------------
  describe('sanitizeFlowId', () => {
    it('should accept valid flow IDs with alphanumeric characters', () => {
      expect(sanitizeFlowId('flow123')).toBe('flow123');
      expect(sanitizeFlowId('Flow456')).toBe('Flow456');
      expect(sanitizeFlowId('ABC123xyz')).toBe('ABC123xyz');
    });

    it('should accept flow IDs with hyphens and underscores', () => {
      expect(sanitizeFlowId('flow-test')).toBe('flow-test');
      expect(sanitizeFlowId('flow_test')).toBe('flow_test');
      expect(sanitizeFlowId('flow-test_123')).toBe('flow-test_123');
      expect(sanitizeFlowId('my-flow_v2-final')).toBe('my-flow_v2-final');
    });

    it('should reject empty strings', () => {
      expect(sanitizeFlowId('')).toBeNull();
    });

    it('should reject flow IDs with path traversal attempts', () => {
      expect(sanitizeFlowId('../etc/passwd')).toBeNull();
      expect(sanitizeFlowId('../../secret')).toBeNull();
      expect(sanitizeFlowId('./config')).toBeNull();
      expect(sanitizeFlowId('flow/../admin')).toBeNull();
    });

    it('should reject flow IDs with special characters', () => {
      expect(sanitizeFlowId('flow/test')).toBeNull();
      expect(sanitizeFlowId('flow\\test')).toBeNull();
      expect(sanitizeFlowId('flow.test')).toBeNull();
      expect(sanitizeFlowId('flow@test')).toBeNull();
      expect(sanitizeFlowId('flow#test')).toBeNull();
      expect(sanitizeFlowId('flow$test')).toBeNull();
      expect(sanitizeFlowId('flow%test')).toBeNull();
      expect(sanitizeFlowId('flow&test')).toBeNull();
      expect(sanitizeFlowId('flow*test')).toBeNull();
    });

    it('should reject flow IDs with spaces', () => {
      expect(sanitizeFlowId('flow test')).toBeNull();
      expect(sanitizeFlowId(' flow')).toBeNull();
      expect(sanitizeFlowId('flow ')).toBeNull();
    });

    it('should reject flow IDs with null bytes', () => {
      expect(sanitizeFlowId('flow\x00test')).toBeNull();
    });

    it('should reject flow IDs with unicode characters', () => {
      expect(sanitizeFlowId('flow日本語')).toBeNull();
      expect(sanitizeFlowId('flowémoji')).toBeNull();
    });
  });

  // --------------------------------------------------------
  // getIdParam
  // --------------------------------------------------------
  describe('getIdParam', () => {
    it('should return id from params object', () => {
      expect(getIdParam({ id: '123' })).toBe('123');
      expect(getIdParam({ id: 'abc-def' })).toBe('abc-def');
    });

    it('should return null when id is not present', () => {
      expect(getIdParam({})).toBeNull();
    });

    it('should return null when id is undefined', () => {
      expect(getIdParam({ id: undefined })).toBeNull();
    });

    it('should return null if id is empty string', () => {
      // 空文字はfalsy -> nullを返す
      expect(getIdParam({ id: '' })).toBeNull();
    });
  });
});
