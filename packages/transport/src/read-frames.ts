import type { FrameDecoderOptions } from './frame';
import { createFrameDecoder } from './frame';
import type { Reader } from './read';

export interface ReadFramesOptions extends Pick<FrameDecoderOptions, 'maxFrameSize'> {
  /** Stops reading, and ends the reader with the abort reason. */
  signal?: AbortSignal;
  /**
   * Receives an error of the stream, such as a malformed frame or a dropped
   * connection. The reader also ends with it.
   */
  onError?: (error: unknown) => void;
}

/** A byte stream, as `readFrames` needs it. */
export interface ChunkSource {
  /** Returns the next chunk, or `undefined` at the end. */
  read(): Promise<Uint8Array | undefined>;
  /** Stops the stream and releases it. */
  cancel(reason: unknown): void | PromiseLike<void>;
}

/**
 * Ends `reader` with `reason`, and reports it when `report` is set. A stream
 * listener that throws while its value fails is always reported, since
 * nothing awaits the reader's errors.
 */
export function endReader(
  reader: Pick<Reader, 'end'>,
  reason: unknown,
  report: boolean,
  options: Pick<ReadFramesOptions, 'onError'>,
): void {
  try {
    reader.end(reason);
  } catch (error) {
    options.onError?.(error);
  }
  if (report) {
    options.onError?.(reason);
  }
}

async function cancelSource(source: ChunkSource, reason: unknown): Promise<void> {
  try {
    await source.cancel(reason);
  } catch {
    // The stream failed while it stopped. The reader already ends.
  }
}

/**
 * Reads the frames of `source` into `reader`, and ends the reader when the
 * source ends. Settles when it stops, and never rejects.
 */
export async function readFrames(
  source: ChunkSource,
  reader: Pick<Reader, 'push' | 'end'>,
  options: ReadFramesOptions,
): Promise<void> {
  const signal = options.signal;
  let stopped = false;
  const frames = createFrameDecoder({
    maxFrameSize: options.maxFrameSize,
    onMessage(message) {
      // A message can abort the signal while the rest of the chunk waits.
      if (!stopped) {
        reader.push(message);
      }
    },
  });

  // Ends the reader once.
  function stop(reason: unknown, report: boolean): void {
    if (stopped) {
      return;
    }
    stopped = true;
    signal?.removeEventListener('abort', onAbort);
    endReader(reader, reason, report, options);
  }

  function onAbort(): void {
    void cancelSource(source, signal?.reason);
    stop(signal?.reason, false);
  }

  if (signal?.aborted) {
    onAbort();
    return;
  }
  signal?.addEventListener('abort', onAbort);

  // Decode each chunk until the source ends, the signal aborts or a frame is
  // malformed.
  try {
    while (!stopped) {
      const chunk = await source.read();
      if (chunk === undefined) {
        frames.end();
        break;
      }
      // The signal can abort while the chunk is read.
      if (!stopped) {
        frames.push(chunk);
      }
    }
    stop(undefined, false);
  } catch (error) {
    if (!stopped) {
      await cancelSource(source, error);
      stop(error, true);
    }
  }
}
