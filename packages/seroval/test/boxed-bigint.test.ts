import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
  Feature,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
} from '../src';

describe('boxed bigint', () => {
  describe('serialize', () => {
    it('supports boxed bigint', () => {
      expect(serialize(Object(9007199254740991n))).toMatchSnapshot();
      expect(deserialize<object>(serialize(Object(9007199254740991n))).valueOf())
        .toBe(9007199254740991n);
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed bigint', async () => {
      expect(await serializeAsync(Promise.resolve(Object(9007199254740991n)))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports boxed bigint', () => {
      expect(JSON.stringify(toJSON(Object(9007199254740991n)))).toMatchSnapshot();
      expect(fromJSON<object>(toJSON(Object(9007199254740991n))).valueOf()).toBe(9007199254740991n);
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed bigint', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(9007199254740991n)))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed bigint', () => {
      expect(crossSerialize(Object(9007199254740991n))).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed bigint', async () => {
      expect(
        await crossSerializeAsync(Promise.resolve(Object(9007199254740991n))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed bigint', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object(9007199254740991n)), {
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
    it('should throw an error for unsupported target', () => {
      expect(() => serialize(Object(9007199254740991n), {
        disabledFeatures: Feature.BigInt,
      })).toThrowErrorMatchingSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => toJSON(Object(9007199254740991n), {
        disabledFeatures: Feature.BigInt,
      })).toThrowErrorMatchingSnapshot();
    });
  });
});
