import { describe, it, expect } from 'vitest';
import {
  AsyncServerValue,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  ServerValue,
  toJSON,
  toJSONAsync,
} from '../src';

describe('objects', () => {
  describe('serialize', () => {
    it('supports Objects', () => {
      const example = { hello: 'world' };
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, string>>(result);
      expect(back).toBeInstanceOf(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', () => {
      const example: Record<string, ServerValue> = {};
      example.a = example;
      example.b = example;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, ServerValue>>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
  });
  describe('serializeAsync', () => {
    it('supports Objects', async () => {
      const example = { hello: 'world' };
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Record<string, string>>>(result);
      expect(back).toBeInstanceOf(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', async () => {
      const example: Record<string, AsyncServerValue> = {};
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, Promise<any>>>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
  });
  describe('toJSON', () => {
    it('supports Objects', () => {
      const example = { hello: 'world' };
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, string>>(result);
      expect(back).toBeInstanceOf(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', () => {
      const example: Record<string, ServerValue> = {};
      example.a = example;
      example.b = example;
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, ServerValue>>(result);
      expect(back.a).toBe(back);
      expect(back.b).toBe(back);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Objects', async () => {
      const example = { hello: 'world' };
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Record<string, string>>>(result);
      expect(back).toBeInstanceOf(Object);
      expect(back.hello).toBe(example.hello);
    });
    it('supports self-recursion', async () => {
      const example: Record<string, AsyncServerValue> = {};
      example.a = Promise.resolve(example);
      example.b = Promise.resolve(example);
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, Promise<any>>>(result);
      expect(await back.a).toBe(back);
      expect(await back.b).toBe(back);
    });
  });
});
