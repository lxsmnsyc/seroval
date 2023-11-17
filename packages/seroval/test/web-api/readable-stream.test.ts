import { describe, it, expect } from 'vitest';
import {
  crossSerializeStream, toCrossJSONStream,
} from '../../src';

describe('ReadableStream', () => {
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
