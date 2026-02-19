/**
 * FlowOps - Structured Logger
 *
 * Pinoベースの構造化ログ。リクエストID付きの子ロガー生成に対応。
 */

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

export const logger = pino({
  level,
  ...(isProduction
    ? {
        // 本番: JSON形式
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }
    : {
        // 開発: 読みやすいフォーマット
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});

/**
 * リクエストID付きの子ロガーを生成
 */
export function createRequestLogger(requestId: string, extra?: Record<string, unknown>) {
  return logger.child({ requestId, ...extra });
}

export type Logger = pino.Logger;
