import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
} from '../src';

describe('typed arrays', () => {
  describe('serialize', () => {
    it('supports typed arrays', () => {
      const example = new Uint32Array([
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
      ]);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Uint32Array>(result);
      expect(back).toBeInstanceOf(Uint32Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
      expect(back[3]).toBe(example[3]);
    });
  });
  describe('serializeAsync', () => {
    it('supports typed arrays', async () => {
      const example = new Uint32Array([
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
      ]);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Uint32Array>>(result);
      expect(back).toBeInstanceOf(Uint32Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
      expect(back[3]).toBe(example[3]);
    });
  });
  describe('toJSON', () => {
    it('supports typed arrays', () => {
      const example = new Uint32Array([
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
      ]);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Uint32Array>(result);
      expect(back).toBeInstanceOf(Uint32Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
      expect(back[3]).toBe(example[3]);
    });
  });
  describe('toJSONAsync', () => {
    it('supports typed arrays', async () => {
      const example = new Uint32Array([
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
        0xFFFFFFFF,
      ]);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Uint32Array>>(result);
      expect(back).toBeInstanceOf(Uint32Array);
      expect(back[0]).toBe(example[0]);
      expect(back[1]).toBe(example[1]);
      expect(back[2]).toBe(example[2]);
      expect(back[3]).toBe(example[3]);
    });
  });
});
