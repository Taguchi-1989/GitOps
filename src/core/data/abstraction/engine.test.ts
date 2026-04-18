import { describe, it, expect, beforeEach } from 'vitest';
import {
  AbstractionEngine,
  MaskingStrategy,
  RangeStrategy,
  BinningStrategy,
  RelativeStrategy,
  TokenizationStrategy,
  ConditionOnlyStrategy,
  ResultOnlyStrategy,
  DeltaOnlyStrategy,
} from './engine';
import type { DataObject } from '../schemas';

function makeDataObject(meta: Record<string, unknown> = {}): DataObject {
  return {
    objectId: 'obj-test-001',
    objectType: 'document',
    sensitivityLevel: 'L4',
    exportPolicy: 'unrestricted',
    createdAt: '2026-03-09T10:00:00+09:00',
    updatedAt: '2026-03-09T10:00:00+09:00',
    owner: 'ProcessTech',
    meta,
  };
}

const context = (obj: DataObject, field = 'value') => ({
  dataObject: obj,
  fieldPath: field,
});

describe('Strategies', () => {
  describe('MaskingStrategy', () => {
    const strategy = new MaskingStrategy();

    it('should mask a string value', () => {
      const result = strategy.apply('SecretValue123', context(makeDataObject()));
      expect(result.value).toBe('S**********3');
      expect(result.policyApplied).toBe('masking');
      expect(result.reverseReferable).toBe(false);
    });

    it('should mask short strings', () => {
      const result = strategy.apply('AB', context(makeDataObject()));
      expect(result.value).toBe('***');
    });

    it('should mask single char', () => {
      const result = strategy.apply('X', context(makeDataObject()));
      expect(result.value).toBe('***');
    });
  });

  describe('RangeStrategy', () => {
    const strategy = new RangeStrategy();

    it('should convert number to range', () => {
      const result = strategy.apply(23.7, context(makeDataObject()));
      expect(result.value).toBe('20-30');
    });

    it('should handle 0', () => {
      const result = strategy.apply(0, context(makeDataObject()));
      expect(result.value).toBe('0-1');
    });

    it('should handle non-numeric', () => {
      const result = strategy.apply('not-a-number', context(makeDataObject()));
      expect(result.value).toBe('[non-numeric]');
    });

    it('should handle large numbers', () => {
      const result = strategy.apply(1500, context(makeDataObject()));
      expect(result.value).toBe('1000-2000');
    });
  });

  describe('BinningStrategy', () => {
    const strategy = new BinningStrategy();

    it('should bin low values', () => {
      const result = strategy.apply(5, context(makeDataObject()));
      expect(result.value).toBe('low');
    });

    it('should bin medium values', () => {
      const result = strategy.apply(50, context(makeDataObject()));
      expect(result.value).toBe('medium');
    });

    it('should bin high values', () => {
      const result = strategy.apply(500, context(makeDataObject()));
      expect(result.value).toBe('high');
    });

    it('should bin very-high values', () => {
      const result = strategy.apply(5000, context(makeDataObject()));
      expect(result.value).toBe('very-high');
    });

    it('should handle zero-or-negative', () => {
      const result = strategy.apply(-5, context(makeDataObject()));
      expect(result.value).toBe('zero-or-negative');
    });
  });

  describe('RelativeStrategy', () => {
    const strategy = new RelativeStrategy();

    it('should detect above-baseline', () => {
      const result = strategy.apply(10, context(makeDataObject()));
      expect(result.value).toBe('above-baseline');
    });

    it('should detect below-baseline', () => {
      const result = strategy.apply(-5, context(makeDataObject()));
      expect(result.value).toBe('below-baseline');
    });

    it('should detect at-baseline', () => {
      const result = strategy.apply(0, context(makeDataObject()));
      expect(result.value).toBe('at-baseline');
    });
  });

  describe('TokenizationStrategy', () => {
    let strategy: TokenizationStrategy;

    beforeEach(() => {
      strategy = new TokenizationStrategy();
    });

    it('should tokenize a value', () => {
      const result = strategy.apply('ProductX', context(makeDataObject()));
      expect(result.value).toBe('TOKEN_001');
    });

    it('should produce consistent tokens for same input', () => {
      const r1 = strategy.apply('ProductX', context(makeDataObject()));
      const r2 = strategy.apply('ProductX', context(makeDataObject()));
      expect(r1.value).toBe(r2.value);
    });

    it('should produce different tokens for different inputs', () => {
      const r1 = strategy.apply('ProductX', context(makeDataObject()));
      const r2 = strategy.apply('ProductY', context(makeDataObject()));
      expect(r1.value).not.toBe(r2.value);
    });
  });

  describe('ConditionOnlyStrategy', () => {
    const strategy = new ConditionOnlyStrategy();

    it('should return condition metadata only', () => {
      const result = strategy.apply(
        { temp: 200, pressure: 5 },
        context(makeDataObject(), 'recipe')
      );
      expect(result.value).toEqual({ condition: 'present', field: 'recipe' });
    });
  });

  describe('ResultOnlyStrategy', () => {
    const strategy = new ResultOnlyStrategy();

    it('should extract status and outcome', () => {
      const result = strategy.apply(
        { status: 'stable', outcome: 'pass', details: 'secret' },
        context(makeDataObject())
      );
      expect(result.value).toEqual({ status: 'stable', outcome: 'pass' });
    });

    it('should handle missing fields', () => {
      const result = strategy.apply(undefined, context(makeDataObject()));
      expect(result.value).toEqual({ status: 'unknown', outcome: 'unknown' });
    });
  });

  describe('DeltaOnlyStrategy', () => {
    const strategy = new DeltaOnlyStrategy();

    it('should detect increased', () => {
      expect(strategy.apply(5, context(makeDataObject())).value).toBe('increased');
    });

    it('should detect decreased', () => {
      expect(strategy.apply(-3, context(makeDataObject())).value).toBe('decreased');
    });

    it('should detect unchanged', () => {
      expect(strategy.apply(0, context(makeDataObject())).value).toBe('unchanged');
    });
  });
});

