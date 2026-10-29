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

const QUOTED = '"hello"';
const HTML = '<script></script>';

describe('string', () => {
  describe('serialize', () => {
    it('supports strings', () => {
      expect(serialize(QUOTED)).toMatchSnapshot();
      expect(serialize(HTML)).toMatchSnapshot();
      expect(deserialize<object>(serialize(QUOTED))).toBe(QUOTED);
      expect(deserialize<object>(serialize(HTML))).toBe(HTML);
    });
  });
  describe('serializeAsync', () => {
    it('supports strings', async () => {
      expect((await deserialize<Promise<string>>(await serializeAsync(Promise.resolve(QUOTED))))).toBe(QUOTED);
      expect((await deserialize<Promise<string>>(await serializeAsync(Promise.resolve(HTML))))).toBe(HTML);
    });
  });
  describe('toJSON', () => {
    it('supports strings', () => {
      expect(fromJSON<object>(toJSON(QUOTED))).toBe(QUOTED);
      expect(fromJSON<object>(toJSON(HTML))).toBe(HTML);
    });
  });
  describe('toJSONAsync', () => {
    it('supports strings', async () => {
      expect((await fromJSON<Promise<string>>(await toJSONAsync(Promise.resolve(QUOTED))))).toBe(QUOTED);
      expect((await fromJSON<Promise<string>>(await toJSONAsync(Promise.resolve(HTML))))).toBe(HTML);
    });
  });
  describe('crossSerialize', () => {
    it('supports strings', () => {
      expect(crossSerialize(QUOTED)).toMatchSnapshot();
      expect(crossSerialize(HTML)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports strings', async () => {
      expect((await evaluateCross<Promise<string>>(await crossSerializeAsync(Promise.resolve(QUOTED))))).toBe(QUOTED);
      expect((await evaluateCross<Promise<string>>(await crossSerializeAsync(Promise.resolve(HTML))))).toBe(HTML);
    });
  });
  describe('crossSerializeStream', () => {
    it('supports strings', async () => {
      const back = await streamCross<Promise<string>>(Promise.resolve(QUOTED));
      expect(back).toBe(QUOTED);
    });
    it('supports sanitized strings', async () => {
      const back = await streamCross<Promise<string>>(Promise.resolve(HTML));
      expect(back).toBe(HTML);
    });
  });
  describe('toCrossJSON', () => {
    it('supports strings', () => {
      expect(
        fromCrossJSON<object>(toCrossJSON(QUOTED), { refs: new Map() }),
      ).toBe(QUOTED);
      expect(
        fromCrossJSON<object>(toCrossJSON(HTML), { refs: new Map() }),
      ).toBe(HTML);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports strings', async () => {
      expect((await fromCrossJSON<Promise<string>>(await toCrossJSONAsync(Promise.resolve(QUOTED)), {
        refs: new Map(),
      }))).toBe(QUOTED);
      expect((await fromCrossJSON<Promise<string>>(await toCrossJSONAsync(Promise.resolve(HTML)), {
        refs: new Map(),
      }))).toBe(HTML);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports strings', async () => {
      const back = await streamCrossJSON<Promise<string>>(Promise.resolve(QUOTED));
      expect(back).toBe(QUOTED);
    });
    it('supports sanitized strings', async () => {
      const back = await streamCrossJSON<Promise<string>>(Promise.resolve(HTML));
      expect(back).toBe(HTML);
    });
  });
});
