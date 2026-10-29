import { assert, describe, expect, it } from 'vitest';
import {
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSONAsync,
} from '../src';
import { evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

const EXAMPLE = {
  title: 'Hello World',
  async *[Symbol.asyncIterator](): AsyncIterator<number> {
    await Promise.resolve();
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

describe('AsyncIterable', () => {
  describe('serializeAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await serializeAsync(EXAMPLE);
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('toJSONAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await toJSONAsync(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await crossSerializeAsync(EXAMPLE);
      const back = await evaluateCross<typeof EXAMPLE>(result);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
    describe('scoped', () => {
      it('supports AsyncIterables', async () => {
        const result = await crossSerializeAsync(EXAMPLE, {
          scopeId: 'example',
        });
        const back = await evaluateCross<typeof EXAMPLE>(result, 'example');
        expect(back.title).toBe(EXAMPLE.title);
        expect(Symbol.asyncIterator in back).toBe(true);
        const iterator = back[Symbol.asyncIterator]();
        expect((await iterator.next()).value).toBe(1);
        expect((await iterator.next()).value).toBe(2);
        expect((await iterator.next()).value).toBe(3);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports AsyncIterables', async () => {
      const back = await streamCross<typeof EXAMPLE>(EXAMPLE);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
    describe('scoped', () => {
      it('supports AsyncIterables', async () => {
        const back = await streamCross<typeof EXAMPLE>(EXAMPLE, { scopeId: 'example' });
        expect(back.title).toBe(EXAMPLE.title);
        expect(Symbol.asyncIterator in back).toBe(true);
        const iterator = back[Symbol.asyncIterator]();
        expect((await iterator.next()).value).toBe(1);
        expect((await iterator.next()).value).toBe(2);
        expect((await iterator.next()).value).toBe(3);
      });
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports AsyncIterables', async () => {
      const result = await toCrossJSONAsync(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports AsyncIterables', async () => {
      const back = await streamCrossJSON<typeof EXAMPLE>(EXAMPLE);
      expect(back.title).toBe(EXAMPLE.title);
      expect(Symbol.asyncIterator in back).toBe(true);
      const iterator = back[Symbol.asyncIterator]();
      expect((await iterator.next()).value).toBe(1);
      expect((await iterator.next()).value).toBe(2);
      expect((await iterator.next()).value).toBe(3);
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
});
