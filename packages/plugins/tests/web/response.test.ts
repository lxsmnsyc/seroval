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
import ResponsePlugin from '../../web/response';

const EXAMPLE_BODY = 'Hello World!';

describe('Response', () => {
  describe('serializeAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await serializeAsync(example, {
        plugins: [ResponsePlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });
  describe('toJSONAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await toJSONAsync(example, {
        plugins: [ResponsePlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result, {
        plugins: [ResponsePlugin],
      });
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await crossSerializeAsync(example, {
        plugins: [ResponsePlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports Response', async () => {
        const example = new Response(EXAMPLE_BODY);
        const result = await crossSerializeAsync(example, {
          plugins: [ResponsePlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });

  describe('crossSerializeStream', () => {
    it('supports Response', async () =>
      new Promise<void>((resolve, reject) => {
        const example = new Response(EXAMPLE_BODY);
        crossSerializeStream(example, {
          plugins: [ResponsePlugin],
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
      it('supports Response', async () =>
        new Promise<void>((resolve, reject) => {
          const example = new Response(EXAMPLE_BODY);
          crossSerializeStream(example, {
            plugins: [ResponsePlugin],
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
    it('supports Response', async () => {
      const example = new Response(EXAMPLE_BODY);
      const result = await toCrossJSONAsync(example, {
        plugins: [ResponsePlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [ResponsePlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(Response);
      expect(await back.text()).toBe(await example.text());
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports Response', async () =>
      new Promise<void>((resolve, reject) => {
        const example = new Response(EXAMPLE_BODY);
        toCrossJSONStream(example, {
          plugins: [ResponsePlugin],
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
