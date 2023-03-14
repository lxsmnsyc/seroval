import { describe, it, expect } from 'vitest';
import { deserialize, serialize, serializeAsync } from '../src';

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
  describe('compat', () => {
    it('should use manual assignment instead of Object.assign', () => {
      const example = Object.assign(Object.create(null), { hello: 'world' }) as { hello: string };
      const result = serialize(example, { target: 'es5' });
      expect(result).toMatchSnapshot();
      const back = deserialize<Record<string, string>>(result);
      expect(back.constructor).toBeUndefined();
      expect(back.hello).toBe(example.hello);
    });
  });
});
