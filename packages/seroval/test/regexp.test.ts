import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('RegExp', () => {
  describe('serialize', () => {
    it('supports RegExp', () => {
      const example = /[a-z0-9]+/i;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<RegExp>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('serializeAsync', () => {
    it('supports RegExp', async () => {
      const example = /[a-z0-9]+/i;
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<RegExp>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSON', () => {
    it('supports RegExp', () => {
      const example = /[a-z0-9]+/i;
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<RegExp>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSONAsync', () => {
    it('supports RegExp', async () => {
      const example = /[a-z0-9]+/i;
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<RegExp>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
});
