import { describe, it, expect } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  fromCrossJSON,
  fromJSON,
  serialize,
  serializeAsync,
  toCrossJSON,
  toCrossJSONAsync,
  toCrossJSONStream,
  toJSON,
  toJSONAsync,
} from '../src';

const QUOTED = '"hello"';
const HTML = '<script></script>';

describe('string', () => {
  describe('serialize', () => {
    it('supports strings', () => {
      expect(serialize(QUOTED)).toMatchSnapshot();
      expect(serialize(HTML)).toMatchSnapshot();
      expect(deserialize<object>(serialize(QUOTED))).toBe(QUOTED);
      expect(deserialize<object>(serialize(HTML))).toBe(HTML);
    });
  });
  describe('serializeAsync', () => {
    it('supports strings', async () => {
      expect(await serializeAsync(Promise.resolve(QUOTED))).toMatchSnapshot();
      expect(await serializeAsync(Promise.resolve(HTML))).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports strings', () => {
      expect(JSON.stringify(toJSON(QUOTED))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(HTML))).toMatchSnapshot();
      expect(fromJSON<object>(toJSON(QUOTED))).toBe(QUOTED);
      expect(fromJSON<object>(toJSON(HTML))).toBe(HTML);
    });
  });
  describe('toJSONAsync', () => {
    it('supports strings', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(QUOTED))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(HTML))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports strings', () => {
      expect(crossSerialize(QUOTED)).toMatchSnapshot();
      expect(crossSerialize(HTML)).toMatchSnapshot();
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports strings', async () => {
      expect(await crossSerializeAsync(Promise.resolve(QUOTED))).toMatchSnapshot();
      expect(await crossSerializeAsync(Promise.resolve(HTML))).toMatchSnapshot();
    });
  });
  describe('crossSerializeStream', () => {
    it('supports strings', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(QUOTED), {
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
    it('supports sanitized strings', async () => new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(HTML), {
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
    it('supports strings', () => {
      expect(JSON.stringify(toCrossJSON(QUOTED))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(HTML))).toMatchSnapshot();
      expect(
        fromCrossJSON<object>(toCrossJSON(QUOTED), { refs: new Map() }),
      ).toBe(QUOTED);
      expect(
        fromCrossJSON<object>(toCrossJSON(HTML), { refs: new Map() }),
      ).toBe(HTML);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports strings', async () => {
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(QUOTED))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(HTML))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports strings', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(QUOTED), {
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
    it('supports sanitized strings', async () => new Promise<void>((resolve, reject) => {
      toCrossJSONStream(Promise.resolve(HTML), {
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
