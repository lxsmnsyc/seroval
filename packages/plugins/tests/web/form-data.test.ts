import { describe, it, expect } from 'vitest';
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
import { FormDataPlugin } from '../../web';

const SYNC_EXAMPLE = new FormData();
SYNC_EXAMPLE.set('hello', 'world');
SYNC_EXAMPLE.set('foo', 'bar');

const ASYNC_EXAMPLE = new FormData();
ASYNC_EXAMPLE.set('hello-world', new File(['Hello World'], 'hello.txt', {
  type: 'text/plain',
  lastModified: 1681027542680,
}));
ASYNC_EXAMPLE.set('foo-bar', new File(['Foo Bar'], 'foo-bar.txt', {
  type: 'text/plain',
  lastModified: 1681027542680,
}));

describe('FormData', () => {
  describe('serialize', () => {
    it('supports FormData', () => {
      const result = serialize(SYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof SYNC_EXAMPLE>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('serializeAsync', () => {
    it('supports FormData', async () => {
      const result = await serializeAsync(ASYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof ASYNC_EXAMPLE>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toJSON', () => {
    it('supports FormData', () => {
      const result = toJSON(SYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof SYNC_EXAMPLE>(result, {
        plugins: [FormDataPlugin],
      });
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toJSONAsync', () => {
    it('supports FormData', async () => {
      const result = await toJSONAsync(ASYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof ASYNC_EXAMPLE>(result, {
        plugins: [FormDataPlugin],
      });
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('crossSerialize', () => {
    it('supports FormData', () => {
      const result = crossSerialize(SYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports FormData', () => {
        const result = crossSerialize(SYNC_EXAMPLE, {
          plugins: [FormDataPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports FormData', async () => {
      const result = await crossSerializeAsync(ASYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports FormData', async () => {
        const result = await crossSerializeAsync(ASYNC_EXAMPLE, {
          plugins: [FormDataPlugin],
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports FormData', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [FormDataPlugin],
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
      it('supports FormData', async () => new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(SYNC_EXAMPLE), {
          plugins: [FormDataPlugin],
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
    it('supports FormData', () => {
      const result = toCrossJSON(SYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof SYNC_EXAMPLE>(result, {
        plugins: [FormDataPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports FormData', async () => {
      const result = await toCrossJSONAsync(ASYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof ASYNC_EXAMPLE>(result, {
        plugins: [FormDataPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports FormData', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [FormDataPlugin],
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
