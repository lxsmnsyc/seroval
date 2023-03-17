import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
} from '../src';

describe('Date', () => {
  describe('serialize', () => {
    it('supports Date', () => {
      const example = new Date('2023-03-14T11:16:24.879Z');
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<Date>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(example.toISOString());
    });
  });
  describe('serializeAsync', () => {
    it('supports Date', async () => {
      const example = new Date('2023-03-14T11:16:24.879Z');
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Date>>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(example.toISOString());
    });
  });
  describe('toJSON', () => {
    it('supports Date', () => {
      const example = new Date('2023-03-14T11:16:24.879Z');
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<Date>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(example.toISOString());
    });
  });
  describe('toJSONAsync', () => {
    it('supports Date', async () => {
      const example = new Date('2023-03-14T11:16:24.879Z');
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<Date>>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(example.toISOString());
    });
  });
});
