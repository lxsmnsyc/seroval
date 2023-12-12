import { describe, it, expect } from 'vitest';
import {
  serialize,
  deserialize,
  serializeAsync,
  fromJSON,
  toJSON,
  toJSONAsync,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  toCrossJSON,
  toCrossJSONAsync,
  fromCrossJSON,
  toCrossJSONStream,
} from '../src';

describe('mutual cyclic references', () => {
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
      expect(result).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
    });
    it('supports Arrays and Objects', async () => {
      const a: Promise<unknown>[] = [];
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
    it('supports Objects and Objects', async () => {
      const a: Record<string, Promise<unknown>> = {};
      const b: Record<string, Promise<unknown>> = {};
      a[0] = Promise.resolve(b);
      b[0] = Promise.resolve(a);
      const example = [a, b] as const;
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
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
        expect(result).toMatchSnapshot();
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
        expect(result).toMatchSnapshot();
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
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Arrays and Arrays', async () =>
      new Promise<void>((resolve, reject) => {
        const a: Promise<unknown>[] = [];
        const b: Promise<unknown>[] = [];
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        crossSerializeStream(example, {
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports Arrays and Objects', async () =>
      new Promise<void>((resolve, reject) => {
        const a: Promise<unknown>[] = [];
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        crossSerializeStream(example, {
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports Objects and Objects', async () =>
      new Promise<void>((resolve, reject) => {
        const a: Record<string, Promise<unknown>> = {};
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        crossSerializeStream(example, {
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    describe('scoped', () => {
      it('supports Arrays and Arrays', async () =>
        new Promise<void>((resolve, reject) => {
          const a: Promise<unknown>[] = [];
          const b: Promise<unknown>[] = [];
          a[0] = Promise.resolve(b);
          b[0] = Promise.resolve(a);
          const example = [a, b] as const;
          crossSerializeStream(example, {
            scopeId: 'example',
            onSerialize(data) {
              expect(data).toMatchSnapshot();
            },
            onDone() {
              resolve();
            },
            onError(error) {
              reject(error);
            },
          });
        }));
      it('supports Arrays and Objects', async () =>
        new Promise<void>((resolve, reject) => {
          const a: Promise<unknown>[] = [];
          const b: Record<string, Promise<unknown>> = {};
          a[0] = Promise.resolve(b);
          b[0] = Promise.resolve(a);
          const example = [a, b] as const;
          crossSerializeStream(example, {
            scopeId: 'example',
            onSerialize(data) {
              expect(data).toMatchSnapshot();
            },
            onDone() {
              resolve();
            },
            onError(error) {
              reject(error);
            },
          });
        }));
      it('supports Objects and Objects', async () =>
        new Promise<void>((resolve, reject) => {
          const a: Record<string, Promise<unknown>> = {};
          const b: Record<string, Promise<unknown>> = {};
          a[0] = Promise.resolve(b);
          b[0] = Promise.resolve(a);
          const example = [a, b] as const;
          crossSerializeStream(example, {
            scopeId: 'example',
            onSerialize(data) {
              expect(data).toMatchSnapshot();
            },
            onDone() {
              resolve();
            },
            onError(error) {
              reject(error);
            },
          });
        }));
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
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
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back[0]).toStrictEqual(await back[1][0]);
      expect(back[1]).toStrictEqual(await back[0][0]);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Arrays and Arrays', async () =>
      new Promise<void>((resolve, reject) => {
        const a: Promise<unknown>[] = [];
        const b: Promise<unknown>[] = [];
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        toCrossJSONStream(example, {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports Arrays and Objects', async () =>
      new Promise<void>((resolve, reject) => {
        const a: Promise<unknown>[] = [];
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        toCrossJSONStream(example, {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports Objects and Objects', async () =>
      new Promise<void>((resolve, reject) => {
        const a: Record<string, Promise<unknown>> = {};
        const b: Record<string, Promise<unknown>> = {};
        a[0] = Promise.resolve(b);
        b[0] = Promise.resolve(a);
        const example = [a, b] as const;
        toCrossJSONStream(example, {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
  });
});
