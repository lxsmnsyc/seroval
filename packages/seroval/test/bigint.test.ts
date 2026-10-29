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
      expect((await deserialize<Promise<bigint>>(await serializeAsync(Promise.resolve(EXAMPLE))))).toBe(EXAMPLE);
    });
  });
  describe('toJSON', () => {
    it('supports bigint', () => {
      expect(fromJSON(toJSON(EXAMPLE))).toBe(EXAMPLE);
    });
  });
  describe('toJSONAsync', () => {
    it('supports bigint', async () => {
      expect((await fromJSON<Promise<bigint>>(await toJSONAsync(Promise.resolve(EXAMPLE))))).toBe(EXAMPLE);
    });
  });
  describe('crossSerialize', () => {
    it('supports bigint', () => {
      expect(crossSerialize(EXAMPLE)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports bigint', async () => {
      expect((await evaluateCross<Promise<bigint>>(await crossSerializeAsync(Promise.resolve(EXAMPLE))))).toBe(EXAMPLE);
    });
  });
  describe('crossSerializeStream', () => {
    it('supports bigint', async () => {
      const back = await streamCross<Promise<bigint>>(Promise.resolve(EXAMPLE));
      expect(back).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSON', () => {
    it('supports bigint', () => {
      expect(fromCrossJSON(toCrossJSON(EXAMPLE), { refs: new Map() })).toBe(
        EXAMPLE,
      );
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports bigint', async () => {
      expect((await fromCrossJSON<Promise<bigint>>(await toCrossJSONAsync(Promise.resolve(EXAMPLE)), {
        refs: new Map(),
      }))).toBe(EXAMPLE);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports bigint', async () => {
      const back = await streamCrossJSON<Promise<bigint>>(Promise.resolve(EXAMPLE));
      expect(back).toBe(EXAMPLE);
    });
  });
});
