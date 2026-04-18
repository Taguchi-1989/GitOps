/**
 * FlowOps - Abstraction Engine
 *
 * GPTsiteki Section 8.3 / 10.7: 抽象化パイプライン
 * L4/L5データをAI利用可能な形に変換する
 *
 * Strategyパターンで8種類の抽象化を実装
 */

import type {
  AbstractionPolicyType,
  AbstractionMetadata,
  DataObject,
  TransformationEvent,
} from '../schemas';

// --------------------------------------------------------
// Types
// --------------------------------------------------------
export interface AbstractionContext {
  dataObject: DataObject;
  fieldPath: string;
  purpose?: string;
}

export interface AbstractedValue {
  value: unknown;
  originalRef: string;
  policyApplied: AbstractionPolicyType;
  reverseReferable: boolean;
}

export interface AbstractionStrategy {
  type: AbstractionPolicyType;
  apply(value: unknown, context: AbstractionContext): AbstractedValue;
}

export interface AbstractionResult {
  abstractedObject: DataObject;
  transformationEvent: TransformationEvent;
  metadata: AbstractionMetadata;
}

// --------------------------------------------------------
// Built-in Strategies
// --------------------------------------------------------

export class MaskingStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'masking';

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    const str = String(value);
    let masked: string;
    if (str.length <= 2) {
      masked = '***';
    } else {
      masked = str[0] + '*'.repeat(Math.min(str.length - 2, 10)) + str[str.length - 1];
    }
    return {
      value: masked,
      originalRef: context.dataObject.objectId,
      policyApplied: 'masking',
      reverseReferable: false,
    };
  }
}

export class RangeStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'range';

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    const num = Number(value);
    if (isNaN(num)) {
      return {
        value: '[non-numeric]',
        originalRef: context.dataObject.objectId,
        policyApplied: 'range',
        reverseReferable: false,
      };
    }
    // 有効数字1桁のレンジに変換
    const magnitude = Math.pow(10, Math.floor(Math.log10(Math.abs(num) || 1)));
    const lower = Math.floor(num / magnitude) * magnitude;
    const upper = lower + magnitude;
    return {
      value: `${lower}-${upper}`,
      originalRef: context.dataObject.objectId,
      policyApplied: 'range',
      reverseReferable: false,
    };
  }
}

export class BinningStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'binning';

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    const num = Number(value);
    if (isNaN(num)) {
      return {
        value: 'unknown',
        originalRef: context.dataObject.objectId,
        policyApplied: 'binning',
        reverseReferable: false,
      };
    }
    let bin: string;
    if (num <= 0) bin = 'zero-or-negative';
    else if (num <= 10) bin = 'low';
    else if (num <= 100) bin = 'medium';
    else if (num <= 1000) bin = 'high';
    else bin = 'very-high';

    return {
      value: bin,
      originalRef: context.dataObject.objectId,
      policyApplied: 'binning',
      reverseReferable: false,
    };
  }
}

export class RelativeStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'relative';

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    // 基準値を消し、「基準比」「傾向」として表現
    const num = Number(value);
    if (isNaN(num)) {
      return {
        value: 'N/A',
        originalRef: context.dataObject.objectId,
        policyApplied: 'relative',
        reverseReferable: false,
      };
    }
    let relative: string;
    if (num > 0) relative = 'above-baseline';
    else if (num < 0) relative = 'below-baseline';
    else relative = 'at-baseline';

    return {
      value: relative,
      originalRef: context.dataObject.objectId,
      policyApplied: 'relative',
      reverseReferable: false,
    };
  }
}

export class TokenizationStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'tokenization';
  private tokenMap: Map<string, string> = new Map();
  private counter = 0;

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    const str = String(value);
    if (!this.tokenMap.has(str)) {
      this.counter++;
      this.tokenMap.set(str, `TOKEN_${String(this.counter).padStart(3, '0')}`);
    }
    return {
      value: this.tokenMap.get(str)!,
      originalRef: context.dataObject.objectId,
      policyApplied: 'tokenization',
      reverseReferable: false,
    };
  }

  /** テスト用: トークンマップをリセット */
  reset(): void {
    this.tokenMap.clear();
    this.counter = 0;
  }
}

export class ConditionOnlyStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'condition-only';

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    return {
      value: { condition: 'present', field: context.fieldPath },
      originalRef: context.dataObject.objectId,
      policyApplied: 'condition-only',
      reverseReferable: false,
    };
  }
}

export class ResultOnlyStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'result-only';

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    const val = value as Record<string, unknown> | undefined;
    return {
      value: {
        status: val?.status ?? 'unknown',
        outcome: val?.outcome ?? 'unknown',
      },
      originalRef: context.dataObject.objectId,
      policyApplied: 'result-only',
      reverseReferable: false,
    };
  }
}

