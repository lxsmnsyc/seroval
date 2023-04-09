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

describe('FormData', () => {
  describe('serialize', () => {
    it('supports FormData', () => {
      const example = new FormData();
      example.set('hello', 'world');
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<FormData>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('serializeAsync', () => {
    it('supports FormData', async () => {
      const example = new FormData();
      example.set('example', new File(['Hello World'], 'hello.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<FormData>>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toJSON', () => {
    it('supports FormData', () => {
      const example = new FormData();
      example.set('hello', 'world');
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<FormData>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toJSONAsync', () => {
    it('supports FormData', async () => {
      const example = new FormData();
      example.set('example', new File(['Hello World'], 'hello.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<FormData>>(result);
      expect(back).toBeInstanceOf(FormData);
      expect(String(back)).toBe(String(example));
    });
  });
});
