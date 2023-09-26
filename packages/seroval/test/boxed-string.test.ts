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
} from '../src';

describe('boxed string', () => {
  describe('serialize', () => {
    it('supports boxed strings', () => {
      expect(serialize(Object('"hello"'))).toMatchSnapshot();
      expect(serialize(Object('<script></script>'))).toMatchSnapshot();
      expect(deserialize<object>(serialize(Object('"hello"'))).valueOf()).toBe('"hello"');
      expect(deserialize<object>(serialize(Object('<script></script>'))).valueOf()).toBe('<script></script>');
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed strings', async () => {
      expect(await serializeAsync(Promise.resolve(Object('"hello"')))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Object('<script></script>')))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports boxed strings', () => {
      expect(JSON.stringify(toJSON(Object('"hello"')))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object('<script></script>')))).toMatchSnapshot();
      expect(fromJSON<object>(toJSON(Object('"hello"'))).valueOf()).toBe('"hello"');
      expect(fromJSON<object>(toJSON(Object('<script></script>'))).valueOf()).toBe('<script></script>');
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed strings', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object('"hello"')))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object('<script></script>')))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed strings', () => {
      expect(crossSerialize(Object('"hello"'))).toMatchSnapshot();
      expect(crossSerialize(Object('<script></script>'))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed strings', () => {
        expect(crossSerialize(Object('"hello"'), { scopeId: 'example' })).toMatchSnapshot();
        expect(crossSerialize(Object('<script></script>'), { scopeId: 'example' })).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed strings', async () => {
      expect(await crossSerializeAsync(Promise.resolve(Object('"hello"')))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Object('<script></script>')))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed strings', async () => {
        expect(await crossSerializeAsync(Promise.resolve(Object('"hello"')), { scopeId: 'example' })).toMatchSnapshot();
        expect(await crossSerializeAsync(Promise.resolve(Object('<script></script>')), { scopeId: 'example' })).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed strings', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object('"hello"')), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports boxed sanitized strings', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Object('<script></script>')), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports boxed strings', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object('"hello"')), {
          scopeId: 'example',
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            done();
          },
        });
      }));
      it('supports boxed sanitized strings', async () => new Promise<void>((done) => {
        crossSerializeStream(Promise.resolve(Object('<script></script>')), {
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
