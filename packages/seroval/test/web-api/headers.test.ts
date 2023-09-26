import { describe, it, expect } from 'vitest';
import 'node-fetch-native/polyfill';
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
  describe('crossSerialize', () => {
    it('supports Headers', () => {
      const example = new Headers([
        ['Content-Type', 'text/plain'],
        ['Content-Encoding', 'gzip'],
      ]);
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Headers', () => {
        const example = new Headers([
          ['Content-Type', 'text/plain'],
          ['Content-Encoding', 'gzip'],
        ]);
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Headers', async () => {
      const example = new Headers([
        ['Content-Type', 'text/plain'],
        ['Content-Encoding', 'gzip'],
      ]);
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Headers', async () => {
        const example = new Headers([
          ['Content-Type', 'text/plain'],
          ['Content-Encoding', 'gzip'],
        ]);
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Headers', async () => new Promise<void>((done) => {
      const example = new Headers([
        ['Content-Type', 'text/plain'],
        ['Content-Encoding', 'gzip'],
      ]);
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
      it('supports Headers', async () => new Promise<void>((done) => {
        const example = new Headers([
          ['Content-Type', 'text/plain'],
          ['Content-Encoding', 'gzip'],
        ]);
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
