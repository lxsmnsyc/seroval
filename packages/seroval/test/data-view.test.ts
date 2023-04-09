import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
} from '../src';

describe('DataView', () => {
  describe('serialize', () => {
    it('supports DataView', () => {
      const buffer = new ArrayBuffer(16);
      const example = new DataView(buffer, 0);
      example.setInt16(1, 42);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<DataView>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(example.getInt16(1));
    });
  });
  describe('serializeAsync', () => {
    it('supports DataView', async () => {
      const buffer = new ArrayBuffer(16);
      const example = new DataView(buffer, 0);
      example.setInt16(1, 42);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<DataView>>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(example.getInt16(1));
    });
  });
  describe('toJSON', () => {
    it('supports DataView', () => {
      const buffer = new ArrayBuffer(16);
      const example = new DataView(buffer, 0);
      example.setInt16(1, 42);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<DataView>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(example.getInt16(1));
    });
  });
  describe('toJSONAsync', () => {
    it('supports DataView', async () => {
      const buffer = new ArrayBuffer(16);
      const example = new DataView(buffer, 0);
      example.setInt16(1, 42);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<DataView>>(result);
      expect(back).toBeInstanceOf(DataView);
      expect(back.getInt16(1)).toBe(example.getInt16(1));
    });
  });
});