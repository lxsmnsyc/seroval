import { assert, describe, expect, it } from 'vitest';
import {
  Feature,
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

describe('Error', () => {
  describe('with an own __proto__ field', () => {
    function makeError(): Error {
      const error = new Error('field');
      Object.defineProperty(error, '__proto__', {
        value: { retained: true },
        configurable: true,
        enumerable: true,
        writable: true,
      });
      return error;
    }

    function expectPreserved(back: Error): void {
      expect(Object.getPrototypeOf(back)).toBe(Error.prototype);
      expect(Object.getOwnPropertyDescriptor(back, '__proto__')).toEqual({
        value: { retained: true },
        configurable: true,
        enumerable: true,
        writable: true,
      });
      expect(back.message).toBe('field');
    }

    it.each([0, Feature.ObjectAssign])(
      'preserves the field through serialize with disabled features %i',
      (disabledFeatures) => {
        expectPreserved(deserialize(serialize(makeError(), { disabledFeatures })));
      },
    );

    it('preserves the field through serializeAsync', async () => {
      expectPreserved(deserialize(await serializeAsync(makeError())));
    });

    it('preserves the field through JSON', () => {
      expectPreserved(fromJSON(toJSON(makeError())));
    });

    it('preserves the field through crossSerialize', () => {
      const payload = crossSerialize(makeError());
      // oxlint-disable-next-line eslint/no-new-func, typescript/no-implied-eval, typescript/no-unsafe-call -- evaluates the serialized output.
      const back: unknown = new Function('$R', `return (${payload})`)([]);
      assert(back instanceof Error);
      expectPreserved(back);
    });
  });
  describe('serialize', () => {
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(serialize(a)).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      expect(serialize(b)).toMatchSnapshot();
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(serialize(a)).toMatchSnapshot();
    });
  });
  describe('serializeAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const result = await serializeAsync(Promise.resolve(a));
      const back = await deserialize<Promise<Error>>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      const result = await serializeAsync(b);
      const back = deserialize<Error>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = await back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const result = await serializeAsync(Promise.resolve(a));
      const back = await deserialize<Promise<Error>>(result);
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
  });
  describe('toJSON', () => {
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const result = toJSON(a);
      const back = fromJSON<Error>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      const result = toJSON(b);
      const back = fromJSON<Error>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const result = toJSON(a);
      const back = fromJSON<Error>(result);
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
  });
  describe('toJSONAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const result = await toJSONAsync(Promise.resolve(a));
      const back = await fromJSON<Promise<Error>>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      const result = await toJSONAsync(b);
      const back = fromJSON<Error>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = await back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const result = await toJSONAsync(Promise.resolve(a));
      const back = await fromJSON<Promise<Error>>(result);
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
  });
  describe('crossSerialize', () => {
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(crossSerialize(a)).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      expect(crossSerialize(b)).toMatchSnapshot();
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(crossSerialize(a)).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Error.prototype.name', () => {
        const a = new Error('A');
        a.name = 'ExampleError';
        a.stack = '';
        expect(crossSerialize(a, { scopeId: 'example' })).toMatchSnapshot();
      });
      it('supports Error.prototype.cause', () => {
        const a = new Error('A');
        const b = new Error('B', { cause: a });
        a.stack = '';
        b.stack = '';
        expect(crossSerialize(b, { scopeId: 'example' })).toMatchSnapshot();
      });
      it('supports other Error classes', () => {
        const a = new ReferenceError('A');
        a.stack = '';
        expect(crossSerialize(a, { scopeId: 'example' })).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const result = await crossSerializeAsync(Promise.resolve(a));
      const back = await evaluateCross<Promise<Error>>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      const result = await crossSerializeAsync(b);
      const back = evaluateCross<Error>(result);
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = await back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const result = await crossSerializeAsync(Promise.resolve(a));
      const back = await evaluateCross<Promise<Error>>(result);
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
    describe('scoped', () => {
      it('supports Error.prototype.name', async () => {
        const a = new Error('A');
        a.name = 'ExampleError';
        a.stack = '';
        const result = await crossSerializeAsync(Promise.resolve(a), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<Error>>(result, 'example');
        expect(back).toBeInstanceOf(Error);
        expect(back.name).toBe('ExampleError');
        expect(back.message).toBe('A');
      });
      it('supports Error.prototype.cause', async () => {
        const a = new Error('A');
        const b = new Error('B', { cause: Promise.resolve(a) });
        a.stack = '';
        b.stack = '';
        const result = await crossSerializeAsync(b, {
          scopeId: 'example',
        });
        const back = evaluateCross<Error>(result, 'example');
        expect(back).toBeInstanceOf(Error);
        expect(back.message).toBe('B');
        const cause = await back.cause;
        assert(cause instanceof Error);
        expect(cause.message).toBe('A');
      });
      it('supports other Error classes', async () => {
        const a = new ReferenceError('A');
        a.stack = '';
        const result = await crossSerializeAsync(Promise.resolve(a), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<Error>>(result, 'example');
        expect(back).toBeInstanceOf(ReferenceError);
        expect(back.name).toBe('ReferenceError');
        expect(back.message).toBe('A');
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const back = await streamCross<Promise<Error>>(Promise.resolve(a));
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      const back = await streamCross<Promise<Error>>(Promise.resolve(b));
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = await back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const back = await streamCross<Promise<Error>>(Promise.resolve(a));
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
    describe('scoped', () => {
      it('supports Error.prototype.name', async () => {
        const a = new Error('A');
        a.name = 'ExampleError';
        a.stack = '';
        const back = await streamCross<Promise<Error>>(Promise.resolve(a), {
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(Error);
        expect(back.name).toBe('ExampleError');
        expect(back.message).toBe('A');
      });
      it('supports Error.prototype.cause', async () => {
        const a = new Error('A');
        const b = new Error('B', { cause: Promise.resolve(a) });
        a.stack = '';
        b.stack = '';
        const back = await streamCross<Promise<Error>>(Promise.resolve(b), {
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(Error);
        expect(back.message).toBe('B');
        const cause = await back.cause;
        assert(cause instanceof Error);
        expect(cause.message).toBe('A');
      });
      it('supports other Error classes', async () => {
        const a = new ReferenceError('A');
        a.stack = '';
        const back = await streamCross<Promise<Error>>(Promise.resolve(a), {
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(ReferenceError);
        expect(back.name).toBe('ReferenceError');
        expect(back.message).toBe('A');
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const result = toCrossJSON(a);
      const back = fromCrossJSON<Error>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      const result = toCrossJSON(b);
      const back = fromCrossJSON<Error>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const result = toCrossJSON(a);
      const back = fromCrossJSON<Error>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const result = await toCrossJSONAsync(Promise.resolve(a));
      const back = await fromCrossJSON<Promise<Error>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      const result = await toCrossJSONAsync(b);
      const back = fromCrossJSON<Error>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = await back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const result = await toCrossJSONAsync(Promise.resolve(a));
      const back = await fromCrossJSON<Promise<Error>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
  });

  describe('toCrossJSONStream', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      const back = await streamCrossJSON<Promise<Error>>(Promise.resolve(a));
      expect(back).toBeInstanceOf(Error);
      expect(back.name).toBe('ExampleError');
      expect(back.message).toBe('A');
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      const back = await streamCrossJSON<Promise<Error>>(Promise.resolve(b));
      expect(back).toBeInstanceOf(Error);
      expect(back.message).toBe('B');
      const cause = await back.cause;
      assert(cause instanceof Error);
      expect(cause.message).toBe('A');
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      const back = await streamCrossJSON<Promise<Error>>(Promise.resolve(a));
      expect(back).toBeInstanceOf(ReferenceError);
      expect(back.name).toBe('ReferenceError');
      expect(back.message).toBe('A');
    });
  });
});
