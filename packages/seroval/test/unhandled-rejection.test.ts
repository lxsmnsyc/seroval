import { describe, expect, it, vi } from 'vitest';
import { fromCrossJSON, fromJSON, toCrossJSONAsync, toJSONAsync } from '../src';

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
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

// A payload can hold a rejected promise in a field the caller never reads.
// Deserializing it must not cause an unhandled rejection.
describe('rejected promises nobody reads', () => {
  it('fromJSON does not cause an unhandled rejection', async () => {
    const json = await toJSONAsync({ ignored: Promise.reject(new Error('ignored')) });
    expect(await countUnhandled(() => fromJSON(json))).toBe(0);
  });

  it('fromCrossJSON does not cause an unhandled rejection', async () => {
    const json = await toCrossJSONAsync(
      { ignored: Promise.reject(new Error('ignored')) },
      { refs: new Map() },
    );
    expect(await countUnhandled(() => fromCrossJSON(json, { refs: new Map() }))).toBe(0);
  });

  it('fromJSON does not cause an unhandled rejection for a crafted node', async () => {
    const json = {
      t: { t: 12, i: 0, s: 0, f: { t: 1, s: 'x' } },
      f: 127,
      m: [],
    };
    expect(await countUnhandled(() => fromJSON(json as never))).toBe(0);
  });

  it('still rejects for code that awaits the promise', async () => {
    const json = await toJSONAsync({ failed: Promise.reject(new Error('failed')) });
    const result = fromJSON<{ failed: Promise<unknown> }>(json);
    await expect(result.failed).rejects.toThrowError('failed');
  });
});
