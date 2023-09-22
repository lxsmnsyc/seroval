import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
} from '../src';

describe('sparse arrays', () => {
  describe('serialize', () => {
    it('supports sparse arrays', () => {
      const example = new Array(10);
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<undefined[]>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
  describe('serializeAsync', () => {
    it('supports sparse arrays', async () => {
      const example = new Array(10);
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<undefined[]>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
  describe('toJSON', () => {
    it('supports sparse arrays', () => {
      const example = new Array(10);
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<undefined[]>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
  describe('toJSONAsync', () => {
    it('supports sparse arrays', async () => {
      const example = new Array(10);
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<undefined[]>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(example.length);
    });
  });
  describe('crossSerialize', () => {
    it('supports sparse arrays', () => {
      const example = new Array(10);
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports sparse arrays', async () => {
      const example = new Array(10);
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports sparse arrays', async () => new Promise<void>((done) => {
      const example = new Array(10);
      crossSerializeStream(Promise.resolve(example), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
  });
});
