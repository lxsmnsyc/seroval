import { describe, expect, it, vi } from 'vitest';
import {
  createPlugin,
  fromJSON,
  SerovalMalformedNodeError,
  toJSONAsync,
} from '../src';

// A promise must not settle with a thenable, or the thenable's `then` would be
// called. A function can carry `then` as well as an object can.
describe('promise thenable values', () => {
  it.each(['object', 'function'])(
    'rejects a promise resolved with a %s thenable',
    async kind => {
      const then = vi.fn();
      const thenablePlugin = createPlugin<unknown, Record<string, never>>({
        tag: 'test/thenable',
        test: () => false,
        parse: { sync: () => ({}) },
        serialize: () => '',
        deserialize: () =>
          (kind === 'function'
            ? Object.assign(() => undefined, { then })
            : { then }) as never,
      });
      const json = await toJSONAsync(Promise.resolve(1));
      (json.t as unknown as { f: unknown }).f = {
        t: 25,
        i: 1,
        c: 'test/thenable',
        s: {},
      };
      let caught: unknown;
      try {
        await fromJSON(json, { plugins: [thenablePlugin] });
      } catch (error) {
        caught = error;
      }
      expect((caught as { cause: unknown }).cause).toBeInstanceOf(
        SerovalMalformedNodeError,
      );
      expect(then).not.toHaveBeenCalled();
    },
  );
});
