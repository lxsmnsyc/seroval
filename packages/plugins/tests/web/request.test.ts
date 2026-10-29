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
import { describe, expect, it } from 'vitest';
import RequestPlugin from '../../web/request';
import { evaluateCross } from '../utils/cross';

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
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(await example.text());
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });

    it('supports already read Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      await example.text();
      const result = await serializeAsync(example, {
        plugins: [RequestPlugin],
      });
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(Request);
      expect(back.body).toBe(null);
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
      const back = evaluateCross<typeof example>(result);
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(EXAMPLE_BODY);
      expect(back.url).toBe(example.url);
      expect(back.method).toBe('POST');
    });

    it('supports already read Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      await example.text();
      const result = await crossSerializeAsync(example, {
        plugins: [RequestPlugin],
      });
      const back = evaluateCross<typeof example>(result);
      expect(back).toBeInstanceOf(Request);
      expect(back.body).toBe(null);
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
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
        const back = evaluateCross<typeof example>(result, 'example');
        expect(back).toBeInstanceOf(Request);
        expect(await back.text()).toBe(EXAMPLE_BODY);
        expect(back.url).toBe(example.url);
        expect(back.method).toBe('POST');
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Request', async () =>
      new Promise<void>((resolve, reject) => {
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
      it('supports Request', async () =>
        new Promise<void>((resolve, reject) => {
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
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [RequestPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(await example.text());
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });

    it('supports already read Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      await example.text();
      const result = await toCrossJSONAsync(example, {
        plugins: [RequestPlugin],
      });
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [RequestPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Request);
      expect(back.body).toBe(null);
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Request', async () =>
      new Promise<void>((resolve, reject) => {
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
