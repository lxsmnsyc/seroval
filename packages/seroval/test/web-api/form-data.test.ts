import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../../src';

describe('FormData', () => {
  describe('serialize', () => {
    it('supports FormData', () => {
      const example = new FormData();
      example.set('hello', 'world');
      example.set('foo', 'bar');
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<FormData>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('serializeAsync', () => {
    it('supports FormData', async () => {
      const example = new FormData();
      example.set('hello-world', new File(['Hello World'], 'hello.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      example.set('foo-bar', new File(['Foo Bar'], 'foo-bar.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<FormData>>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toJSON', () => {
    it('supports FormData', () => {
      const example = new FormData();
      example.set('hello', 'world');
      example.set('foo', 'bar');
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<FormData>(result);
      expect(back).toBeInstanceOf(FormData);
    });
  });
  describe('toJSONAsync', () => {
    it('supports FormData', async () => {
      const example = new FormData();
      example.set('example', new File(['Hello World'], 'hello.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      example.set('foo-bar', new File(['Foo Bar'], 'foo-bar.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<FormData>>(result);
      expect(back).toBeInstanceOf(FormData);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('crossSerialize', () => {
    it('supports FormData', () => {
      const example = new FormData();
      example.set('hello', 'world');
      example.set('foo', 'bar');
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports FormData', () => {
        const example = new FormData();
        example.set('hello', 'world');
        example.set('foo', 'bar');
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports FormData', async () => {
      const example = new FormData();
      example.set('hello-world', new File(['Hello World'], 'hello.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      example.set('foo-bar', new File(['Foo Bar'], 'foo-bar.txt', {
        type: 'text/plain',
        lastModified: 1681027542680,
      }));
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports FormData', async () => {
        const example = new FormData();
        example.set('hello-world', new File(['Hello World'], 'hello.txt', {
          type: 'text/plain',
          lastModified: 1681027542680,
        }));
        example.set('foo-bar', new File(['Foo Bar'], 'foo-bar.txt', {
          type: 'text/plain',
          lastModified: 1681027542680,
        }));
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports FormData', async () => new Promise<void>((done) => {
      const example = new FormData();
      example.set('hello', 'world');
      example.set('foo', 'bar');
      crossSerializeStream(Promise.resolve(example), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports FormData', async () => new Promise<void>((done) => {
        const example = new FormData();
        example.set('hello', 'world');
        example.set('foo', 'bar');
        crossSerializeStream(Promise.resolve(example), {
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
