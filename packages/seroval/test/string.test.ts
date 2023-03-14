import { describe, it, expect } from 'vitest';
import { deserialize, serialize, serializeAsync } from '../src';

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
});
