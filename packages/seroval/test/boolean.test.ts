import { describe, it, expect } from 'vitest';
import { serialize, serializeAsync } from '../src';

describe('boolean', () => {
  describe('serialize', () => {
    it('supports boolean', () => {
      expect(serialize(true)).toBe('!0');
      expect(serialize(false)).toBe('!1');
    });
  });
  describe('serializeAsync', () => {
    it('supports boolean', async () => {
      expect(await serializeAsync(true)).toBe('!0');
      expect(await serializeAsync(false)).toBe('!1');
    });
  });
});
