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

describe('number', () => {
  describe('serialize', () => {
    it('supports numbers', () => {
      const value = 0xdeadbeef;
      expect(serialize(value)).toBe(`${value}`);
      expect(serialize(Number.NaN)).toBe('0/0');
      expect(serialize(Number.POSITIVE_INFINITY)).toBe('1/0');
      expect(serialize(Number.NEGATIVE_INFINITY)).toBe('-1/0');
      expect(serialize(-0)).toBe('-0');
    });
  });
  describe('serializeAsync', () => {
    it('supports numbers', async () => {
      const value = 0xdeadbeef;
      expect(await serializeAsync(Promise.resolve(value))).toBe(
        `Promise.resolve(${value})`,
      );
      expect(await serializeAsync(Promise.resolve(Number.NaN))).toBe(
        'Promise.resolve(0/0)',
      );
      expect(await serializeAsync(Promise.resolve(Number.POSITIVE_INFINITY))).toBe(
        'Promise.resolve(1/0)',
      );
      expect(await serializeAsync(Promise.resolve(Number.NEGATIVE_INFINITY))).toBe(
        'Promise.resolve(-1/0)',
      );
      expect(await serializeAsync(Promise.resolve(-0))).toBe(
        'Promise.resolve(-0)',
      );
    });
  });
  describe('toJSON', () => {
    it('supports numbers', () => {
      const value = 0xdeadbeef;
      expect(JSON.stringify(toJSON(value))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Number.NaN))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Number.POSITIVE_INFINITY))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Number.NEGATIVE_INFINITY))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(-0))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports numbers', async () => {
      const value = 0xdeadbeef;
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(value))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Number.NaN))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Number.POSITIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Number.NEGATIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(-0))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports numbers', () => {
      const value = 0xdeadbeef;
      expect(crossSerialize(value)).toMatchSnapshot();
      expect(crossSerialize(Number.NaN)).toMatchSnapshot();
      expect(crossSerialize(Number.POSITIVE_INFINITY)).toMatchSnapshot();
      expect(crossSerialize(Number.NEGATIVE_INFINITY)).toMatchSnapshot();
      expect(crossSerialize(-0)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports numbers', async () => {
      const value = 0xdeadbeef;
      expect(
        await crossSerializeAsync(Promise.resolve(value)),
      ).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Number.NaN))).toMatchSnapshot();
      expect(
        await crossSerializeAsync(Promise.resolve(Number.POSITIVE_INFINITY)),
      ).toMatchSnapshot();
      expect(
        await crossSerializeAsync(Promise.resolve(Number.NEGATIVE_INFINITY)),
      ).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(-0))).toMatchSnapshot();
    });
  });

  describe('crossSerializeStream', () => {
    it('supports numbers', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(0xdeadbeef), {
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
    it('supports Number.NaN', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Number.NaN), {
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
    it('supports Number.POSITIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Number.POSITIVE_INFINITY), {
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
    it('supports Number.NEGATIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Number.NEGATIVE_INFINITY), {
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
    it('supports -0', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(-0), {
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
    it('supports numbers', () => {
      const value = 0xdeadbeef;
      expect(JSON.stringify(toCrossJSON(value))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Number.NaN))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Number.POSITIVE_INFINITY))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Number.NEGATIVE_INFINITY))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(-0))).toMatchSnapshot();
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports numbers', async () => {
      const value = 0xdeadbeef;
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(value))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Number.NaN))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Number.POSITIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Number.NEGATIVE_INFINITY))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(-0))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports numbers', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(0xdeadbeef), {
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
    it('supports Number.NaN', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Number.NaN), {
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
    it('supports Number.POSITIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Number.POSITIVE_INFINITY), {
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
    it('supports Number.NEGATIVE_INFINITY', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Number.NEGATIVE_INFINITY), {
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
    it('supports -0', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(-0), {
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
