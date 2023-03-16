import { describe, it, expect } from 'vitest';
import {
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('number', () => {
  describe('serialize', () => {
    it('supports numbers', () => {
      const value = 0xDEADBEEF;
      expect(serialize(value)).toBe(`${value}`);
      expect(serialize(NaN)).toBe('NaN');
      expect(serialize(Infinity)).toBe('1/0');
      expect(serialize(-Infinity)).toBe('-1/0');
      expect(serialize(-0)).toBe('-0');
    });
  });
  describe('serializeAsync', () => {
    it('supports numbers', async () => {
      const value = 0xDEADBEEF;
      expect(await serializeAsync(Promise.resolve(value))).toBe(`Promise.resolve(${value})`);
      expect(await serializeAsync(Promise.resolve(NaN))).toBe('Promise.resolve(NaN)');
      expect(await serializeAsync(Promise.resolve(Infinity))).toBe('Promise.resolve(1/0)');
      expect(await serializeAsync(Promise.resolve(-Infinity))).toBe('Promise.resolve(-1/0)');
      expect(await serializeAsync(Promise.resolve(-0))).toBe('Promise.resolve(-0)');
    });
  });
  describe('toJSON', () => {
    it('supports numbers', () => {
      const value = 0xDEADBEEF;
      expect(toJSON(value)).toMatchSnapshot();
      expect(toJSON(NaN)).toMatchSnapshot();
      expect(toJSON(Infinity)).toMatchSnapshot();
      expect(toJSON(-Infinity)).toMatchSnapshot();
      expect(toJSON(-0)).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports numbers', async () => {
      const value = 0xDEADBEEF;
      expect(await toJSONAsync(Promise.resolve(value))).toMatchSnapshot();
      expect(await toJSONAsync(Promise.resolve(NaN))).toMatchSnapshot();
      expect(await toJSONAsync(Promise.resolve(Infinity))).toMatchSnapshot();
      expect(await toJSONAsync(Promise.resolve(-Infinity))).toMatchSnapshot();
      expect(await toJSONAsync(Promise.resolve(-0))).toMatchSnapshot();
    });
  });
});
