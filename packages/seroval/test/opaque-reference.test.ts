import { describe, expect, it } from 'vitest';
import {
  OpaqueReference,
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
} from '../src';

const EXAMPLE = {
  transparent: 'This is transparent',
  opaque: new OpaqueReference('This is opaque'),
};

const REPLACEMENT = 'This is a dummy value.';

const EXAMPLE_WITH_REPLACEMENT = {
  transparent: 'This is transparent',
  opaque: new OpaqueReference('This is opaque', REPLACEMENT),
};

describe('OpaqueReference', () => {
  describe('serialize', () => {
    it('supports OpaqueReference', () => {
      const result = serialize(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE.transparent);
      expect(back.opaque).toBe(undefined);
    });
    it('supports OpaqueReference with replacement', () => {
      const result = serialize(EXAMPLE_WITH_REPLACEMENT);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE_WITH_REPLACEMENT>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE_WITH_REPLACEMENT.transparent);
      expect(back.opaque).toBe(REPLACEMENT);
    });
  });
  describe('serializeAsync', () => {
    it('supports OpaqueReference', async () => {
      const result = await serializeAsync(EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE.transparent);
      expect(back.opaque).toBe(undefined);
    });
    it('supports OpaqueReference with replacement', async () => {
      const result = await serializeAsync(EXAMPLE_WITH_REPLACEMENT);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof EXAMPLE_WITH_REPLACEMENT>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE_WITH_REPLACEMENT.transparent);
      expect(back.opaque).toBe(REPLACEMENT);
    });
  });
  describe('toJSON', () => {
    it('supports OpaqueReference', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE.transparent);
      expect(back.opaque).toBe(undefined);
    });
    it('supports OpaqueReference with replacement', () => {
      const result = toJSON(EXAMPLE_WITH_REPLACEMENT);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE_WITH_REPLACEMENT>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE_WITH_REPLACEMENT.transparent);
      expect(back.opaque).toBe(REPLACEMENT);
    });
  });
  describe('toJSONAsync', () => {
    it('supports OpaqueReference', () => {
      const result = toJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE.transparent);
      expect(back.opaque).toBe(undefined);
    });
    it('supports OpaqueReference with replacement', () => {
      const result = toJSON(EXAMPLE_WITH_REPLACEMENT);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof EXAMPLE_WITH_REPLACEMENT>(result);
      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE_WITH_REPLACEMENT.transparent);
      expect(back.opaque).toBe(REPLACEMENT);
    });
  });
  describe('crossSerialize', () => {
    it('supports OpaqueReference', () => {
      const result = crossSerialize(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports OpaqueReference with replacement', () => {
      const result = crossSerialize(EXAMPLE_WITH_REPLACEMENT);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports OpaqueReference', () => {
        const result = crossSerialize(EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports OpaqueReference with replacement', () => {
        const result = crossSerialize(EXAMPLE_WITH_REPLACEMENT);
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports OpaqueReference', async () => {
      const result = await crossSerializeAsync(EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports OpaqueReference with replacement', async () => {
      const result = await crossSerializeAsync(EXAMPLE_WITH_REPLACEMENT);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports OpaqueReference', async () => {
        const result = await crossSerializeAsync(EXAMPLE, {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
      it('supports OpaqueReference with replacement', async () => {
        const result = await crossSerializeAsync(EXAMPLE_WITH_REPLACEMENT, {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports OpaqueReference', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(EXAMPLE, {
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
    it('supports OpaqueReference with replacement', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(EXAMPLE_WITH_REPLACEMENT, {
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
      it('supports OpaqueReference', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(EXAMPLE, {
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
      it('supports OpaqueReference with replacement', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(EXAMPLE_WITH_REPLACEMENT, {
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
    it('supports OpaqueReference', () => {
      const result = toCrossJSON(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE.transparent);
      expect(back.opaque).toBe(undefined);
    });
    it('supports OpaqueReference with replacement', () => {
      const result = toCrossJSON(EXAMPLE_WITH_REPLACEMENT);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE_WITH_REPLACEMENT>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE_WITH_REPLACEMENT.transparent);
      expect(back.opaque).toBe(REPLACEMENT);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports OpaqueReference', async () => {
      const result = await toCrossJSONAsync(EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE.transparent);
      expect(back.opaque).toBe(undefined);
    });
    it('supports OpaqueReference with replacement', async () => {
      const result = await toCrossJSONAsync(EXAMPLE_WITH_REPLACEMENT);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof EXAMPLE_WITH_REPLACEMENT>(result, {
        refs: new Map(),
      });

      expect(back.constructor).toBe(Object);
      expect(back.transparent).toBe(EXAMPLE_WITH_REPLACEMENT.transparent);
      expect(back.opaque).toBe(REPLACEMENT);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports OpaqueReference', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(EXAMPLE, {
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
    it('supports OpaqueReference with replacement', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(EXAMPLE_WITH_REPLACEMENT, {
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
