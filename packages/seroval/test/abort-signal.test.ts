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

const delayedAbortSignal = () => {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort('aborted!');
  }, 100);
  return controller.signal;
};

const SYNC_EXAMPLE = AbortSignal.abort('aborted!');

describe('AbortSignal', () => {
  describe('serialize', () => {
    it('supports aborted AbortSignal', () => {
      const result = serialize(SYNC_EXAMPLE);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof SYNC_EXAMPLE>(result);
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = serialize(instance);
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof instance>(result);
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('serializeAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await serializeAsync(Promise.resolve(SYNC_EXAMPLE));
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof SYNC_EXAMPLE>>(result);
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await serializeAsync(instance);
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof instance>>(result);
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toJSON', () => {
    it('supports aborted AbortSignal', () => {
      const result = toJSON(SYNC_EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof SYNC_EXAMPLE>(result);
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = toJSON(instance);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof instance>(result);
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toJSONAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await toJSONAsync(Promise.resolve(SYNC_EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof SYNC_EXAMPLE>>(result);
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await toJSONAsync(instance);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof instance>(result);
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });

  describe('crossSerialize', () => {
    it('supports aborted AbortSignal', () => {
      const result = crossSerialize(SYNC_EXAMPLE);
      expect(result).toMatchSnapshot();
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = crossSerialize(instance);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports aborted AbortSignal', () => {
        const result = crossSerialize(SYNC_EXAMPLE, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
      it('supports future AbortSignal', () => {
        const instance = delayedAbortSignal();
        const result = crossSerialize(instance, { scopeId: 'example' });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await crossSerializeAsync(Promise.resolve(SYNC_EXAMPLE));
      expect(result).toMatchSnapshot();
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await crossSerializeAsync(instance);
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports aborted AbortSignal', async () => {
        const result = await crossSerializeAsync(
          Promise.resolve(SYNC_EXAMPLE),
          {
            scopeId: 'example',
          },
        );
        expect(result).toMatchSnapshot();
      });
      it('supports future AbortSignal', async () => {
        const instance = delayedAbortSignal();
        const result = await crossSerializeAsync(instance, {
          scopeId: 'example',
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports aborted AbortSignal', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(SYNC_EXAMPLE), {
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
    it('supports future AbortSignal', async () =>
      new Promise<void>((resolve, reject) => {
        const instance = delayedAbortSignal();
        crossSerializeStream(instance, {
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
      it('supports aborted AbortSignal', async () =>
        new Promise<void>((resolve, reject) => {
          crossSerializeStream(Promise.resolve(SYNC_EXAMPLE), {
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
      it('supports future AbortSignal', async () =>
        new Promise<void>((resolve, reject) => {
          const instance = delayedAbortSignal();
          crossSerializeStream(instance, {
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
    it('supports aborted AbortSignal', () => {
      const result = toCrossJSON(SYNC_EXAMPLE);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof SYNC_EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = toCrossJSON(instance);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof instance>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(SYNC_EXAMPLE));
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof SYNC_EXAMPLE>>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await toCrossJSONAsync(instance);
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof SYNC_EXAMPLE>(result, {
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports aborted AbortSignal', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(SYNC_EXAMPLE), {
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
    it('supports future AbortSignal', async () =>
      new Promise<void>((resolve, reject) => {
        const instance = delayedAbortSignal();
        toCrossJSONStream(instance, {
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
