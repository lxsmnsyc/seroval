import { encodeFrame } from './frame';
import { SerovalTransportError } from './message';
import type { ReadFramesOptions } from './read-frames';
import { endReader, readFrames } from './read-frames';
import type { Reader } from './read';
import type { MessageSink, Writer } from './write';

export type { Message } from './message';
export { SerovalTransportError } from './message';

/** The default `highWaterMark`, in bytes. */
const DEFAULT_HIGH_WATER_MARK = 64 * 1024;

export interface WebStreamOptions {
  /**
   * How many bytes the stream buffers before the writer holds back the next
   * message. Defaults to 64KiB.
   */
  highWaterMark?: number;
}

/**
 * Turns the messages of a writer into a `ReadableStream` of frames, such as
 * a `fetch` or `Response` body. `start` receives the sink to pass to the
 * writer. Cancelling the stream closes the writer, which stops every source
 * that is still running. Read it with `fromWebStream`.
 */
export function toWebStream(
  start: (sink: Required<MessageSink>) => Pick<Writer, 'close'>,
  options: WebStreamOptions = {},
): ReadableStream<Uint8Array> {
  let writer: Pick<Writer, 'close'> | undefined;
  // Each value that waits for room holds back on its own promise.
  let waiting: (() => void)[] = [];
  let closed = false;
  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        writer = start({
          send(message) {
            if (closed) {
              return undefined;
            }
            const [header, encoded] = encodeFrame(message);
            controller.enqueue(header);
            controller.enqueue(encoded);
            // When the queue is full, wait for the next pull.
            if ((controller.desiredSize ?? 1) <= 0) {
              return new Promise<void>((resolve) => {
                waiting.push(resolve);
              });
            }
            return undefined;
          },
          onDone() {
            if (!closed) {
              closed = true;
              controller.close();
            }
          },
        });
      },
      pull() {
        const current = waiting;
        waiting = [];
        for (const resolve of current) {
          resolve();
        }
      },
      cancel(reason) {
        closed = true;
        waiting = [];
        writer?.close(reason);
      },
    },
    new ByteLengthQueuingStrategy({
      highWaterMark: options.highWaterMark ?? DEFAULT_HIGH_WATER_MARK,
    }),
  );
}

export interface FromWebStreamOptions extends ReadFramesOptions {}

/**
 * Reads the frames of `toWebStream` from `stream` into `reader`, and ends the
 * reader when the stream ends. Settles when it stops, and never rejects.
 */
export function fromWebStream(
  stream: ReadableStream<Uint8Array>,
  reader: Pick<Reader, 'push' | 'end'>,
  options: FromWebStreamOptions = {},
): Promise<void> {
  const source = stream.getReader();
  return readFrames(
    {
      async read() {
        const result = await source.read();
        return result.done ? undefined : result.value;
      },
      cancel(reason) {
        return source.cancel(reason);
      },
    },
    reader,
    options,
  );
}

export interface ToResponseOptions extends ResponseInit, WebStreamOptions {}

/**
 * Creates a `Response` whose body is the stream of `toWebStream`. The
 * `Content-Type` defaults to `application/octet-stream`. Read it with
 * `fromResponse`.
 */
export function toResponse(
  start: (sink: Required<MessageSink>) => Pick<Writer, 'close'>,
  options: ToResponseOptions = {},
): Response {
  const { highWaterMark, ...init } = options;
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/octet-stream');
  }
  return new Response(toWebStream(start, { highWaterMark }), { ...init, headers });
}

/**
 * Reads the body of `response` into `reader`, as `fromWebStream` does. A
 * response without a body, or with a status outside 200 to 299, ends the
 * reader with a `SerovalTransportError` and is reported to `onError`.
 * Settles when it stops, and never rejects.
 */
export async function fromResponse(
  response: Response,
  reader: Pick<Reader, 'push' | 'end'>,
  options: FromWebStreamOptions = {},
): Promise<void> {
  // Refuse the response before reading it, so an error page fails with its
  // status instead of a malformed frame.
  let error: SerovalTransportError | undefined;
  if (!response.ok) {
    error = new SerovalTransportError(`The response failed with status ${response.status}.`);
  } else if (!response.body) {
    error = new SerovalTransportError('The response has no body.');
  }
  if (!error) {
    return fromWebStream(response.body as ReadableStream<Uint8Array>, reader, options);
  }

  // Release the connection, then end the reader as `fromWebStream` would.
  await response.body?.cancel(error).catch(() => {});
  endReader(reader, error, true, options);
}
