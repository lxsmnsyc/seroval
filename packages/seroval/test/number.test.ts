import { describe, it, expect } from 'vitest';
import { serialize, serializeAsync } from '../src';

describe('number', () => {
  describe('serialize', () => {
    it('supports numbers', () => {
      const value = Math.random();
      expect(serialize(value)).toBe(`${value}`);
      expect(serialize(NaN)).toBe('NaN');
      expect(serialize(Infinity)).toBe('1/0');
      expect(serialize(-Infinity)).toBe('-1/0');
      expect(serialize(-0)).toBe('-0');
    });
  });
  describe('serializeAsync', () => {
    it('supports numbers', async () => {
      const value = Math.random();
      expect(await serializeAsync(Promise.resolve(value))).toBe(`Promise.resolve(${value})`);
      expect(await serializeAsync(Promise.resolve(NaN))).toBe('Promise.resolve(NaN)');
      expect(await serializeAsync(Promise.resolve(Infinity))).toBe('Promise.resolve(1/0)');
      expect(await serializeAsync(Promise.resolve(-Infinity))).toBe('Promise.resolve(-1/0)');
      expect(await serializeAsync(Promise.resolve(-0))).toBe('Promise.resolve(-0)');
    });
  });
});
