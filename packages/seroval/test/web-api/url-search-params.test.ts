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
  describe('crossSerialize', () => {
    it('supports URLSearchParams', () => {
      const example = new URLSearchParams('hello=world&foo=bar');
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports URLSearchParams', () => {
        const example = new URLSearchParams('hello=world&foo=bar');
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports URLSearchParams', async () => {
      const example = new URLSearchParams('hello=world&foo=bar');
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports URLSearchParams', async () => {
        const example = new URLSearchParams('hello=world&foo=bar');
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports URLSearchParams', async () => new Promise<void>((done) => {
      const example = new URLSearchParams('hello=world&foo=bar');
      crossSerializeStream(Promise.resolve(example), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports URLSearchParams', async () => new Promise<void>((done) => {
        const example = new URLSearchParams('hello=world&foo=bar');
        crossSerializeStream(Promise.resolve(example), {
          scopeId: 'example',
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
});
