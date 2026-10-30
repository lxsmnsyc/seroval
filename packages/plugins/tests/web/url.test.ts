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
import URLPlugin from '../../web/url';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

const EXAMPLE = new URL('https://github.com/lxsmnsyc/seroval?hello=world');

describe('URL', () => {
  describe('serialize', () => {
    it('supports URL', () => {
      const result = serialize(EXAMPLE, {
        plugins: [URLPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('serializeAsync', () => {
    it('supports URL', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLPlugin],
      });
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSON', () => {
    it('supports URL', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [URLPlugin],
      });
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [URLPlugin],
      });
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URL', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLPlugin],
      });
      const back = await fromJSON<Promise<URL>>(result, {
        plugins: [URLPlugin],
      });
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('crossSerialize', () => {
    it('supports URL', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [URLPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports URL', () => {
        const result = crossSerialize(EXAMPLE, {
          scopeId: 'example',
          plugins: [URLPlugin],
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports URL', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLPlugin],
      });
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(URL);
      expect(back.href).toBe(EXAMPLE.href);
    });
    describe('scoped', () => {
      it('supports URL', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
          plugins: [URLPlugin],
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(URL);
        expect(back.href).toBe(EXAMPLE.href);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports URL', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [URLPlugin],
      });
      expect(back).toBeInstanceOf(URL);
      expect(back.href).toBe(EXAMPLE.href);
    });
    describe('scoped', () => {
      it('supports URL', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          plugins: [URLPlugin],
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(URL);
        expect(back.href).toBe(EXAMPLE.href);
      });
    });
  });
  describe('toJSON', () => {
    it('supports URL', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [URLPlugin],
      });
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [URLPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URL', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLPlugin],
      });
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [URLPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports URL', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
        plugins: [URLPlugin],
      });
      expect(back).toBeInstanceOf(URL);
      expect(back.href).toBe(EXAMPLE.href);
    });
  });
});
