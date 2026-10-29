import { assert, describe, expect, it } from 'vitest';
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
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';
import { evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

const EXAMPLE = {
  title: 'Hello World',
  *[Symbol.iterator](): Generator<number> {
    yield 1;
    yield 2;
    yield 3;
  },
};

function makeDeepObject(depth: number): Record<string, unknown> {
  let current: Record<string, unknown> = {};
  const root = current;
  for (let i = 0; i < depth; i++) {
    const next: Record<string, unknown> = {};
    current.next = next;
    current = next;
  }
  return root;
}

describe('Iterable', () => {
  describe('serialize', () => {
    it('supports Iterables', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('serializeAsync', () => {
    it('supports Iterables', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toJSON', () => {
    it('supports Iterables', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Iterables', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('crossSerialize', () => {
    it('supports Iterables', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Iterables', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Iterables', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
    describe('scoped', () => {
      it('supports Iterables', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back.title).toBe(EXAMPLE.title);
        expect(Symbol.iterator in back).toBe(true);
        const iterator = back[Symbol.iterator]();
        expect(iterator.next().value).toBe(1);
        expect(iterator.next().value).toBe(2);
        expect(iterator.next().value).toBe(3);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Iterables', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
    describe('scoped', () => {
      it('supports Iterables', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(back.title).toBe(EXAMPLE.title);
        expect(Symbol.iterator in back).toBe(true);
        const iterator = back[Symbol.iterator]();
        expect(iterator.next().value).toBe(1);
        expect(iterator.next().value).toBe(2);
        expect(iterator.next().value).toBe(3);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Iterables', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Iterables', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Iterables', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.iterator in back).toBe(true);
      const iterator = back[Symbol.iterator]();
      expect(iterator.next().value).toBe(1);
      expect(iterator.next().value).toBe(2);
      expect(iterator.next().value).toBe(3);
    });
    it('respects depthLimit', async () =>
      new Promise<void>((resolve) => {
        const deep = makeDeepObject(5);
        let parsed = false;
        toCrossJSONStream(deep, {
          depthLimit: 2,
          onParse() {
            parsed = true;
          },
          onError(error) {
            assert(error instanceof Error);
            expect(error.message).toContain('Depth limit');
            expect(parsed).toBe(false);
            resolve();
          },
        });
      }));
  });
  describe('fromCrossJSON', () => {
    it('respects depthLimit', () => {
      const deep = makeDeepObject(5);
      const tree = toCrossJSON(deep);
      expect(() =>
        fromCrossJSON(tree, {
          depthLimit: 2,
          refs: new Map(),
        }),
      ).toThrow(/Depth limit/);
    });
  });
});