export class DeltaOnlyStrategy implements AbstractionStrategy {
  type: AbstractionPolicyType = 'delta-only';

  apply(value: unknown, context: AbstractionContext): AbstractedValue {
    const num = Number(value);
    if (isNaN(num)) {
      return {
        value: 'N/A',
        originalRef: context.dataObject.objectId,
        policyApplied: 'delta-only',
        reverseReferable: false,
      };
    }
    let direction: string;
    if (num > 0) direction = 'increased';
    else if (num < 0) direction = 'decreased';
    else direction = 'unchanged';

    return {
      value: direction,
      originalRef: context.dataObject.objectId,
      policyApplied: 'delta-only',
      reverseReferable: false,
    };
  }
}

// --------------------------------------------------------
// Abstraction Engine
// --------------------------------------------------------
class AbstractionEngine {
  private strategies: Map<AbstractionPolicyType, AbstractionStrategy> = new Map();

  constructor() {
    this.registerStrategy(new MaskingStrategy());
    this.registerStrategy(new RangeStrategy());
    this.registerStrategy(new BinningStrategy());
    this.registerStrategy(new RelativeStrategy());
    this.registerStrategy(new TokenizationStrategy());
    this.registerStrategy(new ConditionOnlyStrategy());
    this.registerStrategy(new ResultOnlyStrategy());
    this.registerStrategy(new DeltaOnlyStrategy());
  }

  registerStrategy(strategy: AbstractionStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  getStrategy(type: AbstractionPolicyType): AbstractionStrategy | undefined {
    return this.strategies.get(type);
  }

  /**
   * DataObjectの抽象化を実行
   *
   * meta フィールド内の値を指定ポリシーで抽象化し、
   * 新しいDataObject + TransformationEvent + AbstractionMetadata を返す
   */
  abstract(
    dataObject: DataObject,
    policyType: AbstractionPolicyType,
    options?: { purpose?: string; fieldsToAbstract?: string[] }
  ): AbstractionResult {
    const strategy = this.strategies.get(policyType);
    if (!strategy) {
      throw new Error(`Unknown abstraction policy type: ${policyType}`);
    }

    const abstractedMeta: Record<string, unknown> = {};
    const sourceMeta = dataObject.meta || {};
    const fieldsToAbstract = options?.fieldsToAbstract || Object.keys(sourceMeta);

    for (const field of fieldsToAbstract) {
      if (field in sourceMeta) {
        const context: AbstractionContext = {
          dataObject,
          fieldPath: field,
          purpose: options?.purpose,
        };
        const result = strategy.apply(sourceMeta[field], context);
        abstractedMeta[field] = result.value;
      }
    }

    // 抽象化されていないフィールドはコピー
    for (const [key, val] of Object.entries(sourceMeta)) {
      if (!(key in abstractedMeta)) {
        abstractedMeta[key] = val;
      }
    }

    const now = new Date().toISOString();
    const abstractedObjectId = `abs-${dataObject.objectId}-${Date.now()}`;

    const metadata: AbstractionMetadata = {
      abstractionPolicyType: policyType,
      originalDataRef: dataObject.objectId,
      reverseReferable: false,
      reIdentificationRisk: 'low',
      exportAllowed: false,
      allowedPurposes: options?.purpose ? [options.purpose] : undefined,
    };

    const abstractedObject: DataObject = {
      objectId: abstractedObjectId,
      parentId: dataObject.objectId,
      objectType: dataObject.objectType,
      sensitivityLevel: 'L2', // 抽象化後はL2に引き下げ
      exportPolicy: 'abstracted-only', // 抽象化データは abstracted-only
      owner: dataObject.owner,
      createdAt: now,
      updatedAt: now,
      version: dataObject.version,
      semanticTags: dataObject.semanticTags,
      abstractionMetadata: metadata,
      meta: abstractedMeta,
    };

    const transformationEvent: TransformationEvent = {
      id: `te-abs-${Date.now()}`,
      type: 'abstraction',
      inputObjectIds: [dataObject.objectId],
      outputObjectIds: [abstractedObjectId],
      executedBy: 'abstraction-engine',
      executedAt: now,
      parameters: {
        policyType,
        fieldsAbstracted: fieldsToAbstract,
      },
      metadata: {
        purpose: options?.purpose,
      },
    };

    return { abstractedObject, transformationEvent, metadata };
  }

  /**
   * 複数DataObjectを一括抽象化
   */
  abstractBatch(
    dataObjects: DataObject[],
    policyType: AbstractionPolicyType,
    options?: { purpose?: string }
  ): AbstractionResult[] {
    return dataObjects.map(obj => this.abstract(obj, policyType, options));
  }
}

// シングルトン
export const abstractionEngine = new AbstractionEngine();

// クラスもエクスポート（テスト用）
export { AbstractionEngine };
