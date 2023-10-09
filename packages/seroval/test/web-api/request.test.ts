import { describe, it, expect } from 'vitest';
import {
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serializeAsync,
  toJSONAsync,
} from '../../src';

const EXAMPLE_URL = 'http://localhost:3000';
const EXAMPLE_BODY = 'Hello World!';

describe('Request', () => {
  describe('serializeAsync', () => {
    it('supports Request', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Request>>(result);
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
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Request>>(result);
      expect(back).toBeInstanceOf(Request);
      expect(await back.text()).toBe(await example.text());
      expect(back.url).toBe(example.url);
      expect(back.method).toBe(example.method);
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Blob', async () => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      const result = await crossSerializeAsync(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Blob', async () => {
        const example = new Request(EXAMPLE_URL, {
          method: 'POST',
          body: EXAMPLE_BODY,
        });
        const result = await crossSerializeAsync(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports Request', async () => new Promise<void>((done) => {
      const example = new Request(EXAMPLE_URL, {
        method: 'POST',
        body: EXAMPLE_BODY,
      });
      crossSerializeStream(example, {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports Request', async () => new Promise<void>((done) => {
        const example = new Request(EXAMPLE_URL, {
          method: 'POST',
          body: EXAMPLE_BODY,
        });
        crossSerializeStream(example, {
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
