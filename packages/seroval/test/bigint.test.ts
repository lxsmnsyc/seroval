import { describe, it, expect } from 'vitest';
import {
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSONAsync,
  toJSON,
  Feature,
} from '../src';

describe('bigint', () => {
  describe('serialize', () => {
    it('supports bigint', () => {
      expect(serialize(9007199254740991n)).toMatchSnapshot();
      expect(deserialize(serialize(9007199254740991n))).toBe(9007199254740991n);
    });
  });
  describe('serializeAsync', () => {
    it('supports bigint', async () => {
      expect(await serializeAsync(Promise.resolve(9007199254740991n))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports bigint', () => {
      expect(JSON.stringify(toJSON(9007199254740991n))).toMatchSnapshot();
      expect(fromJSON(toJSON(9007199254740991n))).toBe(9007199254740991n);
    });
  });
  describe('toJSONAsync', () => {
    it('supports bigint', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(9007199254740991n))),
      ).toMatchSnapshot();
    });
  });
  describe('compat', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => serialize(9007199254740991n, {
        disabledFeatures: Feature.BigInt,
      })).toThrowErrorMatchingSnapshot();
    });
  });
  describe('compat#toJSON', () => {
    it('should throw an error for unsupported target', () => {
      expect(() => toJSON(9007199254740991n, {
        disabledFeatures: Feature.BigInt,
      })).toThrowErrorMatchingSnapshot();
    });
  });
});
