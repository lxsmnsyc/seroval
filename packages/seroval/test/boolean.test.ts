import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
} from '../src';

describe('boolean', () => {
  describe('serialize', () => {
    it('supports boolean', () => {
      expect(serialize(true)).toBe('!0');
      expect(serialize(false)).toBe('!1');
    });
  });
  describe('serializeAsync', () => {
    it('supports boolean', async () => {
      expect(await serializeAsync(Promise.resolve(true))).toBe('Promise.resolve(!0)');
      expect(await serializeAsync(Promise.resolve(false))).toBe('Promise.resolve(!1)');
    });
  });
  describe('toJSON', () => {
    it('supports boolean', () => {
      expect(JSON.stringify(toJSON(true))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(false))).toMatchSnapshot();
    });
  });
  describe('serializeAsync', () => {
    it('supports boolean', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(true))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(false))),
      ).toMatchSnapshot();
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
      expect(await crossSerializeAsync(Promise.resolve(true))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(false))).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports true value', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(true), {
        onSerialize(data) {
          expect(data).toMatchSnapshot();
        },
        onDone() {
          done();
        },
      });
    }));
    it('supports false value', async () => new Promise<void>((done) => {
      crossSerializeStream(Promise.resolve(false), {
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
