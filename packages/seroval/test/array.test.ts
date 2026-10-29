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

const EXAMPLE = [1, 2, 3];

const RECURSIVE_EXAMPLE: unknown[] = [];
RECURSIVE_EXAMPLE[0] = RECURSIVE_EXAMPLE;
RECURSIVE_EXAMPLE[1] = RECURSIVE_EXAMPLE;

const ASYNC_RECURSIVE_EXAMPLE: Promise<unknown>[] = [];
ASYNC_RECURSIVE_EXAMPLE[0] = Promise.resolve(ASYNC_RECURSIVE_EXAMPLE);
ASYNC_RECURSIVE_EXAMPLE[1] = Promise.resolve(ASYNC_RECURSIVE_EXAMPLE);

describe('arrays', () => {
  describe('serialize', () => {
    it('supports Arrays', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', () => {
      const result = serialize(RECURSIVE_EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof RECURSIVE_EXAMPLE>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('serializeAsync', () => {
    it('supports Arrays', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const example: Promise<unknown>[] = [];
      example[0] = Promise.resolve(example);
      example[1] = Promise.resolve(example);
      const result = await serializeAsync(example);
      const back = deserialize<typeof example>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('toJSON', () => {
    it('supports Arrays', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', () => {
      const result = toJSON(RECURSIVE_EXAMPLE);
      const back = fromJSON<typeof RECURSIVE_EXAMPLE>(result);
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Arrays', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const result = await toJSONAsync(ASYNC_RECURSIVE_EXAMPLE);
      const back = fromJSON<typeof ASYNC_RECURSIVE_EXAMPLE>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('crossSerialize', () => {
    it('supports Arrays', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports self recursion', () => {
      const result = crossSerialize(RECURSIVE_EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Arrays', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports self recursion', () => {
        const result = crossSerialize(RECURSIVE_EXAMPLE, {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Arrays', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const result = await crossSerializeAsync(ASYNC_RECURSIVE_EXAMPLE);
      const back = await evaluateCross<typeof ASYNC_RECURSIVE_EXAMPLE>(result);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
    describe('scoped', () => {
      it('supports Arrays', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(Array);
        expect(back[0]).toBe(EXAMPLE[0]);
        expect(back[1]).toBe(EXAMPLE[1]);
        expect(back[2]).toBe(EXAMPLE[2]);
      });
      it('supports self recursion', async () => {
        const result = await crossSerializeAsync(ASYNC_RECURSIVE_EXAMPLE, {
          scopeId: 'example',
        });
        const back = await evaluateCross<typeof ASYNC_RECURSIVE_EXAMPLE>(result, 'example');
        expect(await back[0]).toBe(back);
        expect(await back[1]).toBe(back);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Arrays', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const back = await streamCross<typeof ASYNC_RECURSIVE_EXAMPLE>(ASYNC_RECURSIVE_EXAMPLE);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
    describe('scoped', () => {
      it('supports Arrays', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(back).toBeInstanceOf(Array);
        expect(back[0]).toBe(EXAMPLE[0]);
        expect(back[1]).toBe(EXAMPLE[1]);
        expect(back[2]).toBe(EXAMPLE[2]);
      });
      it('supports self recursion', async () => {
        const back = await streamCross<typeof ASYNC_RECURSIVE_EXAMPLE>(ASYNC_RECURSIVE_EXAMPLE, { scopeId: 'example' });
        expect(await back[0]).toBe(back);
        expect(await back[1]).toBe(back);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Arrays', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', () => {
      const result = toCrossJSON(RECURSIVE_EXAMPLE);
      const back = fromCrossJSON<typeof RECURSIVE_EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back[0]).toBe(back);
      expect(back[1]).toBe(back);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Arrays', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const result = await toCrossJSONAsync(ASYNC_RECURSIVE_EXAMPLE);
      const back = fromCrossJSON<typeof ASYNC_RECURSIVE_EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Arrays', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Array);
      expect(back[0]).toBe(EXAMPLE[0]);
      expect(back[1]).toBe(EXAMPLE[1]);
      expect(back[2]).toBe(EXAMPLE[2]);
    });
    it('supports self recursion', async () => {
      const back = await streamCrossJSON<typeof ASYNC_RECURSIVE_EXAMPLE>(ASYNC_RECURSIVE_EXAMPLE);
      expect(await back[0]).toBe(back);
      expect(await back[1]).toBe(back);
    });
  });
});
