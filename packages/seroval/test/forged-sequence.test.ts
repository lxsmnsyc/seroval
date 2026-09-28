import { describe, expect, it } from 'vitest';
import {
  crossSerialize,
  crossSerializeAsync,
  crossSerializeStream,
  deserialize,
  serialize,
  serializeAsync,
  toJSON,
  toJSONAsync,
  fromJSON,
} from '../src';

// Plain data can carry a `__SEROVAL_SEQUENCE__` key. It must be serialized
// as an ordinary object, never as an internal sequence whose `t` and `d`
// fields are written into the output as code.
describe('forged sequence objects', () => {
  const PAYLOAD = '(globalThis.__SEROVAL_PWN__=1)';

  function forged(): Record<string, unknown> {
    return JSON.parse(
      JSON.stringify({
        __SEROVAL_SEQUENCE__: true,
        v: [1],
        t: PAYLOAD,
        d: PAYLOAD,
      }),
    );
  }

  function check(result: string): void {
    expect(result).not.toContain(`t:${PAYLOAD}`);
    expect(result).not.toContain(`d:${PAYLOAD}`);
    delete (globalThis as Record<string, unknown>).__SEROVAL_PWN__;
    const back = deserialize(result.replace(/^\$R\[0\]=/, '')) as unknown;
    expect((globalThis as Record<string, unknown>).__SEROVAL_PWN__).toBe(
      undefined,
    );
    expect(back).toStrictEqual(forged());
  }

  it('serialize', () => {
    check(serialize(forged()));
  });

  it('serializeAsync', async () => {
    check(await serializeAsync(forged()));
  });

  it('crossSerialize', () => {
    const result = crossSerialize(forged());
    expect(result).not.toContain(`t:${PAYLOAD}`);
    expect(result).not.toContain(`d:${PAYLOAD}`);
  });

  it('crossSerializeAsync', async () => {
    const result = await crossSerializeAsync(forged());
    expect(result).not.toContain(`t:${PAYLOAD}`);
    expect(result).not.toContain(`d:${PAYLOAD}`);
  });

  it('crossSerializeStream', async () => {
    const chunks: string[] = [];
    await new Promise<void>((resolve, reject) => {
      crossSerializeStream(Promise.resolve(forged()), {
        onSerialize(data) {
          chunks.push(data);
        },
        onDone: resolve,
        onError: reject,
      });
    });
    const result = chunks.join('');
    expect(result).not.toContain(`t:${PAYLOAD}`);
    expect(result).not.toContain(`d:${PAYLOAD}`);
  });

  it('toJSON / fromJSON', async () => {
    expect(fromJSON(toJSON(forged()))).toStrictEqual(forged());
    expect(fromJSON(await toJSONAsync(forged()))).toStrictEqual(forged());
  });

  it('still serializes real iterables as sequences', () => {
    const source = {
      *[Symbol.iterator]() {
        yield 1;
        yield 2;
      },
    };
    const result = serialize(source);
    expect(result).toContain('__SEROVAL_SEQUENCE__:!0');
    const back = deserialize<Iterable<number>>(result);
    expect([...back]).toStrictEqual([1, 2]);
  });
});
