import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../../src';

describe('URL', () => {
  describe('serialize', () => {
    it('supports URL', () => {
      const example = new URL('https://github.com/lxsmnsyc/seroval?hello=world');
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<URL>(result);
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('serializeAsync', () => {
    it('supports URL', async () => {
      const example = new URL('https://github.com/lxsmnsyc/seroval?hello=world');
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<URL>>(result);
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSON', () => {
    it('supports URL', () => {
      const example = new URL('https://github.com/lxsmnsyc/seroval?hello=world');
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<URL>(result);
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URL', async () => {
      const example = new URL('https://github.com/lxsmnsyc/seroval?hello=world');
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<URL>>(result);
      expect(back).toBeInstanceOf(URL);
      expect(String(back)).toBe(String(example));
    });
  });
});
