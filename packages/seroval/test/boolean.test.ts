import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
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

describe('boolean', () => {
  describe('serialize', () => {
    it('supports boolean', () => {
      expect(serialize(true)).toBe('!0');
      expect(serialize(false)).toBe('!1');
    });
  });
  describe('serializeAsync', () => {
    it('supports boolean', async () => {
      expect(await serializeAsync(Promise.resolve(true))).toBe(
        'Promise.resolve(!0)',
      );
      expect(await serializeAsync(Promise.resolve(false))).toBe(
        'Promise.resolve(!1)',
      );
    });
  });
  describe('toJSON', () => {
    it('supports boolean', () => {
      expect(fromJSON<boolean>(toJSON(true))).toBe(true);
      expect(fromJSON<boolean>(toJSON(false))).toBe(false);
    });
  });
  describe('toJSONAsync', () => {
    it('supports boolean', async () => {
      expect(await fromJSON<Promise<boolean>>(await toJSONAsync(Promise.resolve(true)))).toBe(true);
      expect(await fromJSON<Promise<boolean>>(await toJSONAsync(Promise.resolve(false)))).toBe(false);
    });
  });
  describe('crossSerialize', () => {
    it('supports boolean', () => {
      expect(crossSerialize(true)).toMatchSnapshot();
      expect(crossSerialize(false)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boolean', async () => {
      expect(await evaluateCross<Promise<boolean>>(await crossSerializeAsync(Promise.resolve(true)))).toBe(true);
      expect(await evaluateCross<Promise<boolean>>(await crossSerializeAsync(Promise.resolve(false)))).toBe(false);
    });
  });
  describe('crossSerializeStream', () => {
    it('supports true value', async () => {
      expect(await streamCross<Promise<boolean>>(Promise.resolve(true))).toBe(true);
    });
    it('supports false value', async () => {
      expect(await streamCross<Promise<boolean>>(Promise.resolve(false))).toBe(false);
    });
  });
  describe('toCrossJSON', () => {
    it('supports boolean', () => {
      expect(fromCrossJSON<boolean>(toCrossJSON(true), { refs: new Map() })).toBe(true);
      expect(fromCrossJSON<boolean>(toCrossJSON(false), { refs: new Map() })).toBe(false);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boolean', async () => {
      expect(
        await fromCrossJSON<Promise<boolean>>(await toCrossJSONAsync(Promise.resolve(true)), { refs: new Map() }),
      ).toBe(true);
      expect(
        await fromCrossJSON<Promise<boolean>>(await toCrossJSONAsync(Promise.resolve(false)), { refs: new Map() }),
      ).toBe(false);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports true value', async () => {
      expect(await streamCrossJSON<Promise<boolean>>(Promise.resolve(true))).toBe(true);
    });
    it('supports false value', async () => {
      expect(await streamCrossJSON<Promise<boolean>>(Promise.resolve(false))).toBe(false);
    });
  });
});
