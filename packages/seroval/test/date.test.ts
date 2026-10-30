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

const EXAMPLE = new Date('2023-03-14T11:16:24.879Z');

describe('Date', () => {
  describe('serialize', () => {
    it('supports Date', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
  });
  describe('serializeAsync', () => {
    it('supports Date', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
  });
  describe('toJSON', () => {
    it('supports Date', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
  });
  describe('toJSONAsync', () => {
    it('supports Date', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
  });

  describe('crossSerialize', () => {
    it('supports Date', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Date', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Date', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
    describe('scoped', () => {
      it('supports Date', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(Date);
        expect(back.toISOString()).toBe(EXAMPLE.toISOString());
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Date', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
    describe('scoped', () => {
      it('supports Date', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(Date);
        expect(back.toISOString()).toBe(EXAMPLE.toISOString());
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports Date', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Date', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Date', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(EXAMPLE.toISOString());
    });
  });
});
