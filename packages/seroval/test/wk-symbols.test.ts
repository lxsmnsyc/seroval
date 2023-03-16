import { describe, it, expect } from 'vitest';
import {
  // deserialize,
  // fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('well-known symbols', () => {
  describe('serialize', () => {
    it('supports strings', () => {
      expect(serialize(Symbol.asyncIterator)).toMatchSnapshot();
      expect(serialize(Symbol.hasInstance)).toMatchSnapshot();
      expect(serialize(Symbol.isConcatSpreadable)).toMatchSnapshot();
      expect(serialize(Symbol.iterator)).toMatchSnapshot();
      expect(serialize(Symbol.match)).toMatchSnapshot();
      expect(serialize(Symbol.matchAll)).toMatchSnapshot();
      expect(serialize(Symbol.replace)).toMatchSnapshot();
      expect(serialize(Symbol.search)).toMatchSnapshot();
      expect(serialize(Symbol.species)).toMatchSnapshot();
      expect(serialize(Symbol.split)).toMatchSnapshot();
      expect(serialize(Symbol.toPrimitive)).toMatchSnapshot();
      expect(serialize(Symbol.toStringTag)).toMatchSnapshot();
      expect(serialize(Symbol.unscopables)).toMatchSnapshot();
    });
  });
  describe('serializeAsync', () => {
    it('supports strings', async () => {
      expect(await serializeAsync(Promise.resolve(Symbol.asyncIterator))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.hasInstance))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.isConcatSpreadable))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.iterator))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.match))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.matchAll))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.replace))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.search))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.species))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.split))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.toPrimitive))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.toStringTag))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(Symbol.unscopables))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports strings', () => {
      expect(JSON.stringify(toJSON(Symbol.asyncIterator))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.hasInstance))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.isConcatSpreadable))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.iterator))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.match))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.matchAll))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.replace))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.search))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.species))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.split))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.toPrimitive))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.toStringTag))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Symbol.unscopables))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports strings', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.asyncIterator))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.hasInstance))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.isConcatSpreadable))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.iterator))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.match))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.matchAll))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.replace))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.search))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.species))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.split))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.toPrimitive))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.toStringTag))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Symbol.unscopables))),
      ).toMatchSnapshot();
    });
  });
});
