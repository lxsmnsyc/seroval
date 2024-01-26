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
import { describe, expect, it } from 'vitest';
import HeadersPlugin from '../../web/headers';

const EXAMPLE = new Headers([
  ['Content-Type', 'text/plain'],
  ['Content-Encoding', 'gzip'],
]);

describe('Headers', () => {
  describe('serialize', () => {
    it('supports Headers', () => {
      const result = serialize(EXAMPLE, {
        plugins: [HeadersPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('serializeAsync', () => {
    it('supports Headers', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [HeadersPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSON', () => {
    it('supports Headers', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [HeadersPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Headers>(result, {
        plugins: [HeadersPlugin],
      });
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('toJSONAsync', () => {
    it('supports Headers', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [HeadersPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [HeadersPlugin],
      });
      expect(back).toBeInstanceOf(Headers);
      expect(String(back)).toBe(String(EXAMPLE));
    });
  });
  describe('crossSerialize', () => {
    it('supports Headers', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [HeadersPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Headers', () => {
        const result = crossSerialize(EXAMPLE, {
          plugins: [HeadersPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Headers', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [HeadersPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Headers', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [HeadersPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Headers', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          plugins: [HeadersPlugin],
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
      it('supports Headers', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(EXAMPLE), {
            plugins: [HeadersPlugin],
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
  describe('toCrossJSON', () => {
    it('supports Headers', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [HeadersPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [HeadersPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Headers);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports Headers', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toCrossJSONAsync(example, {
        plugins: [HeadersPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<typeof example>(result, {
        plugins: [HeadersPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Headers);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Headers', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(EXAMPLE), {
          plugins: [HeadersPlugin],
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
