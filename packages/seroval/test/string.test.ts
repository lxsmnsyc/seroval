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

describe('string', () => {
  describe('serialize', () => {
    it('supports strings', () => {
      expect(serialize('"hello"')).toMatchSnapshot();
      expect(serialize('<script></script>')).toMatchSnapshot();
      expect(deserialize(serialize('"hello"'))).toBe('"hello"');
      expect(deserialize(serialize('<script></script>'))).toBe('<script></script>');
    });
  });
  describe('serializeAsync', () => {
    it('supports strings', async () => {
      expect(await serializeAsync(Promise.resolve('"hello"'))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve('<script></script>'))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports strings', () => {
      expect(JSON.stringify(toJSON('"hello"'))).toMatchSnapshot();
      expect(JSON.stringify(toJSON('<script></script>'))).toMatchSnapshot();
      expect(fromJSON(toJSON('"hello"'))).toBe('"hello"');
      expect(fromJSON(toJSON('<script></script>'))).toBe('<script></script>');
    });
  });
  describe('toJSONAsync', () => {
    it('supports strings', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve('"hello"'))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve('<script></script>'))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports strings', () => {
      expect(crossSerialize('"hello"')).toMatchSnapshot();
      expect(crossSerialize('<script></script>')).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports strings', async () => {
      expect(await crossSerializeAsync(Promise.resolve('"hello"'))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve('<script></script>'))).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports strings', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve('"hello"'), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports sanitized strings', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve('<script></script>'), {
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
