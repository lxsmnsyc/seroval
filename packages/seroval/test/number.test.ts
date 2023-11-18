import { describe, it, expect } from 'vitest';
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
      const value = 0xDEADBEEF;
      expect(serialize(value)).toBe(`${value}`);
      expect(serialize(NaN)).toBe('0/0');
      expect(serialize(Infinity)).toBe('1/0');
      expect(serialize(-Infinity)).toBe('-1/0');
      expect(serialize(-0)).toBe('-0');
    });
  });
  describe('serializeAsync', () => {
    it('supports numbers', async () => {
      const value = 0xDEADBEEF;
      expect(await serializeAsync(Promise.resolve(value))).toBe(`Promise.resolve(${value})`);
      expect(await serializeAsync(Promise.resolve(NaN))).toBe('Promise.resolve(0/0)');
      expect(await serializeAsync(Promise.resolve(Infinity))).toBe('Promise.resolve(1/0)');
      expect(await serializeAsync(Promise.resolve(-Infinity))).toBe('Promise.resolve(-1/0)');
      expect(await serializeAsync(Promise.resolve(-0))).toBe('Promise.resolve(-0)');
    });
  });
  describe('toJSON', () => {
    it('supports numbers', () => {
      const value = 0xDEADBEEF;
      expect(JSON.stringify(toJSON(value))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(NaN))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Infinity))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(-Infinity))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(-0))).toMatchSnapshot();
    });
  });
  describe('toJSONAsync', () => {
    it('supports numbers', async () => {
      const value = 0xDEADBEEF;
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(value))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(NaN))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Infinity))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(-Infinity))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(-0))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports numbers', () => {
      const value = 0xDEADBEEF;
      expect(crossSerialize(value)).toMatchSnapshot();
      expect(crossSerialize(NaN)).toMatchSnapshot();
      expect(crossSerialize(Infinity)).toMatchSnapshot();
      expect(crossSerialize(-Infinity)).toMatchSnapshot();
      expect(crossSerialize(-0)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports numbers', async () => {
      const value = 0xDEADBEEF;
      expect(await crossSerializeAsync(Promise.resolve(value))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(NaN))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(Infinity))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(-Infinity))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(-0))).toMatchSnapshot();
    });
  });

  describe('crossSerializeStream', () => {
    it('supports numbers', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(0xDEADBEEF), {
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
    it('supports NaN', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(NaN), {
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
    it('supports Infinity', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(Infinity), {
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
    it('supports -Infinity', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(-Infinity), {
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
    it('supports -0', async () => new Promise<void>((resolve, reject) => {
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
      const value = 0xDEADBEEF;
      expect(JSON.stringify(toCrossJSON(value))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(NaN))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Infinity))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(-Infinity))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(-0))).toMatchSnapshot();
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports numbers', async () => {
      const value = 0xDEADBEEF;
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(value))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(NaN))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Infinity))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(-Infinity))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(-0))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports numbers', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(0xDEADBEEF), {
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
    it('supports NaN', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(NaN), {
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
    it('supports Infinity', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(Infinity), {
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
    it('supports -Infinity', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(-Infinity), {
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
    it('supports -0', async () => new Promise<void>((resolve, reject) => {
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
