import {
  crossSerialize,
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from 'seroval';
import { assert, describe, expect, it } from 'vitest';
import { FormDataPlugin } from '../../web';
import { evaluateCross, streamCross, streamCrossJSON } from '../utils/cross';

const SYNC_EXAMPLE = new FormData();
SYNC_EXAMPLE.set('hello', 'world');
SYNC_EXAMPLE.set('foo', 'bar');

const ASYNC_EXAMPLE = new FormData();
ASYNC_EXAMPLE.set(
  'hello-world',
  new File(['Hello World'], 'hello.txt', {
    type: 'text/plain',
    lastModified: 1681027542680,
  }),
);
ASYNC_EXAMPLE.set(
  'foo-bar',
  new File(['Foo Bar'], 'foo-bar.txt', {
    type: 'text/plain',
    lastModified: 1681027542680,
  }),
);

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
      const back = deserialize<typeof ASYNC_EXAMPLE>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toJSON', () => {
    it('supports FormData', () => {
      const result = toJSON(SYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
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
      const back = evaluateCross<typeof ASYNC_EXAMPLE>(result);
      expect(back).toBeInstanceOf(FormData);
      expect([...back.keys()]).toEqual([...ASYNC_EXAMPLE.keys()]);
      const helloWorld = back.get('hello-world');
      assert(helloWorld instanceof File);
      expect(helloWorld.name).toBe('hello.txt');
      expect(await helloWorld.text()).toBe('Hello World');
      const fooBar = back.get('foo-bar');
      assert(fooBar instanceof File);
      expect(fooBar.name).toBe('foo-bar.txt');
      expect(await fooBar.text()).toBe('Foo Bar');
    });
    describe('scoped', () => {
      it('supports FormData', async () => {
        const result = await crossSerializeAsync(ASYNC_EXAMPLE, {
          plugins: [FormDataPlugin],
          scopeId: 'example',
        });
        const back = evaluateCross<typeof ASYNC_EXAMPLE>(result, 'example');
        expect(back).toBeInstanceOf(FormData);
        expect([...back.keys()]).toEqual([...ASYNC_EXAMPLE.keys()]);
        const helloWorld = back.get('hello-world');
        assert(helloWorld instanceof File);
        expect(helloWorld.name).toBe('hello.txt');
        expect(await helloWorld.text()).toBe('Hello World');
        const fooBar = back.get('foo-bar');
        assert(fooBar instanceof File);
        expect(fooBar.name).toBe('foo-bar.txt');
        expect(await fooBar.text()).toBe('Foo Bar');
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports FormData', async () => {
      const back = await streamCross<Promise<typeof SYNC_EXAMPLE>>(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [FormDataPlugin],
      });
      expect(back).toBeInstanceOf(FormData);
      expect([...back.entries()]).toEqual([...SYNC_EXAMPLE.entries()]);
    });
    describe('scoped', () => {
      it('supports FormData', async () => {
        const back = await streamCross<Promise<typeof SYNC_EXAMPLE>>(Promise.resolve(SYNC_EXAMPLE), {
          plugins: [FormDataPlugin],
          scopeId: 'example',
        });
        expect(back).toBeInstanceOf(FormData);
        expect([...back.entries()]).toEqual([...SYNC_EXAMPLE.entries()]);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports FormData', () => {
      const result = toCrossJSON(SYNC_EXAMPLE, {
        plugins: [FormDataPlugin],
      });
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
      const back = fromCrossJSON<typeof ASYNC_EXAMPLE>(result, {
        plugins: [FormDataPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports FormData', async () => {
      const back = await streamCrossJSON<Promise<typeof SYNC_EXAMPLE>>(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [FormDataPlugin],
      });
      expect(back).toBeInstanceOf(FormData);
      expect([...back.entries()]).toEqual([...SYNC_EXAMPLE.entries()]);
    });
  });
});
