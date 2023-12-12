import { describe, it, expect } from 'vitest';
import {
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSONAsync,
} from 'seroval';
import RequestPlugin from '../../web/request';

const EXAMPLE_URL = 'http://localhost:3000';
const EXAMPLE_BODY = 'Hello World!';

describe('Request', () => {
  describe('serializeAsync', () => {
    it('supports Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const result = await serializeAsync(example, {
        plugins: [RequestPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(await example.text());
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const result = await toJSONAsync(example, {
        plugins: [RequestPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result, {
        plugins: [RequestPlugin],
      });
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(await example.text());
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const result = await crossSerializeAsync(example, {
        plugins: [RequestPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Request', async () => {
        const example = new Request(EXAMPLE_URL, {
          method: 'POST',
          body: EXAMPLE_BODY,
        });
        const result = await crossSerializeAsync(example, {
          plugins: [RequestPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Request', async () => new Promise<void>((resolve, reject) => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      crossSerializeStream(example, {
        plugins: [RequestPlugin],
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
      it('supports Request', async () => new Promise<void>((resolve, reject) => {
        const example = new Request(EXAMPLE_URL, {
          method: 'POST',
          body: EXAMPLE_BODY,
        });
        crossSerializeStream(example, {
          plugins: [RequestPlugin],
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
  describe('toJSONAsync', () => {
    it('supports Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const result = await toCrossJSONAsync(example, {
        plugins: [RequestPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [RequestPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(await example.text());
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Request', async () => new Promise<void>((resolve, reject) => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      toCrossJSONStream(example, {
        plugins: [RequestPlugin],
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
