import { describe, it, expect } from 'vitest';
import {
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
});
