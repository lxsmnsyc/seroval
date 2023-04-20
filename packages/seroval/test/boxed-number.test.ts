import { describe, it, expect } from 'vitest';
import {
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('boxed number', () => {
  describe('serialize', () => {
    it('supports boxed numbers', () => {
      const value = 0xDEADBEEF;
      expect(serialize(Object(value))).toBe(`Object(${value})`);
      expect(serialize(Object(NaN))).toBe('Object(NaN)');
      expect(serialize(Object(Infinity))).toBe('Object(1/0)');
      expect(serialize(Object(-Infinity))).toBe('Object(-1/0)');
      expect(serialize(Object(-0))).toBe('Object(-0)');
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xDEADBEEF;
      expect(await serializeAsync(Promise.resolve(Object(value)))).toBe(`Promise.resolve(Object(${value}))`);
      expect(await serializeAsync(Promise.resolve(Object(NaN)))).toBe('Promise.resolve(Object(NaN))');
      expect(await serializeAsync(Promise.resolve(Object(Infinity)))).toBe('Promise.resolve(Object(1/0))');
      expect(await serializeAsync(Promise.resolve(Object(-Infinity)))).toBe('Promise.resolve(Object(-1/0))');
      expect(await serializeAsync(Promise.resolve(Object(-0)))).toBe('Promise.resolve(Object(-0))');
    });
  });
  describe('toJSON', () => {
    it('supports boxed numbers', () => {
      const value = 0xDEADBEEF;
      expect(JSON.stringify(toJSON(Object(value)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(NaN)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(Infinity)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(-Infinity)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(-0)))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed numbers', async () => {
      const value = 0xDEADBEEF;
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(value)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(NaN)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(Infinity)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(-Infinity)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(-0)))),
      ).toMatchSnapshot();
    });
  });
});