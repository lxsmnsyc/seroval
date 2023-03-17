/* eslint-disable no-await-in-loop */
import { describe, it, expect } from 'vitest';
import {
  AsyncServerValue,
  deserialize,
  Feature,
  fromJSON,
  serialize,
  serializeAsync,
  ServerValue,
  toJSON,
  toJSONAsync,
} from '../src';

describe('Set', () => {
  describe('serialize', () => {
    it('supports Set', () => {
      const example = new Set([1, 2, 3]);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
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
  describe('toJSON', () => {
    it('supports Set', () => {
      const example = new Set([1, 2, 3]);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Set<number>>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(example.has(1));
      expect(back.has(2)).toBe(example.has(2));
      expect(back.has(3)).toBe(example.has(3));
    });
    it('supports self-recursion', () => {
      const example: Set<ServerValue> = new Set();
      example.add(example);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Set<ServerValue>>(result);
      expect(back.has(back)).toBe(true);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Set', async () => {
      const example = new Set([1, 2, 3]);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Set<number>>>(result);
      expect(back).toBeInstanceOf(Set);
      expect(back.has(1)).toBe(example.has(1));
      expect(back.has(2)).toBe(example.has(2));
      expect(back.has(3)).toBe(example.has(3));
    });
    it('supports self-recursion', async () => {
      const example: Set<AsyncServerValue> = new Set();
      example.add(Promise.resolve(example));
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Set<Promise<any>>>(result);
      for (const key of back) {
        expect(await key).toBe(back);
      }
    });
  });
  describe('compat', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => serialize(new Set([1, 2, 3]), {
        disabledFeatures: Feature.Set,
      })).toThrowErrorMatchingSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => toJSON(new Set([1, 2, 3]), {
        disabledFeatures: Feature.Set,
      })).toThrowErrorMatchingSnapshot();
    });
  });
});
