import { describe, it, expect } from 'vitest';
import { deserialize, serialize, serializeAsync } from '../src';

describe('Date', () => {
  describe('serialize', () => {
    it('supports Date', () => {
      const example = new Date();
      const result = serialize(example);
      // expect(result).toMatchSnapshot();
      const back = deserialize<Date>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(example.toISOString());
    });
  });
  describe('serializeAsync', () => {
    it('supports Date', async () => {
      const example = new Date();
      const result = await serializeAsync(Promise.resolve(example));
      // expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<Date>>(result);
      expect(back).toBeInstanceOf(Date);
      expect(back.toISOString()).toBe(example.toISOString());
    });
  });
});
