import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from '../src';
import { evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

const EXAMPLE = /[a-z0-9]+/i;

const EXAMPLE_ESCAPED = /\d+\.\d+\s?\/\w*/g;

describe('RegExp', () => {
  describe('serialize', () => {
    it('supports RegExp', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('serializeAsync', () => {
    it('supports RegExp', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSON', () => {
    it('supports RegExp', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports RegExp', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('crossSerialize', () => {
    it('supports RegExp', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports RegExp', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports RegExp', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
    describe('scoped', () => {
      it('supports RegExp', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(RegExp);
        expect(String(back)).toBe(String(EXAMPLE));
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports RegExp', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
    describe('scoped', () => {
      it('supports RegExp', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(RegExp);
        expect(String(back)).toBe(String(EXAMPLE));
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports RegExp', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports RegExp', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports RegExp', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
});

describe('RegExp with escaped source', () => {
  describe('serialize', () => {
    it('supports escaped source', () => {
      const result = serialize(EXAMPLE_ESCAPED);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE_ESCAPED>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(back.source).toBe(EXAMPLE_ESCAPED.source);
      expect(String(back)).toBe(String(EXAMPLE_ESCAPED));
    });
  });
  describe('serializeAsync', () => {
    it('supports escaped source', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE_ESCAPED));
      const back = await deserialize<Promise<typeof EXAMPLE_ESCAPED>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(back.source).toBe(EXAMPLE_ESCAPED.source);
      expect(String(back)).toBe(String(EXAMPLE_ESCAPED));
    });
  });
  describe('toJSON', () => {
    it('supports escaped source', () => {
      const result = toJSON(EXAMPLE_ESCAPED);
      const back = fromJSON<typeof EXAMPLE_ESCAPED>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(back.source).toBe(EXAMPLE_ESCAPED.source);
      expect(String(back)).toBe(String(EXAMPLE_ESCAPED));
    });
  });
  describe('toJSONAsync', () => {
    it('supports escaped source', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE_ESCAPED));
      const back = await fromJSON<Promise<typeof EXAMPLE_ESCAPED>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(back.source).toBe(EXAMPLE_ESCAPED.source);
      expect(String(back)).toBe(String(EXAMPLE_ESCAPED));
    });
  });
  describe('toCrossJSON', () => {
    it('supports escaped source', () => {
      const result = toCrossJSON(EXAMPLE_ESCAPED);
      const back = fromCrossJSON<typeof EXAMPLE_ESCAPED>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(RegExp);
      expect(back.source).toBe(EXAMPLE_ESCAPED.source);
      expect(String(back)).toBe(String(EXAMPLE_ESCAPED));
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports escaped source', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE_ESCAPED));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE_ESCAPED>>(
        result,
        {
          refs: new Map(),
        },
      );
      expect(back).toBeInstanceOf(RegExp);
      expect(back.source).toBe(EXAMPLE_ESCAPED.source);
      expect(String(back)).toBe(String(EXAMPLE_ESCAPED));
    });
  });
});
