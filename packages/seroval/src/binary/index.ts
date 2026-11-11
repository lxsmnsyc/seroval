/**
 * Binary mode: a compact, streamable wire format that (de)serializes values as
 * `Uint8Array` chunks instead of JavaScript strings or JSON trees. Exported
 * from `seroval/binary` ({@link serialize}, {@link deserialize}).
 *
 * @module
 */
import { SerovalAbortedError, SerovalMalformedBinarySourceError } from '../core/errors';
import { resolvePlugins } from '../core/plugin';
import {
  type DeserializeResult,
  type DeserializerContext,
  type DeserializerContextOptions,
  abortDeserialize,
  countPending,
  createDeserializerContext,
  createReferenceMap,
  deserializeStart,
  getDeserializeResult,
  pumpDeserialize,
  pushDeserializeChunk,
} from './deserializer';
import {
  createSerializerContext,
  endSerialize,
  type SerializerContextOptions,
  startSerialize,
} from './serializer';

export type SerializeOptions = SerializerContextOptions;

/**
 * Serializes a value into the binary format, emitting `Uint8Array` chunks
 * through `onSerialize` as they are produced and calling `onDone` once every
 * value - including async ones like `Promise` and `ReadableStream` - has
 * settled. The binary format is a compact, streamable alternative to the string
 * output of the tree API and is decoded with {@link deserialize}.
 *
 * @returns A function that aborts serialization and releases its resources.
 */
export function serialize(value: unknown, options: SerializeOptions) {
  const plugins = resolvePlugins(options.plugins);
  const context = createSerializerContext({
    ...options,
    plugins,
  });
  startSerialize(context, value);
  return endSerialize.bind(null, context);
}

export type DeserializeOptions = DeserializerContextOptions;

/**
 * Decodes a binary payload produced by {@link serialize}, pulling chunks from
 * `read` (which resolves to `undefined` at end of stream) and building the
 * value without ever evaluating code. The returned promise resolves as soon as
 * the root value is available - which, for a streamed value, can be before its
 * nested Promises and streams have finished settling.
 *
 * @returns A promise for `{ value }`, the decoded value.
 */
export async function deserialize<T>(options: DeserializeOptions): Promise<DeserializeResult<T>> {
  const plugins = resolvePlugins(options.plugins);
  const context = createDeserializerContext({
    ...options,
    plugins,
  });
  return await deserializeStart<T>(context);
}

export interface DeserializerOptions extends Omit<
  DeserializeOptions,
  'read' | 'onError' | 'refs' | 'signal'
> {
  /**
   * Receives an error that stopped a payload after `push` or `end` returned,
   * such as a plugin whose `deserialize` failed. The payload is aborted with
   * it. Errors while `push` or `end` runs are thrown instead.
   */
  onError?: (error: unknown) => void;
}

export interface DeserializerPayloadOptions {
  /**
   * Receives an error that stopped this payload after `push` or `end`
   * returned. Runs instead of the session's `onError`.
   */
  onError?: (error: unknown) => void;
}

/** One payload of a {@link Deserializer}, which takes its bytes as they arrive. */
export interface DeserializerPayload<T> {
  /**
   * Decodes every node that `chunk` completes. Throws when the bytes are
   * malformed, and aborts the payload with the error. Does nothing once the
   * payload is aborted.
   */
  push(chunk: Uint8Array): void;
  /**
   * Ends the payload. Throws when it is incomplete, and aborts the payload
   * with the error.
   */
  end(): void;
  /**
   * Rejects the root value if it is not decoded yet, and every promise and
   * stream of the payload that has not settled or ended. Idempotent.
   */
  abort(reason: unknown): void;
  /**
   * Resolves as soon as the root value is decoded, as {@link deserialize}
   * does. Rejects when the payload is aborted first.
   */
  readonly result: Promise<DeserializeResult<T>>;
  /** Promises and streams of the payload that have not settled or ended yet. */
  readonly pending: number;
}

