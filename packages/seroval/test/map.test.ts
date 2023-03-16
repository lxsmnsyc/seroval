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

describe('Map', () => {
  describe('serialize', () => {
    it('supports Map', () => {
      const example = new Map([[1, 2], [3, 4]]);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Map<number, number>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(example.get(1));
      expect(back.get(3)).toBe(example.get(3));
    });
    it('supports self-recursion', () => {
      const example: Map<ServerValue, ServerValue> = new Map();
      example.set(example, example);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Map<ServerValue, ServerValue>>(result);
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('serializeAsync', () => {
    it('supports Map', async () => {
      const example = new Map([[1, 2], [3, 4]]);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Map<number, number>>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(example.get(1));
      expect(back.get(3)).toBe(example.get(3));
    });
    it('supports self-recursion', async () => {
      const example: Map<AsyncServerValue, AsyncServerValue> = new Map();
      example.set(Promise.resolve(example), Promise.resolve(example));
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Map<Promise<any>, Promise<any>>>(result);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('toJSON', () => {
    it('supports Map', () => {
      const example = new Map([[1, 2], [3, 4]]);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Map<number, number>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(example.get(1));
      expect(back.get(3)).toBe(example.get(3));
    });
    it('supports self-recursion', () => {
      const example: Map<ServerValue, ServerValue> = new Map();
      example.set(example, example);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Map<ServerValue, ServerValue>>(result);
      expect(back.has(back)).toBe(true);
      expect(back.get(back)).toBe(back);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Map', async () => {
      const example = new Map([[1, 2], [3, 4]]);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Map<number, number>>>(result);
      expect(back).toBeInstanceOf(Map);
      expect(back.get(1)).toBe(example.get(1));
      expect(back.get(3)).toBe(example.get(3));
    });
    it('supports self-recursion', async () => {
      const example: Map<AsyncServerValue, AsyncServerValue> = new Map();
      example.set(Promise.resolve(example), Promise.resolve(example));
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Map<Promise<any>, Promise<any>>>(result);
      for (const [key, value] of back) {
        expect(await key).toBe(back);
        expect(await value).toBe(back);
      }
    });
  });
  describe('compat', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => serialize(new Map(), {
        disabledFeatures: Feature.Map,
      })).toThrowErrorMatchingSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => toJSON(new Map(), {
        disabledFeatures: Feature.Map,
      })).toThrowErrorMatchingSnapshot();
    });
  });
});
