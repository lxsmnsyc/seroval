import { Readable } from 'node:stream';
import { encodeFrame } from './frame';
import { SerovalTransportError } from './message';
import type { Reader } from './read';
import type { ReadFramesOptions } from './read-frames';
import { readFrames } from './read-frames';
import type { MessageSink, Writer } from './write';

export type { Message } from './message';
export { SerovalTransportError } from './message';

/** The default `highWaterMark`, in bytes. */
const DEFAULT_HIGH_WATER_MARK = 64 * 1024;

export interface NodeStreamOptions {
  /**
   * How many bytes the stream buffers before the writer holds back the next
   * message. Defaults to 64KiB.
   */
  highWaterMark?: number;
}

/**
 * Turns the messages of a writer into a Node `Readable` of frames, such as
 * the body of an HTTP response. `start` receives the sink to pass to the
 * writer. Destroying the stream closes the writer, which stops every source
 * that is still running. Read it with `fromNodeStream`.
 */
export function toNodeStream(
  start: (sink: Required<MessageSink>) => Pick<Writer, 'close'>,
  options: NodeStreamOptions = {},
): Readable {
  // Each value that waits for room holds back on its own promise.
  let waiting: (() => void)[] = [];
  let closed = false;
  let writer: Pick<Writer, 'close'> | undefined;

  const stream = new Readable({
    highWaterMark: options.highWaterMark ?? DEFAULT_HIGH_WATER_MARK,
    read() {
      const current = waiting;
      waiting = [];
      for (const resolve of current) {
        resolve();
      }
    },
    destroy(error, callback) {
      // Stop the sources when the stream stops early, such as when the
      // client disconnects.
      if (!closed) {
        closed = true;
        waiting = [];
        try {
          writer?.close(error ?? new SerovalTransportError('The stream was destroyed.'));
        } catch (closeError) {
          callback(error ?? (closeError as Error));
          return;
        }
      }
      callback(error);
    },
  });

  writer = start({
    send(message) {
      if (closed) {
        return undefined;
      }
      const [header, encoded] = encodeFrame(message);
      stream.push(header);
      // When the buffer is full, wait for the next read.
      if (!stream.push(encoded)) {
        return new Promise<void>((resolve) => {
          waiting.push(resolve);
        });
      }
      return undefined;
    },
    onDone() {
      if (!closed) {
        closed = true;
        stream.push(null);
      }
    },
  });
  return stream;
}

export interface FromNodeStreamOptions extends ReadFramesOptions {}

/**
 * Reads the frames of `toNodeStream` from `stream` into `reader`, such as the
 * body of an HTTP request, and ends the reader when the stream ends. Settles
 * when it stops, and never rejects.
 */
export function fromNodeStream(
  stream: Readable,
  reader: Pick<Reader, 'push' | 'end'>,
  options: FromNodeStreamOptions = {},
): Promise<void> {
  const chunks = stream[Symbol.asyncIterator]() as AsyncIterator<unknown>;
  return readFrames(
    {
      async read() {
        const result = await chunks.next();
        if (result.done) {
          return undefined;
        }
        if (!(result.value instanceof Uint8Array)) {
          throw new SerovalTransportError('The stream must carry bytes, not text or objects.');
        }
        return result.value;
      },
      cancel() {
        stream.destroy();
      },
    },
    reader,
    options,
  );
}
