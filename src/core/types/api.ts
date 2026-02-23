/**
 * FlowOps - API Response Types
 *
 * 統一されたAPIレスポンス形式
 */

// --------------------------------------------------------
// API Response (統一形式)
// --------------------------------------------------------
export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  errorCode?: string;
  details?: string;
}

// --------------------------------------------------------
// API Error Codes
// --------------------------------------------------------
export const API_ERROR_CODES = {
  // General
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Git
  LOCK_TIMEOUT: 'LOCK_TIMEOUT',
  GIT_ERROR: 'GIT_ERROR',
  MERGE_CONFLICT: 'MERGE_CONFLICT',

  // LLM
  LLM_ERROR: 'LLM_ERROR',

  // Proposal
  STALE_PROPOSAL: 'STALE_PROPOSAL',
  PATCH_APPLY_FAILED: 'PATCH_APPLY_FAILED',

  // Issue
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  ALREADY_MERGED: 'ALREADY_MERGED',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

// --------------------------------------------------------
// Helper Functions
// --------------------------------------------------------
export function successResponse<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

export function errorResponse(errorCode: ApiErrorCode, details?: string): ApiResponse<never> {
  return { ok: false, errorCode, details };
}
