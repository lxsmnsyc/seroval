import { describe, it, expect } from 'vitest';
import {
  createReference,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('Reference', () => {
  describe('serialize', () => {
    it('supports Reference', () => {
      const example = createReference('example', () => 'Hello World');
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof example>(result);
      expect(back).toBe(example);
    });
  });
  describe('serializeAsync', () => {
    it('supports Reference', async () => {
      const example = createReference('example', () => 'Hello World');
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof example>>(result);
      expect(back).toBe(example);
    });
  });
  describe('toJSON', () => {
    it('supports Reference', () => {
      const example = createReference('example', () => 'Hello World');
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof example>(result);
      expect(back).toBe(example);
    });
  });
  describe('toJSONAsync', () => {
    it('supports Reference', async () => {
      const example = createReference('example', () => 'Hello World');
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof example>>(result);
      expect(back).toBe(example);
    });
  });
});
