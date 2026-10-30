import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toJSON,
  toJSONAsync,
} from '../src';
import { evaluateCross, streamCross, streamCrossJSON } from './utils/cross';

// oxlint-disable-next-line unicorn/no-new-array -- the test needs an array with holes.
const EXAMPLE = new Array(10);

describe('sparse arrays', () => {
  describe('serialize', () => {
    it('supports sparse arrays', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('serializeAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await serializeAsync(Promise.resolve(EXAMPLE));
      const back = await deserialize<Promise<typeof EXAMPLE>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toJSON', () => {
    it('supports sparse arrays', () => {
      const result = toJSON(EXAMPLE);
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toJSONAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await toJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromJSON<Promise<typeof EXAMPLE>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('crossSerialize', () => {
    it('supports sparse arrays', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports sparse arrays', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await crossSerializeAsync(Promise.resolve(EXAMPLE));
      const back = await evaluateCross<Promise<typeof EXAMPLE>>(result);
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
    describe('scoped', () => {
      it('supports sparse arrays', async () => {
        const result = await crossSerializeAsync(Promise.resolve(EXAMPLE), {
          scopeId: 'example',
        });
        const back = await evaluateCross<Promise<typeof EXAMPLE>>(result, 'example');
        expect(0 in back).toBeFalsy();
        expect(back[0]).toBe(undefined);
        expect(back.length).toBe(EXAMPLE.length);
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports sparse arrays', async () => {
      const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
    describe('scoped', () => {
      it('supports sparse arrays', async () => {
        const back = await streamCross<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE), { scopeId: 'example' });
        expect(0 in back).toBeFalsy();
        expect(back[0]).toBe(undefined);
        expect(back.length).toBe(EXAMPLE.length);
      });
    });
  });
  describe('toCrossJSON', () => {
    it('supports sparse arrays', () => {
      const result = toCrossJSON(EXAMPLE);
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports sparse arrays', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(EXAMPLE));
      const back = await fromCrossJSON<Promise<typeof EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports sparse arrays', async () => {
      const back = await streamCrossJSON<Promise<typeof EXAMPLE>>(Promise.resolve(EXAMPLE));
      expect(0 in back).toBeFalsy();
      expect(back[0]).toBe(undefined);
      expect(back.length).toBe(EXAMPLE.length);
    });
  });
});
