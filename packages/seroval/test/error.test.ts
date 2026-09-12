import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  Feature,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

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
      disabledFeatures => {
        expectPreserved(
          deserialize(serialize(makeError(), { disabledFeatures })),
        );
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
      expectPreserved(new Function('$R', `return (${payload})`)([]));
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
      expect(await serializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      expect(await serializeAsync(b)).toMatchSnapshot();
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(await serializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(JSON.stringify(toJSON(a))).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      expect(JSON.stringify(toJSON(b))).toMatchSnapshot();
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(JSON.stringify(toJSON(a))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(a))),
      ).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      expect(JSON.stringify(await toJSONAsync(b))).toMatchSnapshot();
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(a))),
      ).toMatchSnapshot();
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
      expect(await crossSerializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      expect(await crossSerializeAsync(b)).toMatchSnapshot();
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(await crossSerializeAsync(Promise.resolve(a))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Error.prototype.name', async () => {
        const a = new Error('A');
        a.name = 'ExampleError';
        a.stack = '';
        expect(
          await crossSerializeAsync(Promise.resolve(a), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
      it('supports Error.prototype.cause', async () => {
        const a = new Error('A');
        const b = new Error('B', { cause: Promise.resolve(a) });
        a.stack = '';
        b.stack = '';
        expect(
          await crossSerializeAsync(b, { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
      it('supports other Error classes', async () => {
        const a = new ReferenceError('A');
        a.stack = '';
        expect(
          await crossSerializeAsync(Promise.resolve(a), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports Error.prototype.name', async () =>
      new Promise<void>((resolve, reject) => {
        const a = new Error('A');
        a.name = 'ExampleError';
        a.stack = '';
        crossSerializeStream(Promise.resolve(a), {
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
    it('supports Error.prototype.cause', async () =>
      new Promise<void>((resolve, reject) => {
        const a = new Error('A');
        const b = new Error('B', { cause: Promise.resolve(a) });
        a.stack = '';
        b.stack = '';
        crossSerializeStream(Promise.resolve(b), {
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
    it('supports other Error classes', async () =>
      new Promise<void>((resolve, reject) => {
        const a = new ReferenceError('A');
        a.stack = '';
        crossSerializeStream(Promise.resolve(a), {
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
      it('supports Error.prototype.name', async () =>
        new Promise<void>((resolve, reject) => {
          const a = new Error('A');
          a.name = 'ExampleError';
          a.stack = '';
          crossSerializeStream(Promise.resolve(a), {
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
      it('supports Error.prototype.cause', async () =>
        new Promise<void>((resolve, reject) => {
          const a = new Error('A');
          const b = new Error('B', { cause: Promise.resolve(a) });
          a.stack = '';
          b.stack = '';
          crossSerializeStream(Promise.resolve(b), {
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
      it('supports other Error classes', async () =>
        new Promise<void>((resolve, reject) => {
          const a = new ReferenceError('A');
          a.stack = '';
          crossSerializeStream(Promise.resolve(a), {
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
    it('supports Error.prototype.name', () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(JSON.stringify(toCrossJSON(a))).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', () => {
      const a = new Error('A');
      const b = new Error('B', { cause: a });
      a.stack = '';
      b.stack = '';
      expect(JSON.stringify(toCrossJSON(b))).toMatchSnapshot();
    });
    it('supports other Error classes', () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(JSON.stringify(toCrossJSON(a))).toMatchSnapshot();
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Error.prototype.name', async () => {
      const a = new Error('A');
      a.name = 'ExampleError';
      a.stack = '';
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(a))),
      ).toMatchSnapshot();
    });
    it('supports Error.prototype.cause', async () => {
      const a = new Error('A');
      const b = new Error('B', { cause: Promise.resolve(a) });
      a.stack = '';
      b.stack = '';
      expect(JSON.stringify(await toCrossJSONAsync(b))).toMatchSnapshot();
    });
    it('supports other Error classes', async () => {
      const a = new ReferenceError('A');
      a.stack = '';
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(a))),
      ).toMatchSnapshot();
    });
  });

  describe('toCrossJSONStream', () => {
    it('supports Error.prototype.name', async () =>
      new Promise<void>((resolve, reject) => {
        const a = new Error('A');
        a.name = 'ExampleError';
        a.stack = '';
        toCrossJSONStream(Promise.resolve(a), {
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
    it('supports Error.prototype.cause', async () =>
      new Promise<void>((resolve, reject) => {
        const a = new Error('A');
        const b = new Error('B', { cause: Promise.resolve(a) });
        a.stack = '';
        b.stack = '';
        toCrossJSONStream(Promise.resolve(b), {
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
    it('supports other Error classes', async () =>
      new Promise<void>((resolve, reject) => {
        const a = new ReferenceError('A');
        a.stack = '';
        toCrossJSONStream(Promise.resolve(a), {
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
