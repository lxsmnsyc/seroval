import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../../src';

describe('URLSearchParams', () => {
  describe('serialize', () => {
    it('supports URLSearchParams', () => {
      const example = new URLSearchParams('hello=world&foo=bar');
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<URLSearchParams>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('serializeAsync', () => {
    it('supports URLSearchParams', async () => {
      const example = new URLSearchParams('hello=world&foo=bar');
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<URLSearchParams>>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSON', () => {
    it('supports URLSearchParams', () => {
      const example = new URLSearchParams('hello=world&foo=bar');
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<URLSearchParams>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URLSearchParams', async () => {
      const example = new URLSearchParams('hello=world&foo=bar');
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<URLSearchParams>>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(example));
    });
  });
});
