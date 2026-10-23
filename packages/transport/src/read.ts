import type { CrossDeserializerOptions, SerovalNode } from 'seroval/read';
import { createCrossDeserializer, deserialize, isStream } from 'seroval/read';
import { FrameReader, SerovalFrameError } from './frame';

/** The default `maxFrameSize`, in bytes. */
const DEFAULT_MAX_FRAME_SIZE = 64 * 1024 * 1024;

export interface FrameReaderOptions {
  /** Refuses any frame larger than this many bytes. Defaults to 64MiB. */
  maxFrameSize?: number;
  /** Stops reading and fails every value still waiting on a frame. */
  signal?: AbortSignal;
  /**
   * Receives an error from a frame after the first one, such as a malformed
   * frame or a dropped connection. The values waiting on later frames also
   * fail with this error.
   */
  onError?: (error: unknown) => void;
}

export interface FromJSONStreamOptions
  extends CrossDeserializerOptions, FrameReaderOptions {}

export interface FromJSStreamOptions extends FrameReaderOptions {
  /** The `scopeId` that the writer used. */
  scopeId: string;
}

// A pending promise that `releaseScope` rejects may have no reader.
const ignoreRejection = (): void => {};

function createEndError(): SerovalFrameError {
  return new SerovalFrameError('The stream ended before every value settled.');
}

/**
 * Reads the first frame, then reads the rest in the background. `release`
 * runs once when the rest is done or fails, and fails what is still waiting.
 */
async function readFrames<T>(
  stream: ReadableStream<Uint8Array>,
  options: FrameReaderOptions,
  interpret: (data: string) => unknown,
  release: (reason: unknown) => void,
): Promise<T> {
  const reader = new FrameReader(stream, options.maxFrameSize ?? DEFAULT_MAX_FRAME_SIZE);
  const signal = options.signal;
  let finished = false;

  function finish(error: unknown, report: boolean): void {
    if (finished) {
      return;
    }
    finished = true;
    signal?.removeEventListener('abort', onAbort);
    try {
      release(error);
    } catch (releaseError) {
      // A stream listener threw while the stream failed.
      error = releaseError;
      report = true;
    }
    if (report) {
      options.onError?.(error);
    }
  }

  function onAbort(): void {
    const reason = signal?.reason;
    void reader.cancel(reason);
    finish(reason, false);
  }

  async function fail(error: unknown): Promise<never> {
    await reader.cancel(error);
    finish(error, false);
    throw error;
  }

  if (signal) {
    if (signal.aborted) {
      return fail(signal.reason);
    }
    signal.addEventListener('abort', onAbort);
  }

  let value: T;
  try {
    const data = await reader.next();
    if (data === undefined) {
      throw new SerovalFrameError('The stream ended before the first frame.');
    }
    value = interpret(data) as T;
  } catch (error) {
    if (finished) {
      throw signal?.reason ?? error;
    }
    return fail(error);
  }

  void (async () => {
    try {
      let data: string | undefined;
      while (!finished && (data = await reader.next()) !== undefined) {
        interpret(data);
      }
      finish(createEndError(), false);
    } catch (error) {
      if (!finished) {
        await reader.cancel(error);
        finish(error, true);
      }
    }
  })();

  return value;
}

/**
 * Decodes a stream from `toJSONStream`. Resolves with the value once the
 * first frame arrives. Later frames settle the promises and streams in it.
 */
export function fromJSONStream<T>(
  stream: ReadableStream<Uint8Array>,
  options: FromJSONStreamOptions = {},
): Promise<T> {
  const { maxFrameSize, signal, onError, ...rest } = options;
  const session = createCrossDeserializer(rest);
  return readFrames<T>(
    stream,
    options,
    (data) => session.deserialize(JSON.parse(data) as SerovalNode),
    (reason) => {
      if (session.pending > 0) {
        session.abort(reason);
      }
    },
  );
}

/**
 * Fails every value in a `$R` scope that is still waiting on a frame. These
 * are the open streams and the pending promise resolvers (`{ p, s, f }`)
 * from seroval's constructors. Failing a settled promise or a closed stream
 * does nothing. A ref can be any value a plugin decoded, so each read is
 * guarded.
 */
function releaseScope(scopeId: string, reason: unknown): void {
  // The frames declare `$R` on `self`, which is `globalThis` in browsers and
  // workers.
  const scopes = (globalThis as { self?: { $R?: Record<string, unknown[] | undefined> } }).self
    ?.$R;
  const refs = scopes?.[scopeId];
  if (!scopes || !refs) {
    return;
  }
  delete scopes[scopeId];
  let listenerError: unknown;
  for (const value of refs) {
    if (value === null || typeof value !== 'object') {
      continue;
    }
    try {
      const ref = value as Record<string, unknown>;
      if (isStream(ref) || ref.__SEROVAL_STREAM__ === true) {
        (ref as { throw(value: unknown): void }).throw(reason);
      } else if (
        typeof ref.s === 'function' &&
        typeof ref.f === 'function' &&
        ref.p instanceof Promise
      ) {
        ref.p.catch(ignoreRejection);
        ref.f(reason);
      }
    } catch (error) {
      listenerError ??= error;
    }
  }
  if (listenerError !== undefined) {
    throw listenerError;
  }
}

/**
 * Decodes a stream from `toJSStream`. Each frame runs with `eval`, so only
 * read streams from a writer you trust. Resolves with the value once the
 * first frame arrives.
 */
export function fromJSStream<T>(
  stream: ReadableStream<Uint8Array>,
  options: FromJSStreamOptions,
): Promise<T> {
  const scopeId = options.scopeId;
  return readFrames<T>(stream, options, deserialize, (reason) => releaseScope(scopeId, reason));
}
