import type { CrossSerializeStreamOptions, ToCrossJSONStreamOptions } from 'seroval/write';
import { crossSerializeStream, getCrossReferenceHeader, toCrossJSONStream } from 'seroval/write';
import { encodeFrame } from './frame';

/** The default `highWaterMark`, in bytes. */
const DEFAULT_HIGH_WATER_MARK = 64 * 1024;

export interface FrameStreamOptions {
  /**
   * How many bytes the stream buffers before seroval holds back the next
   * frame. Defaults to 64KiB.
   */
  highWaterMark?: number;
}

export interface ToJSONStreamOptions
  extends Omit<ToCrossJSONStreamOptions, 'onParse' | 'onDone' | 'onError'>, FrameStreamOptions {}

export interface ToJSStreamOptions
  extends
    Omit<CrossSerializeStreamOptions, 'onSerialize' | 'onDone' | 'onError' | 'scopeId'>,
    FrameStreamOptions {
  /**
   * The key of `$R` that holds the references of this stream. The reader
   * must use the same one.
   */
  scopeId: string;
}

type StartStream = (
  write: (data: string) => void | PromiseLike<void>,
  close: () => void,
  fail: (error: unknown) => void,
) => () => void;

/**
 * Writes each chunk as one frame. When the queue is full, `write` returns a
 * promise that settles on the next pull, so seroval holds back the next chunk
 * and a slow reader slows down the source. Cancelling the stream stops
 * seroval, which cancels every source that is still running.
 */
function createFrameStream(
  start: StartStream,
  highWaterMark = DEFAULT_HIGH_WATER_MARK,
): ReadableStream<Uint8Array> {
  let stop: (() => void) | undefined;
  let resume: (() => void) | undefined;
  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        stop = start(
          (data) => {
            const [header, encoded] = encodeFrame(data);
            controller.enqueue(header);
            controller.enqueue(encoded);
            if ((controller.desiredSize ?? 1) <= 0) {
              return new Promise<void>((resolve) => {
                resume = resolve;
              });
            }
            return undefined;
          },
          () => controller.close(),
          (error) => controller.error(error),
        );
      },
      pull() {
        const current = resume;
        resume = undefined;
        current?.();
      },
      cancel() {
        resume = undefined;
        stop?.();
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark }),
  );
}

/**
 * Serializes `value` to a stream of cross-reference JSON frames. Read it with
 * `fromJSONStream`.
 */
export function toJSONStream<T>(
  value: T,
  options: ToJSONStreamOptions = {},
): ReadableStream<Uint8Array> {
  const { highWaterMark, ...rest } = options;
  return createFrameStream(
    (write, close, fail) =>
      toCrossJSONStream(value, {
        ...rest,
        onParse: (node) => write(JSON.stringify(node)),
        onDone: close,
        onError: fail,
      }),
    highWaterMark,
  );
}

/**
 * Serializes `value` to a stream of JavaScript frames. The first frame
 * declares `$R[scopeId]`. Read it with `fromJSStream`, which runs each frame
 * with `eval`, so only use it when the reader trusts the writer.
 */
export function toJSStream<T>(
  value: T,
  options: ToJSStreamOptions,
): ReadableStream<Uint8Array> {
  const { highWaterMark, ...rest } = options;
  const header = getCrossReferenceHeader(rest.scopeId);
  return createFrameStream(
    (write, close, fail) =>
      crossSerializeStream(value, {
        ...rest,
        // The initial chunk is an expression that evaluates to the value.
        onSerialize: (data, initial) => write(initial ? `(${header},${data})` : data),
        onDone: close,
        onError: fail,
      }),
    highWaterMark,
  );
}