describe('AbstractionEngine', () => {
  let engine: AbstractionEngine;

  beforeEach(() => {
    engine = new AbstractionEngine();
  });

  describe('abstract()', () => {
    it('should abstract all meta fields with masking', () => {
      const obj = makeDataObject({ name: 'SecretProduct', code: 'XY-1234' });
      const result = engine.abstract(obj, 'masking');

      expect(result.abstractedObject.meta).toBeDefined();
      const meta = result.abstractedObject.meta as Record<string, unknown>;
      expect(meta.name).toBe('S**********t');
      expect(meta.code).toBe('X*****4');
    });

    it('should set sensitivity to L2 after abstraction', () => {
      const obj = makeDataObject({ value: 42 });
      const result = engine.abstract(obj, 'range');

      expect(result.abstractedObject.sensitivityLevel).toBe('L2');
    });

    it('should create proper parentId reference', () => {
      const obj = makeDataObject({ value: 42 });
      const result = engine.abstract(obj, 'range');

      expect(result.abstractedObject.parentId).toBe('obj-test-001');
    });

    it('should generate TransformationEvent', () => {
      const obj = makeDataObject({ value: 42 });
      const result = engine.abstract(obj, 'range');

      expect(result.transformationEvent.type).toBe('abstraction');
      expect(result.transformationEvent.inputObjectIds).toContain('obj-test-001');
      expect(result.transformationEvent.executedBy).toBe('abstraction-engine');
    });

    it('should generate AbstractionMetadata', () => {
      const obj = makeDataObject({ value: 42 });
      const result = engine.abstract(obj, 'range', { purpose: 'analysis' });

      expect(result.metadata.abstractionPolicyType).toBe('range');
      expect(result.metadata.originalDataRef).toBe('obj-test-001');
      expect(result.metadata.reverseReferable).toBe(false);
      expect(result.metadata.allowedPurposes).toEqual(['analysis']);
    });

    it('should only abstract specified fields', () => {
      const obj = makeDataObject({ secret: 'hidden', public: 'visible' });
      const result = engine.abstract(obj, 'masking', {
        fieldsToAbstract: ['secret'],
      });

      const meta = result.abstractedObject.meta as Record<string, unknown>;
      expect(meta.secret).toBe('h****n');
      expect(meta.public).toBe('visible'); // 未抽象化フィールドはそのまま
    });

    it('should throw for unknown policy type', () => {
      const obj = makeDataObject({ value: 42 });
      expect(() => engine.abstract(obj, 'unknown-policy' as never)).toThrow(
        'Unknown abstraction policy type'
      );
    });
  });

  describe('abstractBatch()', () => {
    it('should abstract multiple objects', () => {
      const objects = [makeDataObject({ value: 10 }), makeDataObject({ value: 200 })];
      // objectIdを一意にする
      objects[1].objectId = 'obj-test-002';

      const results = engine.abstractBatch(objects, 'binning');

      expect(results).toHaveLength(2);
      expect((results[0].abstractedObject.meta as Record<string, unknown>).value).toBe('low');
      expect((results[1].abstractedObject.meta as Record<string, unknown>).value).toBe('high');
    });
  });

  describe('getStrategy()', () => {
    it('should return registered strategy', () => {
      expect(engine.getStrategy('masking')).toBeInstanceOf(MaskingStrategy);
      expect(engine.getStrategy('range')).toBeInstanceOf(RangeStrategy);
    });

    it('should return undefined for unregistered type', () => {
      expect(engine.getStrategy('unknown' as never)).toBeUndefined();
    });
  });
});
