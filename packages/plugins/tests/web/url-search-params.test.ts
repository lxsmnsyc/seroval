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
} from 'seroval';
import { describe, expect, it } from 'vitest';
import URLSearchParamsPlugin from '../../web/url-search-params';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

const EXAMPLE = new URLSearchParams('hello=world&foo=bar');

describe('URLSearchParams', () => {
  describe('serialize', () => {
    it('supports URLSearchParams', () => {
      const result = serialize(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('serializeAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSON', () => {
    it('supports URLSearchParams', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('crossSerialize', () => {
    it('supports URLSearchParams', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports URLSearchParams', () => {
        const result = crossSerialize(EXAMPLE, {
          plugins: [URLSearchParamsPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
    describe('scoped', () => {
      it('supports URLSearchParams', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [URLSearchParamsPlugin],
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(URLSearchParams);
        expect(String(back)).toBe(String(EXAMPLE));
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports URLSearchParams', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
    describe('scoped', () => {
      it('supports URLSearchParams', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          plugins: [URLSearchParamsPlugin],
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(URLSearchParams);
        expect(String(back)).toBe(String(EXAMPLE));
      });
    });
  });
  describe('toJSON', () => {
    it('supports URLSearchParams', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [URLSearchParamsPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [URLSearchParamsPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports URLSearchParams', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
});
