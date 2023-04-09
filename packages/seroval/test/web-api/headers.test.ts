import { describe, it, expect } from 'vitest';
import 'node-fetch-native/polyfill';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../../src';

describe('Headers', () => {
  describe('serialize', () => {
    it('supports Headers', () => {
      const example = new Headers([
        ['Content-Type', 'text/plain'],
        ['Content-Encoding', 'gzip'],
      ]);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Headers>(result);
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('serializeAsync', () => {
    it('supports Headers', async () => {
      const example = new Headers([
        ['Content-Type', 'text/plain'],
        ['Content-Encoding', 'gzip'],
      ]);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Headers>>(result);
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSON', () => {
    it('supports Headers', () => {
      const example = new Headers([
        ['Content-Type', 'text/plain'],
        ['Content-Encoding', 'gzip'],
      ]);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Headers>(result);
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSONAsync', () => {
    it('supports Headers', async () => {
      const example = new Headers([
        ['Content-Type', 'text/plain'],
        ['Content-Encoding', 'gzip'],
      ]);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Headers>>(result);
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(example));
    });
  });
});
