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
} from 'seroval';
import { createReference, type SerovalNode } from 'seroval';
import { describe, expect, it, vi } from 'vitest';
import { AbortSignalPlugin } from '../../web';

const delayedAbortSignal = () => {
  const controller = new AbortController();
  setTimeout(() => {
    controller.abort('aborted!');
  });
  return controller.signal;
};

const SYNC_EXAMPLE = AbortSignal.abort('aborted!');

describe('AbortSignal', () => {
  describe('serialize', () => {
    it('supports aborted AbortSignal', () => {
      const result = serialize(SYNC_EXAMPLE, {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof SYNC_EXAMPLE>(result);
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = serialize(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = deserialize<typeof instance>(result);
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('serializeAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await serializeAsync(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof SYNC_EXAMPLE>>(result);
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await serializeAsync(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
      const back = await deserialize<Promise<typeof instance>>(result);
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toJSON', () => {
    it('supports aborted AbortSignal', () => {
      const result = toJSON(SYNC_EXAMPLE, {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof SYNC_EXAMPLE>(result, {
        plugins: [AbortSignalPlugin],
      });
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = toJSON(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof instance>(result, {
        plugins: [AbortSignalPlugin],
      });
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toJSONAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await toJSONAsync(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromJSON<Promise<typeof SYNC_EXAMPLE>>(result, {
        plugins: [AbortSignalPlugin],
      });
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await toJSONAsync(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromJSON<typeof instance>(result, {
        plugins: [AbortSignalPlugin],
      });
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });

  describe('crossSerialize', () => {
    it('supports aborted AbortSignal', () => {
      const result = crossSerialize(SYNC_EXAMPLE, {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = crossSerialize(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports aborted AbortSignal', () => {
        const result = crossSerialize(SYNC_EXAMPLE, {
          scopeId: 'example',
          plugins: [AbortSignalPlugin],
        });
        expect(result).toMatchSnapshot();
      });
      it('supports future AbortSignal', () => {
        const instance = delayedAbortSignal();
        const result = crossSerialize(instance, {
          scopeId: 'example',
          plugins: [AbortSignalPlugin],
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await crossSerializeAsync(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await crossSerializeAsync(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(result).toMatchSnapshot();
    });
    describe('scoped', () => {
      it('supports aborted AbortSignal', async () => {
        const result = await crossSerializeAsync(
          Promise.resolve(SYNC_EXAMPLE),
          {
            scopeId: 'example',
            plugins: [AbortSignalPlugin],
          },
        );
        expect(result).toMatchSnapshot();
      });
      it('supports future AbortSignal', async () => {
        const instance = delayedAbortSignal();
        const result = await crossSerializeAsync(instance, {
          scopeId: 'example',
          plugins: [AbortSignalPlugin],
        });
        expect(result).toMatchSnapshot();
      });
    });
  });
  describe('crossSerializeStream', () => {
    it('supports aborted AbortSignal', async () =>
      new Promise<void>((resolve, reject) => {
        crossSerializeStream(Promise.resolve(SYNC_EXAMPLE), {
          plugins: [AbortSignalPlugin],
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
          plugins: [AbortSignalPlugin],
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
            plugins: [AbortSignalPlugin],
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
            plugins: [AbortSignalPlugin],
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
      const result = toCrossJSON(SYNC_EXAMPLE, {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof SYNC_EXAMPLE>(result, {
        plugins: [AbortSignalPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', () => {
      const instance = delayedAbortSignal();
      const result = toCrossJSON(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof instance>(result, {
        plugins: [AbortSignalPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toCrossJSONAsync', () => {
    it('supports aborted AbortSignal', async () => {
      const result = await toCrossJSONAsync(Promise.resolve(SYNC_EXAMPLE), {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = await fromCrossJSON<Promise<typeof SYNC_EXAMPLE>>(result, {
        refs: new Map(),
        plugins: [AbortSignalPlugin],
      });
      expect(back).toBeInstanceOf(AbortSignal);
      expect(back.reason).toBe(SYNC_EXAMPLE.reason);
    });
    it('supports future AbortSignal', async () => {
      const instance = delayedAbortSignal();
      const result = await toCrossJSONAsync(instance, {
        plugins: [AbortSignalPlugin],
      });
      expect(JSON.stringify(result)).toMatchSnapshot();
      const back = fromCrossJSON<typeof SYNC_EXAMPLE>(result, {
        plugins: [AbortSignalPlugin],
        refs: new Map(),
      });
      expect(back).toBeInstanceOf(AbortSignal);
    });
  });
  describe('toCrossJSONStream', () => {
    it('supports aborted AbortSignal', async () =>
      new Promise<void>((resolve, reject) => {
        toCrossJSONStream(Promise.resolve(SYNC_EXAMPLE), {
          plugins: [AbortSignalPlugin],
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
          plugins: [AbortSignalPlugin],
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
  describe('malformed input', () => {
    it('rejects a controller source that is not a Promise', () => {
      const result = toJSON(SYNC_EXAMPLE, {
        plugins: [AbortSignalPlugin],
      });
      // Aim the controller slot at a non-Promise node so the guard trips before
      // `then` would be called.
      (result.t as unknown as { s: Record<string, SerovalNode> }).s = {
        controller: toJSON(42).t,
      };
      expect(() =>
        fromJSON(result, { plugins: [AbortSignalPlugin] }),
      ).toThrow();
    });

    it('never invokes `then` on a fake thenable controller', () => {
      // A callable `then` is only reachable through a registered reference (or
      // a function-returning plugin). Build one and aim the controller slot at
      // an object carrying it: the guard must reject before it is called.
      const thenSpy = vi.fn();
      const thenable = { then: createReference('test/abort-fake-then', thenSpy) };
      const template = toJSON(thenable);
      const result = toJSON(SYNC_EXAMPLE, {
        plugins: [AbortSignalPlugin],
      });
      (result.t as unknown as { s: Record<string, SerovalNode> }).s = {
        controller: template.t,
      };
      expect(() =>
        fromJSON(result, { plugins: [AbortSignalPlugin] }),
      ).toThrow();
      expect(thenSpy).not.toHaveBeenCalled();
    });

    it('rejects deserializing the AbortController factory directly', () => {
      // The factory is a serialize-only helper; deserializing it would hand
      // back the raw `PROMISE_TO_ABORT_SIGNAL` function as a callable gadget.
      const json = {
        t: {
          t: 25,
          i: 0,
          c: 'seroval-plugins/web/AbortControllerFactoryPlugin',
          s: {},
        },
        f: 0x7f,
        m: [] as number[],
      } as unknown as Parameters<typeof fromJSON>[0];
      expect(() =>
        fromJSON(json, { plugins: [AbortSignalPlugin] }),
      ).toThrow();
    });
  });
});
