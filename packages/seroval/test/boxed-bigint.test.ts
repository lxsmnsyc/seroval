import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
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

const EXAMPLE = 9007199254740991n;

describe('boxed bigint', () => {
  describe('serialize', () => {
    it('supports boxed bigint', () => {
      expect(serialize(Object(EXAMPLE))).toMatchSnapshot();
      expect(deserialize<object>(serialize(Object(EXAMPLE))).valueOf()).toBe(
        EXAMPLE,
      );
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed bigint', async () => {
      expect(
        await serializeAsync(Promise.resolve(Object(EXAMPLE))),
      ).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports boxed bigint', () => {
      expect(JSON.stringify(toJSON(Object(EXAMPLE)))).toMatchSnapshot();
      expect(fromJSON<object>(toJSON(Object(EXAMPLE))).valueOf()).toBe(EXAMPLE);
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed bigint', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(EXAMPLE)))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed bigint', () => {
      expect(crossSerialize(Object(EXAMPLE))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed bigint', () => {
        expect(
          crossSerialize(Object(EXAMPLE), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed bigint', async () => {
      expect(
        await crossSerializeAsync(Promise.resolve(Object(EXAMPLE))),
      ).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed bigint', async () => {
        expect(
          await crossSerializeAsync(Promise.resolve(Object(EXAMPLE)), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed bigint', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Object(EXAMPLE)), {
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
      it('supports boxed bigint', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(Object(EXAMPLE)), {
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
    it('supports boxed bigint', () => {
      expect(JSON.stringify(toCrossJSON(Object(EXAMPLE)))).toMatchSnapshot();
      expect(
        fromCrossJSON<object>(toCrossJSON(Object(EXAMPLE)), {
          refs: new Map(),
        }).valueOf(),
      ).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boxed bigint', async () => {
      expect(
        JSON.stringify(
          await toCrossJSONAsync(Promise.resolve(Object(EXAMPLE))),
        ),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed bigint', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(EXAMPLE)), {
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
