import { describe, expect, it, vi } from 'vitest';
import { Serializer, crossSerializeStream, toCrossJSONStream } from '../src';

async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function countUnhandled(run: () => void): Promise<number> {
  const onUnhandled = vi.fn();
  process.on('unhandledRejection', onUnhandled);
  try {
    run();
    await settle();
    return onUnhandled.mock.calls.length;
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

// Deeper than the depth limit below, so the late parse fails.
function nest(depth: number): unknown {
  let value: unknown = {};
  for (let i = 0; i < depth; i++) {
    value = { a: value };
  }
  return value;
}

async function* yieldDeep(): AsyncGenerator<unknown> {
  await Promise.resolve();
  yield nest(20);
}

// JavaScript callers can leave out onError. A failure after the first
// synchronous step must not escape as an unhandled rejection.
describe('stream parse without onError', () => {
  it('crossSerializeStream contains a late promise failure', async () => {
    const count = await countUnhandled(() => {
      crossSerializeStream(
        { p: Promise.resolve(nest(20)) },
        { scopeId: 'x', depthLimit: 5, onSerialize: () => undefined },
      );
    });
    expect(count).toBe(0);
  });

  it('toCrossJSONStream contains a late async iterable failure', async () => {
    const count = await countUnhandled(() => {
      toCrossJSONStream(yieldDeep(), { depthLimit: 5, onParse: () => undefined });
    });
    expect(count).toBe(0);
  });

  it('Serializer.write contains a late promise failure', async () => {
    const count = await countUnhandled(() => {
      // oxlint-disable-next-line typescript/no-unsafe-assignment -- constructs without the required onError.
      const writer: Serializer = Reflect.construct(Serializer, [
        { globalIdentifier: 'X', depthLimit: 5, onData: () => undefined },
      ]);
      writer.write('late', Promise.resolve(nest(20)));
    });
    expect(count).toBe(0);
  });

  it('still throws a failure in the first synchronous step', () => {
    expect(() => {
      crossSerializeStream(nest(20), {
        scopeId: 'x',
        depthLimit: 5,
        onSerialize: () => undefined,
      });
    }).toThrow();
  });
});
