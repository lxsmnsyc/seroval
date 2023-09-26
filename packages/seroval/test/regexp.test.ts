import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromJSON,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('RegExp', () => {
  describe('serialize', () => {
    it('supports RegExp', () => {
      const example = /[a-z0-9]+/i;
      const result = serialize(example);
      expect(result).toMatchSnapshot();
      const back = deserialize<RegExp>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('serializeAsync', () => {
    it('supports RegExp', async () => {
      const example = /[a-z0-9]+/i;
      const result = await serializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<RegExp>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSON', () => {
    it('supports RegExp', () => {
      const example = /[a-z0-9]+/i;
      const result = toJSON(example);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<RegExp>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('toJSONAsync', () => {
    it('supports RegExp', async () => {
      const example = /[a-z0-9]+/i;
      const result = await toJSONAsync(Promise.resolve(example));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<RegExp>>(result);
      expect(back).toBeInstanceOf(RegExp);
      expect(String(back)).toBe(String(example));
    });
  });
  describe('crossSerialize', () => {
    it('supports RegExp', () => {
      const example = /[a-z0-9]+/i;
      const result = crossSerialize(example);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports RegExp', () => {
        const example = /[a-z0-9]+/i;
        const result = crossSerialize(example, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports RegExp', async () => {
      const example = /[a-z0-9]+/i;
      const result = await crossSerializeAsync(Promise.resolve(example));
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports RegExp', async () => {
        const example = /[a-z0-9]+/i;
        const result = await crossSerializeAsync(Promise.resolve(example), { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports RegExp', async () => new Promise<void>((done) => {
      const example = /[a-z0-9]+/i;
      crossSerializeStream(Promise.resolve(example), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    describe('scoped', () => {
      it('supports RegExp', async () => new Promise<void>((done) => {
        const example = /[a-z0-9]+/i;
        crossSerializeStream(Promise.resolve(example), {
          scopeId: 'example',
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
});