/** A session of payloads that share references, from {@link createDeserializer}. */
export interface Deserializer {
  /** Starts a payload. Throws a `SerovalAbortedError` once the session aborted. */
  open<T>(options?: DeserializerPayloadOptions): DeserializerPayload<T>;
  /** Promises and streams of every payload that have not settled or ended yet. */
  readonly pending: number;
  /** Aborts every payload. Later calls to `open` throw. Idempotent. */
  abort(reason: unknown): void;
}

// Pull mode reads through `read`. A payload of a session takes its bytes
// through `push`, so this never runs.
function readNothing(): Promise<undefined> {
  return Promise.resolve(undefined);
}

function createPayload<T>(
  ctx: DeserializerContext,
  report: ((error: unknown) => void) | undefined,
  // Runs once the payload ended or aborted.
  onClose: () => void,
): DeserializerPayload<T> {
  // The first error while `push` or `end` runs, which they throw.
  let failure: { error: unknown } | undefined;
  let running = false;

  ctx.onError = (error) => {
    if (ctx.aborted) {
      return;
    }
    abortDeserialize(ctx, error);
    onClose();
    if (running) {
      failure ??= { error };
    } else {
      report?.(error);
    }
  };

  function run(chunk: Uint8Array | undefined): void {
    if (ctx.aborted) {
      return;
    }
    pushDeserializeChunk(ctx, chunk);
    running = true;
    try {
      pumpDeserialize(ctx);
    } catch (error) {
      ctx.onError(error);
    } finally {
      running = false;
    }
    if (failure) {
      const error = failure.error;
      failure = undefined;
      throw error;
    }
  }

  const result = getDeserializeResult<T>(ctx);
  // A payload that nobody reads can be aborted, and must not cause an
  // unhandled rejection. Code that awaits it still gets the rejection.
  result.catch(() => {});

  return {
    push(chunk) {
      // Bytes after the end are malformed, like bytes past the last node.
      if (ctx.done && !ctx.aborted) {
        const error = new SerovalMalformedBinarySourceError();
        abortDeserialize(ctx, error);
        onClose();
        throw error;
      }
      run(chunk);
    },
    end() {
      if (!ctx.done) {
        run(undefined);
        onClose();
      }
    },
    abort(reason) {
      if (!ctx.aborted) {
        abortDeserialize(ctx, reason);
        onClose();
      }
    },
    result,
    get pending() {
      return countPending(ctx);
    },
  };
}

/**
 * Creates a session that decodes many payloads from {@link serialize} with
 * one set of references, as `createCrossDeserializer` does for JSON. Each
 * payload takes its bytes through `push`, which decodes them before it
 * returns. A payload can refer to the values of payloads whose bytes were
 * pushed before, even while those are still open. Serialize the payloads
 * with one `refs` map, and push their bytes in the order they were produced.
 */
export function createDeserializer(options: DeserializerOptions = {}): Deserializer {
  const plugins = resolvePlugins(options.plugins);
  const refs = createReferenceMap();
  // Payloads that can still hold pending values.
  const payloads = new Set<DeserializerContext>();
  let aborted = false;

  // A closed payload takes no more nodes. Once it has nothing pending, it
  // never will again.
  function prune(ctx: DeserializerContext): void {
    if ((ctx.done || ctx.aborted) && countPending(ctx) === 0) {
      payloads.delete(ctx);
    }
  }

  return {
    open<T>(payloadOptions: DeserializerPayloadOptions = {}) {
      if (aborted) {
        throw new SerovalAbortedError();
      }
      const ctx = createDeserializerContext({
        ...options,
        plugins,
        refs,
        read: readNothing,
        // Replaced by `createPayload`.
        onError() {},
      });
      payloads.add(ctx);
      return createPayload<T>(ctx, payloadOptions.onError ?? options.onError, () => {
        prune(ctx);
      });
    },
    get pending() {
      let count = 0;
      for (const ctx of payloads) {
        prune(ctx);
        count += countPending(ctx);
      }
      return count;
    },
    abort(reason) {
      aborted = true;
      for (const ctx of payloads) {
        abortDeserialize(ctx, reason);
      }
      payloads.clear();
    },
  };
}

export { createReferenceMap };

export type { DeserializeResult, DeserializerContext, ReferenceMap } from './deserializer';
export type { SerializerContextOptions } from './serializer';
