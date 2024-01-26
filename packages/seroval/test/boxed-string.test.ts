import { describe, expect, it } from 'vitest';
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

describe('boxed string', () => {
  describe('serialize', () => {
    it('supports boxed strings', () => {
      expect(serialize(Object(QUOTED))).toMatchSnapshot();
      expect(serialize(Object(HTML))).toMatchSnapshot();
      expect(deserialize<object>(serialize(Object(QUOTED))).valueOf()).toBe(
        QUOTED,
      );
      expect(deserialize<object>(serialize(Object(HTML))).valueOf()).toBe(HTML);
    });
  });
  describe('serializeAsync', () => {
    it('supports boxed strings', async () => {
      expect(
        await serializeAsync(Promise.resolve(Object(QUOTED))),
      ).toMatchSnapshot();
      expect(
        await serializeAsync(Promise.resolve(Object(HTML))),
      ).toMatchSnapshot();
    });
  });
  describe('toJSON', () => {
    it('supports boxed strings', () => {
      expect(JSON.stringify(toJSON(Object(QUOTED)))).toMatchSnapshot();
      expect(JSON.stringify(toJSON(Object(HTML)))).toMatchSnapshot();
      expect(fromJSON<object>(toJSON(Object(QUOTED))).valueOf()).toBe(QUOTED);
      expect(fromJSON<object>(toJSON(Object(HTML))).valueOf()).toBe(HTML);
    });
  });
  describe('toJSONAsync', () => {
    it('supports boxed strings', async () => {
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(QUOTED)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toJSONAsync(Promise.resolve(Object(HTML)))),
      ).toMatchSnapshot();
    });
  });
  describe('crossSerialize', () => {
    it('supports boxed strings', () => {
      expect(crossSerialize(Object(QUOTED))).toMatchSnapshot();
      expect(crossSerialize(Object(HTML))).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed strings', () => {
        expect(
          crossSerialize(Object(QUOTED), { scopeId: 'example' }),
        ).toMatchSnapshot();
        expect(
          crossSerialize(Object(HTML), { scopeId: 'example' }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports boxed strings', async () => {
      expect(
        await crossSerializeAsync(Promise.resolve(Object(QUOTED))),
      ).toMatchSnapshot();
      expect(
        await crossSerializeAsync(Promise.resolve(Object(HTML))),
      ).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports boxed strings', async () => {
        expect(
          await crossSerializeAsync(Promise.resolve(Object(QUOTED)), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
        expect(
          await crossSerializeAsync(Promise.resolve(Object(HTML)), {
            scopeId: 'example',
          }),
        ).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports boxed strings', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Object(QUOTED)), {
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
    it('supports boxed sanitized strings', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(Object(HTML)), {
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
    describe('scoped', () => {
      it('supports boxed strings', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(Object(QUOTED)), {
            scopeId: 'example',
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
      it('supports boxed sanitized strings', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(Object(HTML)), {
            scopeId: 'example',
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
  });
  describe('toCrossJSON', () => {
    it('supports boxed strings', () => {
      expect(JSON.stringify(toCrossJSON(Object(QUOTED)))).toMatchSnapshot();
      expect(JSON.stringify(toCrossJSON(Object(HTML)))).toMatchSnapshot();
      expect(
        fromCrossJSON<object>(toCrossJSON(Object(QUOTED)), {
          refs: new Map(),
        }).valueOf(),
      ).toBe(QUOTED);
      expect(
        fromCrossJSON<object>(toCrossJSON(Object(HTML)), {
          refs: new Map(),
        }).valueOf(),
      ).toBe(HTML);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports boxed strings', async () => {
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(QUOTED)))),
      ).toMatchSnapshot();
      expect(
        JSON.stringify(await toCrossJSONAsync(Promise.resolve(Object(HTML)))),
      ).toMatchSnapshot();
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports boxed strings', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(QUOTED)), {
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
    it('supports boxed sanitized strings', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(Object(HTML)), {
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
