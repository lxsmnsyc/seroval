import { describe, it, expect } from 'vitest';
import { serialize, serializeAsync } from '../src';

describe('boxed boolean', () => {
  describe('serialize', () => {
    it('supports boolean', () => {
      expect(serialize(Object(true))).toBe('Object(!0)');
      expect(serialize(Object(false))).toBe('Object(!1)');
    });
  });
  describe('serializeAsync', () => {
    it('supports boolean', async () => {
      expect(await serializeAsync(Object(true))).toBe('Object(!0)');
      expect(await serializeAsync(Object(false))).toBe('Object(!1)');
    });
  });
});
