import {
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toJSONAsync,
} from 'seroval';
import { assert, describe, expect, it, onTestFinished } from 'vitest';
import RequestPlugin from '../../web/request';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

const EXAMPLE_URL = 'http://localhost:3000';
const EXAMPLE_BODY = 'Hello World!';

// Hides `Request.body` the way Firefox does, which has no such getter. It
// patches the prototype so that `clone()` copies lack the getter too. Returns
// a function that restores the getter, which also runs when the test ends.
function hideRequestBody(): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(Request.prototype, 'body');
  Object.defineProperty(Request.prototype, 'body', {
    configurable: true,
    get() {
      return undefined;
    },
  });
  function restoreRequestBody(): void {
    if (descriptor) {
      Object.defineProperty(Request.prototype, 'body', descriptor);
    }
  }
  onTestFinished(restoreRequestBody);
  return restoreRequestBody;
}

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

    it('supports Request without the body getter', async () => {
      const restoreRequestBody = hideRequestBody();
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const result = await crossSerializeAsync(example, {
        plugins: [RequestPlugin],
      });
      restoreRequestBody();
      const back = evaluateCross<typeof example>(result);
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(EXAMPLE_BODY);
    });

    it('supports GET Request without the body getter', async () => {
      const restoreRequestBody = hideRequestBody();
      const example = new Request(EXAMPLE_URL);
      const result = await crossSerializeAsync(example, {
        plugins: [RequestPlugin],
      });
      restoreRequestBody();
      const back = evaluateCross<typeof example>(result);
      expect(back).toBeInstanceOf(Request);
      expect(back.body).toBe(null);
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
    it('supports Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const back = await streamCross<typeof example>(example, {
        plugins: [RequestPlugin],
      });
      assert(back instanceof Request);
      expect(await back.text()).toBe(EXAMPLE_BODY);
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
    it('supports Request without the body getter', async () => {
      const restoreRequestBody = hideRequestBody();
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const back = await streamCross<typeof example>(example, {
        plugins: [RequestPlugin],
      });
      restoreRequestBody();
      assert(back instanceof Request);
      expect(await back.text()).toBe(EXAMPLE_BODY);
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
    describe('scoped', () => {
      it('supports Request', async () => {
        const example = new Request(EXAMPLE_URL, {
          method: 'POST',
          body: EXAMPLE_BODY,
        });
        const back = await streamCross<typeof example>(example, {
          plugins: [RequestPlugin],
          scopeId: 'example',
        });
        assert(back instanceof Request);
        expect(await back.text()).toBe(EXAMPLE_BODY);
        expect(back.url).toBe(example.url);
        expect(back.method).toBe(example.method);
      });
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
    it('supports Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const back = await streamCrossJSON<typeof example>(example, {
        plugins: [RequestPlugin],
      });
      assert(back instanceof Request);
      expect(await back.text()).toBe(EXAMPLE_BODY);
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
  });
});
