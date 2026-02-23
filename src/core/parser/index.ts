/**
 * FlowOps - YAML Flow Parser
 *
 * YAMLフロー定義ファイルの読み込みと解析
 */

import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { ZodIssue } from 'zod';
import { FlowSchema, Flow, ValidationResult, ValidationError } from './schema';
import { validateFlowIntegrity } from './validateFlow';

export interface ParseResult {
  success: boolean;
  flow?: Flow;
  errors: ValidationError[];
  rawContent?: string;
}

/**
 * YAML文字列をFlowオブジェクトにパース
 * @param yamlContent YAML文字列
 * @param fileName ファイル名（バリデーション用）
 */
export function parseFlowYaml(yamlContent: string, fileName?: string): ParseResult {
  const errors: ValidationError[] = [];

  try {
    // YAML パース
    const rawData = parseYaml(yamlContent);

    if (!rawData) {
      return {
        success: false,
        errors: [
          {
            code: 'INVALID_SCHEMA',
            message: 'Failed to parse YAML: empty content',
          },
        ],
        rawContent: yamlContent,
      };
    }

    // Zodスキーマ検証
    const zodResult = FlowSchema.safeParse(rawData);

    if (!zodResult.success) {
      const zodErrors: ValidationError[] = zodResult.error.errors.map((e: ZodIssue) => ({
        code: 'INVALID_SCHEMA' as const,
        message: e.message,
        path: e.path.join('.'),
      }));

      return {
        success: false,
        errors: zodErrors,
        rawContent: yamlContent,
      };
    }

    const flow = zodResult.data;

    // ファイル名とIDの一致チェック
    if (fileName) {
      const expectedId = fileName.replace(/\.yaml$/, '');
      if (flow.id !== expectedId) {
        errors.push({
          code: 'ID_MISMATCH',
          message: `Flow ID "${flow.id}" does not match filename "${fileName}"`,
          path: 'id',
        });
      }
    }

    // 整合性チェック
    const integrityResult = validateFlowIntegrity(flow);
    errors.push(...integrityResult.errors);

    return {
      success: errors.length === 0,
      flow,
      errors,
      rawContent: yamlContent,
    };
  } catch (error) {
    return {
      success: false,
      errors: [
        {
          code: 'INVALID_SCHEMA',
          message: `YAML parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      rawContent: yamlContent,
    };
  }
}

/**
 * FlowオブジェクトをYAML文字列に変換
 * @param flow Flowオブジェクト
 */
export function stringifyFlow(flow: Flow): string {
  return stringifyYaml(flow, {
    indent: 2,
    lineWidth: 0,
  });
}

/**
 * フローの検証のみを行う（パースなし）
 * @param flow Flowオブジェクト
 */
export function validateFlow(flow: Flow): ValidationResult {
  const errors: ValidationError[] = [];

  // Zodスキーマ再検証
  const zodResult = FlowSchema.safeParse(flow);
  if (!zodResult.success) {
    zodResult.error.errors.forEach((e: ZodIssue) => {
      errors.push({
        code: 'INVALID_SCHEMA',
        message: e.message,
        path: e.path.join('.'),
      });
    });
  }

  // 整合性チェック
  const integrityResult = validateFlowIntegrity(flow);
  errors.push(...integrityResult.errors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * フローのサマリー情報を取得
 */
export function getFlowSummary(flow: Flow): { nodeCount: number; edgeCount: number } {
  return {
    nodeCount: Object.keys(flow.nodes).length,
    edgeCount: Object.keys(flow.edges).length,
  };
}

// Re-export types and schemas
export * from './schema';
export { flowToMermaid, type MermaidOptions } from './toMermaid';
export { validateFlowIntegrity } from './validateFlow';
