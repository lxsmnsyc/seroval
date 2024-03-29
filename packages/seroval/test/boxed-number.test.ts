import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

describe('boxed number', () => {
  describe('serialize', () => {
    it('supports boxed numbers', () => {
      const value = 0xdeadbeef;
      expect(serialize(Object(value))).toBe(`Object(${value})`);
      expect(serialize(Object(Number.NaN))).toBe('Object(0/0)');
      expect(serialize(Object(Number.POSITIVE_INFINITY))).toBe('Object(1/0)');
      expect(serialize(Object(Number.NEGATIVE_INFINITY))).toBe('Object(-1/0)');
      expect(serialize(Object(-0))).toBe('Object(-0)');
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xdeadbeef;
      expect(await serializeAsync(Promise.resolve(Object(value)))).toBe(
        `Promise.resolve(Object(${value}))`,
      );
      expect(await serializeAsync(Promise.resolve(Object(Number.NaN)))).toBe(
        'Promise.resolve(Object(0/0))',
      );
      expect(
        await serializeAsync(Promise.resolve(Object(Number.POSITIVE_INFINITY))),
      ).toBe('Promise.resolve(Object(1/0))');
      expect(
        await serializeAsync(Promise.resolve(Object(Number.NEGATIVE_INFINITY))),
      ).toBe('Promise.resolve(Object(-1/0))');
      expect(await serializeAsync(Promise.resolve(Object(-0)))).toBe(
        'Promise.resolve(Object(-0))',
      );
    });
  });
  describe('toJSON', () => {
    it('supports boxed numbers', () => {
      const value = 0xdeadbeef;
      expect(JSON.stringify(toJSON(Object(value)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(Number.NaN)))).toMatchSnapshot();
      expect(
        JSON.stringify(toJSON(Object(Number.POSITIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(toJSON(Object(Number.NEGATIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(-0)))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xdeadbeef;
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(value)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(Number.NaN)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(
          await toJSONAsync(Promise.resolve(Object(Number.POSITIVE_INFINITY))),
        ),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(
          await toJSONAsync(Promise.resolve(Object(Number.NEGATIVE_INFINITY))),
        ),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(-0)))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed numbers', () => {
      const value = 0xdeadbeef;
      expect(crossSerialize(Object(value))).toMatchSnapshot();
      expect(crossSerialize(Object(Number.NaN))).toMatchSnapshot();
      expect(
        crossSerialize(Object(Number.POSITIVE_INFINITY)),
      ).toMatchSnapshot();
      expect(
        crossSerialize(Object(Number.NEGATIVE_INFINITY)),
      ).toMatchSnapshot();
      expect(crossSerialize(Object(-0))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed numbers', () => {
        const value = 0xdeadbeef;
        expect(
          crossSerialize(Object(value), { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(Number.NaN), { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(Number.POSITIVE_INFINITY), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(Number.NEGATIVE_INFINITY), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(-0), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xdeadbeef;
      expect(
        await crossSerializeAsync(Promise.resolve(Object(value))),
      ).toMatchSnapshot();
      expect(
        await crossSerializeAsync(Promise.resolve(Object(Number.NaN))),
      ).toMatchSnapshot();
      expect(
        await crossSerializeAsync(
          Promise.resolve(Object(Number.POSITIVE_INFINITY)),
        ),
      ).toMatchSnapshot();
      expect(
        await crossSerializeAsync(
          Promise.resolve(Object(Number.NEGATIVE_INFINITY)),
        ),
      ).toMatchSnapshot();
      expect(
        await crossSerializeAsync(Promise.resolve(Object(-0))),
      ).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed numbers', async () => {
        const value = 0xdeadbeef;
        expect(
          await crossSerializeAsync(Promise.resolve(Object(value)), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
        expect(
          await crossSerializeAsync(Promise.resolve(Object(Number.NaN)), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
        expect(
          await crossSerializeAsync(
            Promise.resolve(Object(Number.POSITIVE_INFINITY)),
            {
              scopeId: 'example',
            },
          ),
        ).toMatchSnapshot();
        expect(
          await crossSerializeAsync(
            Promise.resolve(Object(Number.NEGATIVE_INFINITY)),
            {
              scopeId: 'example',
            },
          ),
        ).toMatchSnapshot();
        expect(
          await crossSerializeAsync(Promise.resolve(Object(-0)), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports boxed numbers', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Object(0xdeadbeef)), {
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
    it('supports boxed Number.NaN', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Object(Number.NaN)), {
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
    it('supports boxed Number.POSITIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(
          Promise.resolve(Object(Number.POSITIVE_INFINITY)),
          {
            onSerialize(data) {
              expect(data).toMatchSnapshot();
            },
            onDone() {
              resolve();
            },
            onError(error) {
              reject(error);
            },
          },
        );
      }));
    it('supports boxed Number.NEGATIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(
          Promise.resolve(Object(Number.NEGATIVE_INFINITY)),
          {
            onSerialize(data) {
              expect(data).toMatchSnapshot();
            },
            onDone() {
              resolve();
            },
            onError(error) {
              reject(error);
            },
          },
        );
      }));
    it('supports boxed -0', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Object(-0)), {
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
      it('supports boxed numbers', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(Object(0xdeadbeef)), {
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
      it('supports boxed Number.NaN', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(Object(Number.NaN)), {
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
      it('supports boxed Number.POSITIVE_INFINITY', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(
            Promise.resolve(Object(Number.POSITIVE_INFINITY)),
            {
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
            },
          );
        }));
      it('supports boxed Number.NEGATIVE_INFINITY', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(
            Promise.resolve(Object(Number.NEGATIVE_INFINITY)),
            {
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
            },
          );
        }));
      it('supports boxed -0', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(Object(-0)), {
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
    it('supports boxed numbers', () => {
      const value = 0xdeadbeef;
      expect(JSON.stringify(toCrossJSON(Object(value)))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(Number.NaN)))).toMatchSnapshot();
      expect(
        JSON.stringify(toCrossJSON(Object(Number.POSITIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(toCrossJSON(Object(Number.NEGATIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(-0)))).toMatchSnapshot();
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xdeadbeef;
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(value)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(
          await toCrossJSONAsync(Promise.resolve(Object(Number.NaN))),
        ),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(
          await toCrossJSONAsync(
            Promise.resolve(Object(Number.POSITIVE_INFINITY)),
          ),
        ),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(
          await toCrossJSONAsync(
            Promise.resolve(Object(Number.NEGATIVE_INFINITY)),
          ),
        ),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(-0)))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed numbers', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(0xdeadbeef)), {
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
    it('supports boxed Number.NaN', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(Number.NaN)), {
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
    it('supports boxed Number.POSITIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(Number.POSITIVE_INFINITY)), {
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
    it('supports boxed Number.NEGATIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(Number.NEGATIVE_INFINITY)), {
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
    it('supports boxed -0', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(-0)), {
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
