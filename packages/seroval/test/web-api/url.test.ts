import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
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
  describe('crossSerialize', () => {
    it('supports Headers', () => {
      const example = new URL('https://github.com/lxsmnsyc/seroval?hello=world');
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Headers', async () => {
      const example = new URL('https://github.com/lxsmnsyc/seroval?hello=world');
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Headers', async () => new Promise<void>((done) => {
      const example = new URL('https://github.com/lxsmnsyc/seroval?hello=world');
      crossSerializeStream(Promise.resolve(example), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
  });
});
