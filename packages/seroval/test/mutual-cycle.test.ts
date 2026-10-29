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

describe('mutual cyclic references', () => {
  describe.each([
    ['serialize', serialize],
    ['serializeAsync', serializeAsync],
    ['crossSerialize', crossSerialize],
    ['crossSerializeAsync', crossSerializeAsync],
  ])('%s deferred assignments', (_name, encode) => {
    it('evaluates a large graph of repeated back-references', async () => {
      const source: { items: Record<string, unknown>[] } = { items: [] };
      for (let index = 0; index < 3000; index++) {
        source.items.push({
          owner: source,
          alternate: source,
          repeated: source,
        });
      }
      const payload = await encode(source);
      // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call, typescript/no-unsafe-type-assertion -- evaluates the serialized output.
      const back = new Function('$R', `return (${payload})`)([]) as typeof source;
      expect(back.items.length).toBe(source.items.length);
      for (const item of back.items) {
        expect(item.owner).toBe(back);
        expect(item.alternate).toBe(back);
        expect(item.repeated).toBe(back);
      }
    });
  });
  describe('serialize', () => {
    it('supports Arrays and Arrays', () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Arrays and Objects', () => {
      const a: unknown[] = [];
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
  describe('serializeAsync', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await serializeAsync(example);
      const back = deserialize<typeof example>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await serializeAsync(example);
      const back = deserialize<typeof example>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await serializeAsync(example);
      const back = deserialize<typeof example>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
  describe('toJSON', () => {
    it('supports Arrays and Arrays', () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = toJSON(example);
      const back = fromJSON<typeof example>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Arrays and Objects', () => {
      const a: unknown[] = [];
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = toJSON(example);
      const back = fromJSON<typeof example>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = toJSON(example);
      const back = fromJSON<typeof example>(result);
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await toJSONAsync(example);
      const back = fromJSON<typeof example>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await toJSONAsync(example);
      const back = fromJSON<typeof example>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await toJSONAsync(example);
      const back = fromJSON<typeof example>(result);
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
  describe('crossSerialize', () => {
    it('supports Arrays and Arrays', () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    it('supports Arrays and Objects', () => {
      const a: unknown[] = [];
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Arrays and Arrays', () => {
        const a: unknown[] = [];
        const b: unknown[] = [];
        a[0] = b;
        b[0] = a;
        const example = [a, b] as const;
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports Arrays and Objects', () => {
        const a: unknown[] = [];
        const b: Record<string, unknown> = {};
        a[0] = b;
        b[0] = a;
        const example = [a, b] as const;
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports Objects and Objects', () => {
        const a: Record<string, unknown> = {};
        const b: Record<string, unknown> = {};
        a[0] = b;
        b[0] = a;
        const example = [a, b] as const;
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await crossSerializeAsync(example);
      const back = evaluateCross<typeof example>(result);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await crossSerializeAsync(example);
      const back = evaluateCross<typeof example>(result);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await crossSerializeAsync(example);
      const back = evaluateCross<typeof example>(result);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    describe('scoped', () => {
      it('supports Arrays and Arrays', async () => {
        const a: Promise<unknown>[] = [];
        const b: Promise<unknown>[] = [];
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        const result = await crossSerializeAsync(example, {
          scopeId: 'example',
        });
        const back = evaluateCross<typeof example>(result, 'example');
        expect(back[0]).toBe(await back[1][0]);
        expect(back[1]).toBe(await back[0][0]);
      });
      it('supports Arrays and Objects', async () => {
        const a: Promise<unknown>[] = [];
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        const result = await crossSerializeAsync(example, {
          scopeId: 'example',
        });
        const back = evaluateCross<typeof example>(result, 'example');
        expect(back[0]).toBe(await back[1][0]);
        expect(back[1]).toBe(await back[0][0]);
      });
      it('supports Objects and Objects', async () => {
        const a: Record<string, Promise<unknown>> = {};
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        const result = await crossSerializeAsync(example, {
          scopeId: 'example',
        });
        const back = evaluateCross<typeof example>(result, 'example');
        expect(back[0]).toBe(await back[1][0]);
        expect(back[1]).toBe(await back[0][0]);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const back = await streamCross<typeof example>(example);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const back = await streamCross<typeof example>(example);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const back = await streamCross<typeof example>(example);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    describe('scoped', () => {
      it('supports Arrays and Arrays', async () => {
        const a: Promise<unknown>[] = [];
        const b: Promise<unknown>[] = [];
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        const back = await streamCross<typeof example>(example, {
          scopeId: 'example',
        });
        expect(back[0]).toBe(await back[1][0]);
        expect(back[1]).toBe(await back[0][0]);
      });
      it('supports Arrays and Objects', async () => {
        const a: Promise<unknown>[] = [];
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        const back = await streamCross<typeof example>(example, {
          scopeId: 'example',
        });
        expect(back[0]).toBe(await back[1][0]);
        expect(back[1]).toBe(await back[0][0]);
      });
      it('supports Objects and Objects', async () => {
        const a: Record<string, Promise<unknown>> = {};
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        const back = await streamCross<typeof example>(example, {
          scopeId: 'example',
        });
        expect(back[0]).toBe(await back[1][0]);
        expect(back[1]).toBe(await back[0][0]);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Arrays and Arrays', () => {
      const a: unknown[] = [];
      const b: unknown[] = [];
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = toCrossJSON(example);
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Arrays and Objects', () => {
      const a: unknown[] = [];
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = toCrossJSON(example);
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
    it('supports Objects and Objects', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      a[0] = b;
      b[0] = a;
      const example = [a, b] as const;
      const result = toCrossJSON(example);
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back[0]).toBe(back[1][0]);
      expect(back[1]).toBe(back[0][0]);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await toCrossJSONAsync(example);
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await toCrossJSONAsync(example);
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await toCrossJSONAsync(example);
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Arrays and Arrays', async () => {
      const a: Promise<unknown>[] = [];
      const b: Promise<unknown>[] = [];
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const back = await streamCrossJSON<typeof example>(example);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const back = await streamCrossJSON<typeof example>(example);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const back = await streamCrossJSON<typeof example>(example);
      expect(back[0]).toBe(await back[1][0]);
      expect(back[1]).toBe(await back[0][0]);
    });
  });
});
