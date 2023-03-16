import { describe, it, expect } from 'vitest';
import {
  compileJSON,
  deserialize,
  Feature,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('null-constructor', () => {
  describe('serialize', () => {
    it('supports Object.create(null)', () => {
      const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, string>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(example.hello);
    });
  });
  describe('serializeAsync', () => {
    it('supports Object.create(null)', async () => {
      const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
      const result = await serializeAsync(example);
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Record<string, string>>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(example.hello);
    });
  });
  describe('toJSON', () => {
    it('supports Object.create(null)', () => {
      const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, string>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(example.hello);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Object.create(null)', async () => {
      const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
      const result = await toJSONAsync(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Record<string, string>>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(example.hello);
    });
  });
  describe('compat', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
      const result = serialize(example, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, string>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(example.hello);
    });
  });
  describe('compat#toJSON', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
      const result = toJSON(example, {
        disabledFeatures: Feature.ObjectAssign,
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      expect(compileJSON(result)).toMatchSnapshot();
      const back = fromJSON<Record<string, string>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(example.hello);
    });
  });
});
