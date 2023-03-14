/* eslint-disable no-await-in-loop */
import { describe, it, expect } from 'vitest';
import {
  AsyncServerValue,
  deserialize,
  serialize,
  serializeAsync,
  ServerValue,
} from '../src';

describe('Set', () => {
  describe('serialize', () => {
    it('supports Set', () => {
      const example = new Set([1, 2, 3]);
      const result = serialize(example);
      // expect(result).toMatchSnapshot();
      const back = deserialize<Set<number>>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(example.has(1));
      expect(back.has(2)).toBe(example.has(2));
      expect(back.has(3)).toBe(example.has(3));
    });
    it('supports self-recursion', () => {
      const example: Set<ServerValue> = new Set();
      example.add(example);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Set<ServerValue>>(result);
      expect(back.has(back)).toBe(true);
    });
  });
  describe('serializeAsync', () => {
    it('supports Set', async () => {
      const example = new Set([1, 2, 3]);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Set<number>>>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(example.has(1));
      expect(back.has(2)).toBe(example.has(2));
      expect(back.has(3)).toBe(example.has(3));
    });
    it('supports self-recursion', async () => {
      const example: Set<AsyncServerValue> = new Set();
      example.add(Promise.resolve(example));
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Set<Promise<any>>>(result);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
  describe('compat', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => serialize(new Set([1, 2, 3]), { target: 'es5' })).toThrowErrorMatchingSnapshot();
    });
  });
});
