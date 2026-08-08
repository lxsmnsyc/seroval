import { describe, expect, it } from 'vitest';
import AbortSignalPlugin from '../../../web/abort-signal';
import { roundtrip, startDeserialize, startSerialize } from './utils';

const PLUGINS = [AbortSignalPlugin];

describe('binary AbortSignal', () => {
  it('supports an already aborted signal', async () => {
    const { value } = await roundtrip<AbortSignal>(
      AbortSignal.abort('reason'),
      PLUGINS,
    );
    expect(value).toBeInstanceOf(AbortSignal);
    expect(value.aborted).toBe(true);
    expect(value.reason).toBe('reason');
  });

  it('supports a structured abort reason', async () => {
    const { value } = await roundtrip<AbortSignal>(
      AbortSignal.abort(new DOMException('cancelled', 'AbortError')),
      PLUGINS,
    );
    expect(value.aborted).toBe(true);
    // Without DOMExceptionPlugin the reason degrades to a plain Error.
    expect((value.reason as Error).message).toBe('cancelled');
  });

  it('aborts a live signal when the source aborts', async () => {
    const controller = new AbortController();
    const handle = startSerialize(controller.signal, PLUGINS);
    const result = await startDeserialize<AbortSignal>(
      handle.transport,
      PLUGINS,
    );

    expect(result.value).toBeInstanceOf(AbortSignal);
    expect(result.value.aborted).toBe(false);

    controller.abort('later');
    await handle.done;
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(result.value.aborted).toBe(true);
    expect(result.value.reason).toBe('later');
  });

  it('fires the abort event on the deserialized signal', async () => {
    const controller = new AbortController();
    const handle = startSerialize(controller.signal, PLUGINS);
    const result = await startDeserialize<AbortSignal>(
      handle.transport,
      PLUGINS,
    );

    const fired = new Promise<void>(resolve => {
      result.value.addEventListener('abort', () => resolve(), { once: true });
    });

    controller.abort('go');
    await fired;
    expect(result.value.reason).toBe('go');
  });

  it('keeps the serialization open while the signal is live', async () => {
    const controller = new AbortController();
    const handle = startSerialize(controller.signal, PLUGINS);

    let finished = false;
    void handle.done.then(() => {
      finished = true;
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(finished).toBe(false);

    controller.abort();
    await handle.done;
    expect(finished).toBe(true);
  });
});
