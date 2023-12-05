import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from 'seroval';
import URLSearchParamsPlugin from '../../web/url-search-params';

const EXAMPLE = new URLSearchParams('hello=world&foo=bar');

describe('URLSearchParams', () => {
  describe('serialize', () => {
    it('supports URLSearchParams', () => {
      const result = serialize(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('serializeAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSON', () => {
    it('supports URLSearchParams', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('crossSerialize', () => {
    it('supports URLSearchParams', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports URLSearchParams', () => {
        const result = crossSerialize(EXAMPLE, {
          plugins: [URLSearchParamsPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports URLSearchParams', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [URLSearchParamsPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports URLSearchParams', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          resolve();
        },
        onError(error) {
          reject(error);
        },
      });
    }));
    describe('scoped', () => {
      it('supports URLSearchParams', async () => new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          plugins: [URLSearchParamsPlugin],
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    });
  });
  describe('toJSON', () => {
    it('supports URLSearchParams', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [URLSearchParamsPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [URLSearchParamsPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports URLSearchParams', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [URLSearchParamsPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(URLSearchParams);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports URLSearchParams', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(EXAMPLE), {
        plugins: [URLSearchParamsPlugin],
        onParse(data) {
          expect(JSON.stringify(data)).toMatchSnapshot();
        },
        onDone() {
          resolve();
        },
        onError(error) {
          reject(error);
        },
      });
    }));
  });
});
