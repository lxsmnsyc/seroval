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
import { DOMExceptionPlugin } from '../../web';

const EXAMPLE_MESSAGE = 'This is an example message.';
const EXAMPLE_NAME = 'Example';
const EXAMPLE = new DOMException(EXAMPLE_MESSAGE, EXAMPLE_NAME);

describe('DOMException', () => {
  describe('serialize', () => {
    it('supports DOMException', () => {
      const result = serialize(EXAMPLE, {
        plugins: [DOMExceptionPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('serializeAsync', () => {
    it('supports DOMException', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [DOMExceptionPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('toJSON', () => {
    it('supports DOMException', () => {
      const result = toJSON(EXAMPLE, {
        plugins: [DOMExceptionPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result, {
        plugins: [DOMExceptionPlugin],
      });
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('toJSONAsync', () => {
    it('supports DOMException', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE), {
        plugins: [DOMExceptionPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result, {
        plugins: [DOMExceptionPlugin],
      });
      expect(back).toBeInstanceOf(DOMException);
      expect(back.message).toBe(EXAMPLE.message);
      expect(back.name).toBe(EXAMPLE.name);
    });
  });
  describe('crossSerialize', () => {
    it('supports DOMException', () => {
      const result = crossSerialize(EXAMPLE, {
        plugins: [DOMExceptionPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports DOMException', () => {
        const result = crossSerialize(EXAMPLE, {
          plugins: [DOMExceptionPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports DOMException', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
        plugins: [DOMExceptionPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports DOMException', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          plugins: [DOMExceptionPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports DOMException', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(EXAMPLE), {
          plugins: [DOMExceptionPlugin],
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
      it('supports DOMException', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(EXAMPLE), {
            plugins: [DOMExceptionPlugin],
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
    it('supports DOMException', () => {
      const result = toCrossJSON(EXAMPLE, {
        plugins: [DOMExceptionPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        plugins: [DOMExceptionPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(DOMException);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports DOMException', async () => {
      const example = Promise.resolve(EXAMPLE);
      const result = await toCrossJSONAsync(example, {
        plugins: [DOMExceptionPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<typeof example>(result, {
        plugins: [DOMExceptionPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(DOMException);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports DOMException', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(EXAMPLE), {
          plugins: [DOMExceptionPlugin],
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
