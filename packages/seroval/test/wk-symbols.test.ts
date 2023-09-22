import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  // deserialize,
  // fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('well-known symbols', () => {
  describe('serialize', () => {
    it('supports well-known symbols', () => {
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
    it('supports well-known symbols', async () => {
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
    it('supports well-known symbols', () => {
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
    it('supports well-known symbols', async () => {
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
  describe('crossSerialize', () => {
    it('supports well-known symbols', () => {
      expect(crossSerialize(Symbol.asyncIterator)).toMatchSnapshot();
      expect(crossSerialize(Symbol.hasInstance)).toMatchSnapshot();
      expect(crossSerialize(Symbol.isConcatSpreadable)).toMatchSnapshot();
      expect(crossSerialize(Symbol.iterator)).toMatchSnapshot();
      expect(crossSerialize(Symbol.match)).toMatchSnapshot();
      expect(crossSerialize(Symbol.matchAll)).toMatchSnapshot();
      expect(crossSerialize(Symbol.replace)).toMatchSnapshot();
      expect(crossSerialize(Symbol.search)).toMatchSnapshot();
      expect(crossSerialize(Symbol.species)).toMatchSnapshot();
      expect(crossSerialize(Symbol.split)).toMatchSnapshot();
      expect(crossSerialize(Symbol.toPrimitive)).toMatchSnapshot();
      expect(crossSerialize(Symbol.toStringTag)).toMatchSnapshot();
      expect(crossSerialize(Symbol.unscopables)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports well-known symbols', async () => {
      expect(await crossSerializeAsync(Promise.resolve(Symbol.asyncIterator))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.hasInstance))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.isConcatSpreadable)))
        .toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.iterator))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.match))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.matchAll))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.replace))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.search))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.species))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.split))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.toPrimitive))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.toStringTag))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Symbol.unscopables))).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports Symbol.asyncIterator', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.asyncIterator), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.hasInstance', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.hasInstance), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.isConcatSpreadable', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.isConcatSpreadable), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.iterator', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.iterator), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.match', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.match), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.matchAll', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.matchAll), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.replace', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.replace), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.search', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.search), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.species', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.species), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.split', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.split), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.toPrimitive', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.toPrimitive), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.toStringTag', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.toStringTag), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports Symbol.unscopables', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(Symbol.unscopables), {
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
