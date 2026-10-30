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

const BUFFER = new ArrayBuffer(16);
const EXAMPLE = new DataView(BUFFER, 0);
EXAMPLE.setInt16(1, 42);

describe('DataView', () => {
  describe('serialize', () => {
    it('supports DataView', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
  });
  describe('serializeAsync', () => {
    it('supports DataView', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
  });
  describe('toJSON', () => {
    it('supports DataView', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
  });
  describe('toJSONAsync', () => {
    it('supports DataView', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
  });
  describe('crossSerialize', () => {
    it('supports DataView', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports DataView', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports DataView', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
    describe('scoped', () => {
      it('supports DataView', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(back).toBeInstanceOf(DataView);
        expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports DataView', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
    describe('scoped', () => {
      it('supports DataView', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(DataView);
        expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports DataView', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports DataView', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports DataView', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(EXAMPLE.getInt16(1));
    });
  });
});
