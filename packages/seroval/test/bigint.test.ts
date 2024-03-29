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

describe('bigint', () => {
  describe('serialize', () => {
    it('supports bigint', () => {
      expect(serialize(EXAMPLE)).toMatchSnapshot();
      expect(deserialize(serialize(EXAMPLE))).toBe(EXAMPLE);
    });
  });
  describe('serializeAsync', () => {
    it('supports bigint', async () => {
      expect(await serializeAsync(Promise.resolve(EXAMPLE))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports bigint', () => {
      expect(JSON.stringify(toJSON(EXAMPLE))).toMatchSnapshot();
      expect(fromJSON(toJSON(EXAMPLE))).toBe(EXAMPLE);
    });
  });
  describe('toJSONAsync', () => {
    it('supports bigint', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(EXAMPLE))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports bigint', () => {
      expect(crossSerialize(EXAMPLE)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports bigint', async () => {
      expect(
        await crossSerializeAsync(Promise.resolve(EXAMPLE)),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports bigint', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
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
  describe('toCrossJSON', () => {
    it('supports bigint', () => {
      expect(JSON.stringify(toCrossJSON(EXAMPLE))).toMatchSnapshot();
      expect(fromCrossJSON(toCrossJSON(EXAMPLE), { refs: new Map() })).toBe(
        EXAMPLE,
      );
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports bigint', async () => {
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(EXAMPLE))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports bigint', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(EXAMPLE), {
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
