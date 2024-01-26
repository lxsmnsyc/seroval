import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
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
      expect(JSON.stringify(toJSON(true))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(false))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
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
      expect(
        await crossSerializeAsync(Promise.resolve(true)),
      ).toMatchSnapshot();
      expect(
        await crossSerializeAsync(Promise.resolve(false)),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports true value', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(true), {
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports false value', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(false), {
          onSerialize(data) {
            expect(data).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
  });
  describe('toCrossJSON', () => {
    it('supports boolean', () => {
      expect(JSON.stringify(toCrossJSON(true))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(false))).toMatchSnapshot();
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boolean', async () => {
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(true))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(false))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports true value', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(true), {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
    it('supports false value', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(false), {
          onParse(data) {
            expect(JSON.stringify(data)).toMatchSnapshot();
          },
          onDone() {
            resolve();
          },
          onError(error) {
            reject(error);
          },
        });
      }));
  });
});
