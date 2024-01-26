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
import ReadableStreamPlugin from '../../web/readable-stream';

describe('ReadableStream', () => {
  describe('serializeAsync', () => {
    it('supports ReadableStream', async () => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      const result = await serializeAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'foo',
      });
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'bar',
      });
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'baz',
      });
      expect(await reader.read()).toMatchObject({
        done: true,
        value: undefined,
      });
    });
    it('supports ReadableStream errors', async () => {
      const example = new ReadableStream({
        start(controller): void {
          const error = new Error('Oops!');
          error.stack = '';
          controller.error(error);
        },
      });
      const result = await serializeAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () =>
        reader.read(),
      ).rejects.toThrowErrorMatchingSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports ReadableStream', async () => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      const result = await toJSONAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result, {
        plugins: [ReadableStreamPlugin],
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'foo',
      });
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'bar',
      });
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'baz',
      });
      expect(await reader.read()).toMatchObject({
        done: true,
        value: undefined,
      });
    });
    it('supports ReadableStream errors', async () => {
      const example = new ReadableStream({
        start(controller): void {
          const error = new Error('Oops!');
          error.stack = '';
          controller.error(error);
        },
      });
      const result = await toJSONAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result, {
        plugins: [ReadableStreamPlugin],
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () =>
        reader.read(),
      ).rejects.toThrowErrorMatchingSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports ReadableStream', async () => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      const result = await crossSerializeAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    it('supports ReadableStream errors', async () => {
      const example = new ReadableStream({
        start(controller): void {
          const error = new Error('Oops!');
          error.stack = '';
          controller.error(error);
        },
      });
      const result = await crossSerializeAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports ReadableStream', async () => {
        const example = new ReadableStream({
          start(controller): void {
            controller.enqueue('foo');
            controller.enqueue('bar');
            controller.enqueue('baz');
            controller.close();
          },
        });
        const result = await crossSerializeAsync(example, {
          plugins: [ReadableStreamPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
      it('supports ReadableStream errors', async () => {
        const example = new ReadableStream({
          start(controller): void {
            const error = new Error('Oops!');
            error.stack = '';
            controller.error(error);
          },
        });
        const result = await crossSerializeAsync(example, {
          plugins: [ReadableStreamPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports ReadableStream', async () =>
      new Promise<void>((resolve, reject) => {
        const example = new ReadableStream({
          start(controller): void {
            controller.enqueue('foo');
            controller.enqueue('bar');
            controller.enqueue('baz');
            controller.close();
          },
        });
        crossSerializeStream(example, {
          plugins: [ReadableStreamPlugin],
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
    it('supports ReadableStream errors', async () =>
      new Promise<void>((resolve, reject) => {
        const example = new ReadableStream({
          start(controller): void {
            const error = new Error('Oops!');
            error.stack = '';
            controller.error(error);
          },
        });
        crossSerializeStream(example, {
          plugins: [ReadableStreamPlugin],
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
      it('supports ReadableStream', async () =>
        new Promise<void>((resolve, reject) => {
          const example = new ReadableStream({
            start(controller): void {
              controller.enqueue('foo');
              controller.enqueue('bar');
              controller.enqueue('baz');
              controller.close();
            },
          });
          crossSerializeStream(example, {
            plugins: [ReadableStreamPlugin],
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
      it('supports ReadableStream errors', async () =>
        new Promise<void>((resolve, reject) => {
          const example = new ReadableStream({
            start(controller): void {
              const error = new Error('Oops!');
              error.stack = '';
              controller.error(error);
            },
          });
          crossSerializeStream(example, {
            plugins: [ReadableStreamPlugin],
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
  describe('toCrossJSONAsync', () => {
    it('supports ReadableStream', async () => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      const result = await toCrossJSONAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [ReadableStreamPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'foo',
      });
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'bar',
      });
      expect(await reader.read()).toMatchObject({
        done: false,
        value: 'baz',
      });
      expect(await reader.read()).toMatchObject({
        done: true,
        value: undefined,
      });
    });
    it('supports ReadableStream errors', async () => {
      const example = new ReadableStream({
        start(controller): void {
          const error = new Error('Oops!');
          error.stack = '';
          controller.error(error);
        },
      });
      const result = await toCrossJSONAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [ReadableStreamPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () =>
        reader.read(),
      ).rejects.toThrowErrorMatchingSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports ReadableStream', async () =>
      new Promise<void>((resolve, reject) => {
        const example = new ReadableStream({
          start(controller): void {
            controller.enqueue('foo');
            controller.enqueue('bar');
            controller.enqueue('baz');
            controller.close();
          },
        });
        toCrossJSONStream(example, {
          plugins: [ReadableStreamPlugin],
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
    it('supports ReadableStream errors', async () =>
      new Promise<void>((resolve, reject) => {
        const example = new ReadableStream({
          start(controller): void {
            const error = new Error('Oops!');
            error.stack = '';
            controller.error(error);
          },
        });
        toCrossJSONStream(example, {
          plugins: [ReadableStreamPlugin],
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
