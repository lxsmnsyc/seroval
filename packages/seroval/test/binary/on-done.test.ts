import { describe, expect, it, vi } from 'vitest';
import * as binary from '../../src/binary';
import { startDeserialize, startSerialize } from './utils';

async function* numbers(): AsyncGenerator<number> {
  yield 1;
  await Promise.resolve();
  yield 2;
}

describe('binary deserializer onDone', () => {
  it('runs once the payload ended and every node was read', async () => {
    const onDone = vi.fn();
    const handle = startSerialize({ items: numbers(), later: Promise.resolve(1) });
    const result = await startDeserialize<{ later: Promise<number> }>(handle.transport, {
      onDone,
    });
    expect(onDone).not.toHaveBeenCalled();
    await handle.done;
    await vi.waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    await expect(result.value.later).resolves.toBe(1);
  });

  it('does not run when the payload is malformed', async () => {
    const onDone = vi.fn();
    const onError = vi.fn();
    const chunks = [new Uint8Array([0xff, 0xff]), undefined];
    const result = binary.deserialize({ read: async () => chunks.shift(), onDone, onError });
    await expect(result).rejects.toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('does not run when the payload is aborted', async () => {
    const onDone = vi.fn();
    const controller = new AbortController();
    const handle = startSerialize({ later: new Promise(() => {}) });
    const result = await startDeserialize(handle.transport, {
      onDone,
      signal: controller.signal,
    });
    expect(result.value).toBeDefined();
    controller.abort(new Error('stop'));
    handle.transport.push(undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onDone).not.toHaveBeenCalled();
    handle.abort();
  });
});
