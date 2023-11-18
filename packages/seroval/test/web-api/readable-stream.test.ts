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
} from '../../src';

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
      const result = await serializeAsync(example);
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
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
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
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
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
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
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
      const result = await crossSerializeAsync(example);
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
      const result = await crossSerializeAsync(example);
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
        const result = await crossSerializeAsync(example, { scopeId: 'example' });
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
        const result = await crossSerializeAsync(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports ReadableStream', async () => new Promise<void>((resolve, reject) => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      crossSerializeStream(example, {
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
    it('supports ReadableStream errors', async () => new Promise<void>((resolve, reject) => {
      const example = new ReadableStream({
        start(controller): void {
          const error = new Error('Oops!');
          error.stack = '';
          controller.error(error);
        },
      });
      crossSerializeStream(example, {
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
      it('supports ReadableStream', async () => new Promise<void>((resolve, reject) => {
        const example = new ReadableStream({
          start(controller): void {
            controller.enqueue('foo');
            controller.enqueue('bar');
            controller.enqueue('baz');
            controller.close();
          },
        });
        crossSerializeStream(example, {
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
      it('supports ReadableStream errors', async () => new Promise<void>((resolve, reject) => {
        const example = new ReadableStream({
          start(controller): void {
            const error = new Error('Oops!');
            error.stack = '';
            controller.error(error);
          },
        });
        crossSerializeStream(example, {
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
      const result = await toCrossJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
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
      const result = await toCrossJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof example>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(ReadableStream);
      const reader = back.getReader();
      await expect(async () => reader.read()).rejects.toThrowErrorMatchingSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports ReadableStream', async () => new Promise<void>((resolve, reject) => {
      const example = new ReadableStream({
        start(controller): void {
          controller.enqueue('foo');
          controller.enqueue('bar');
          controller.enqueue('baz');
          controller.close();
        },
      });
      toCrossJSONStream(example, {
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
    it('supports ReadableStream errors', async () => new Promise<void>((resolve, reject) => {
      const example = new ReadableStream({
        start(controller): void {
          const error = new Error('Oops!');
          error.stack = '';
          controller.error(error);
        },
      });
      toCrossJSONStream(example, {
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
