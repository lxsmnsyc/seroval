import {
  createReference,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serializeAsync,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from 'seroval';
import type { SerovalNode } from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import ReadableStreamPlugin from '../../web/readable-stream';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

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
      const back = deserialize<typeof example>(result);
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () => reader.read()).rejects.toThrowErrorMatchingSnapshot();
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
      const back = fromJSON<typeof example>(result, {
        plugins: [ReadableStreamPlugin],
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () => reader.read()).rejects.toThrowErrorMatchingSnapshot();
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
      const back = evaluateCross<typeof example>(result);
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
      const result = await crossSerializeAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      const back = evaluateCross<typeof example>(result);
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () => reader.read()).rejects.toThrow('Oops!');
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
        const back = evaluateCross<typeof example>(result, 'example');
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
        const result = await crossSerializeAsync(example, {
          plugins: [ReadableStreamPlugin],
          scopeId: 'example',
        });
        const back = evaluateCross<typeof example>(result, 'example');
        expect(back).toBeInstanceOf(ReadableStream);
        const reader = back.getReader();
        await expect(async () => reader.read()).rejects.toThrow('Oops!');
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports ReadableStream', async () => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      const back = await streamCross<typeof example>(example, {
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
      const back = await streamCross<typeof example>(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () => reader.read()).rejects.toThrow('Oops!');
    });
    it('supports ReadableStream interruption', () => {
      const cancelSpy = vi.fn();
      const onSerializeSpy = vi.fn();
      const onDoneSpy = vi.fn();

      let timeout: ReturnType<typeof setTimeout>;

      const stream = new ReadableStream({
        start(controller) {
          timeout = setTimeout(() => {
            controller.enqueue('test');
            controller.close();
          });
        },
        cancel() {
          clearTimeout(timeout);
          cancelSpy();
        },
      });

      const cleanup = crossSerializeStream(stream, {
        plugins: [ReadableStreamPlugin],
        onSerialize() {
          onSerializeSpy();
        },
        onDone() {
          onDoneSpy();
        },
        onError() {
          // no-op
        },
      });

      cleanup();

      expect(cancelSpy).toHaveBeenCalledTimes(1);
      expect(onSerializeSpy).toHaveBeenCalledTimes(1);
      // Explicit interruption is cancellation, not successful completion.
      expect(onDoneSpy).not.toHaveBeenCalled();
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
        const back = await streamCross<typeof example>(example, {
          plugins: [ReadableStreamPlugin],
          scopeId: 'example',
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
        const back = await streamCross<typeof example>(example, {
          plugins: [ReadableStreamPlugin],
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(ReadableStream);
        const reader = back.getReader();
        await expect(async () => reader.read()).rejects.toThrow('Oops!');
      });
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
      const back = fromCrossJSON<typeof example>(result, {
        plugins: [ReadableStreamPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () => reader.read()).rejects.toThrowErrorMatchingSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports ReadableStream', async () => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      const back = await streamCrossJSON<typeof example>(example, {
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
      const back = await streamCrossJSON<typeof example>(example, {
        plugins: [ReadableStreamPlugin],
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () => reader.read()).rejects.toThrow('Oops!');
    });
  });
  describe('malformed input', () => {
    it('rejects a stream source that is not a Stream', async () => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.close();
        },
      });
      const result = await toJSONAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      // The root is the ReadableStream plugin node; aim its stream slot at a
      // non-Stream node.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test builds malformed input on purpose.
      const info = (result.t as unknown as { s: Record<string, SerovalNode> }).s;
      info.stream = toJSON(42).t;
      expect(() => fromJSON(result, { plugins: [ReadableStreamPlugin] })).toThrow();
    });

    it('never invokes `on` on a fake stream source', async () => {
      // A callable `on` is only reachable through a registered reference. Build
      // one and aim the stream slot at an object carrying it: the guard must
      // reject before it is called.
      const onSpy = vi.fn();
      const template = toJSON({ on: createReference('test/readable-stream-fake-on', onSpy) });
      const example = new ReadableStream({
        start(controller): void {
          controller.close();
        },
      });
      const result = await toJSONAsync(example, {
        plugins: [ReadableStreamPlugin],
      });
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- The test builds malformed input on purpose.
      const info = (result.t as unknown as { s: Record<string, SerovalNode> }).s;
      info.stream = template.t;
      expect(() => fromJSON(result, { plugins: [ReadableStreamPlugin] })).toThrow();
      expect(() =>
        fromCrossJSON(result.t, {
          plugins: [ReadableStreamPlugin],
          refs: new Map(),
        }),
      ).toThrow();
      expect(onSpy).not.toHaveBeenCalled();
    });
  });
});
