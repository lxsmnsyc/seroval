import { describe, it, expect } from 'vitest';
import {
  compileJSON,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  Feature,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('objects', () => {
  describe('serialize', () => {
    it('supports Objects', () => {
      const example = ({ hello: 'world' }) as { hello: string };
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, string>>(result);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', () => {
      const example = {} as Record<string, unknown>;
      example.a = example;
      example.b = example;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, unknown>>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const example = ({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Iterable<number>>(result);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('serializeAsync', () => {
    it('supports Objects', async () => {
      const example = Promise.resolve(({ hello: 'world' }) as { hello: string });
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Record<string, string>>>(result);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe((await example).hello);
    });
    it('supports self-recursion', async () => {
      const example = {} as Record<string, Promise<unknown>>;
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, Promise<unknown>>>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const example = Promise.resolve(({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Iterable<number>>>(result);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toJSON', () => {
    it('supports Objects', () => {
      const example = ({ hello: 'world' }) as { hello: string };
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, string>>(result);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', () => {
      const example = {} as Record<string, unknown>;
      example.a = example;
      example.b = example;
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, unknown>>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
    it('supports Symbol.iterator', () => {
      const example = ({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>;
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Iterable<number>>(result);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Objects', async () => {
      const example = ({ hello: 'world' }) as { hello: string };
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Record<string, string>>>(result);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', async () => {
      const example = {} as Record<string, Promise<unknown>>;
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, Promise<unknown>>>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
    it('supports Symbol.iterator', async () => {
      const example = Promise.resolve(({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Iterable<number>>>(result);
      expect(back.constructor).toBe(Object);
      expect([...back]).toMatchObject([1, 2, 3]);
    });
  });
  describe('crossSerialize', () => {
    it('supports Objects', () => {
      const example = ({ hello: 'world' }) as { hello: string };
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', () => {
      const example = {} as Record<string, unknown>;
      example.a = example;
      example.b = example;
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    it('supports Symbol.iterator', () => {
      const example = ({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      }) as Iterable<number>;
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Objects', async () => {
      const example = Promise.resolve({ hello: 'world' } as { hello: string });
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
    it('supports self-recursion', async () => {
      const example = {} as Record<string, Promise<unknown>>;
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
    it('supports Symbol.iterator', async () => {
      const example = Promise.resolve({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      } as Iterable<number>);
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Objects', async () => new Promise<void>((done) => {
      const example = Promise.resolve({ hello: 'world' } as { hello: string });
      crossSerializeStream(example, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports self-recursion', async () => new Promise<void>((done) => {
      const example = {} as Record<string, Promise<unknown>>;
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      crossSerializeStream(Promise.resolve(example), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.iterator', async () => new Promise<void>((done) => {
      const example = Promise.resolve({
        * [Symbol.iterator]() {
          yield 1;
          yield 2;
          yield 3;
        },
      } as Iterable<number>);
      crossSerializeStream(example, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
  });
  describe('compat', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const example = ({ hello: 'world' }) as { hello: string };
      const result = serialize(example, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, string>>(result);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe(example.hello);
    });
  });
  describe('compat#toJSON', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const example = ({ hello: 'world' }) as { hello: string };
      const result = toJSON(example, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      expect(compileJSON(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, string>>(result);
      expect(back.constructor).toBe(Object);
      expect(back.hello).toBe(example.hello);
    });
  });
});
