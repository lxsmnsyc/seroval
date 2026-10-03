import { describe, expect, it } from 'vitest';
import AbortSignalPlugin from '../../../web/abort-signal';
import BlobPlugin from '../../../web/blob';
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

  it('supports a Blob abort reason', async () => {
    // The plugin branches on `'reason' in data`, so the payload has to be
    // materialized before it runs - otherwise it takes the live-controller
    // branch and throws on an undefined controller.
    const { value } = await roundtrip<AbortSignal>(
      AbortSignal.abort(new Blob(['why'])),
      [AbortSignalPlugin, BlobPlugin],
    );
    expect(value.aborted).toBe(true);
    expect(value.reason).toBeInstanceOf(Blob);
    expect(await (value.reason as Blob).text()).toBe('why');
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
