import { describe, expect, it, vi } from 'vitest';
import { roundtrip } from './utils';

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function countUnhandled(run: () => Promise<unknown>): Promise<number> {
  const onUnhandled = vi.fn();
  process.on('unhandledRejection', onUnhandled);
  try {
    await run();
    await settle();
    return onUnhandled.mock.calls.length;
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
}

// A payload can hold a rejected promise in a field the caller never reads.
// Deserializing it must not cause an unhandled rejection.
describe('binary rejected promises nobody reads', () => {
  it('does not cause an unhandled rejection', async () => {
    const value = { ignored: Promise.reject(new Error('ignored')) };
    value.ignored.catch(() => {});
    expect(
      await countUnhandled(async () => {
        const result = await roundtrip(value);
        await result.done;
      }),
    ).toBe(0);
  });

  it('still rejects for code that awaits the promise', async () => {
    const value = { failed: Promise.reject(new Error('failed')) };
    value.failed.catch(() => {});
    const result = await roundtrip<{ failed: Promise<unknown> }>(value);
    await expect(result.value.failed).rejects.toThrowError('failed');
  });
});
