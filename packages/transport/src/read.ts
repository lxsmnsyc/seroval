import type { CrossDeserializer, CrossDeserializerOptions, SerovalNode } from 'seroval/read';
import { createCrossDeserializer, deserialize, isStream } from 'seroval/read';
import type { Reader, ReaderOptions, ValueReader } from './create-reader';
import { createEndError, createReader, createValueReader, ignoreRejection } from './create-reader';

export type { Message } from './message';
export { SerovalTransportError } from './message';
export type { Reader, ReaderOptions, ValueReader } from './create-reader';

export interface JSONReaderOptions extends CrossDeserializerOptions, ReaderOptions {
  /** Shares one set of references across every value. Match the writer. */
  sharedRefs?: boolean;
}

export interface JSReaderOptions extends ReaderOptions {
  /** The `scopeId` that the writer used. */
  scopeId: string;
}

/**
 * Creates a reader of the messages of `createJSONWriter`. It never runs code
 * from the messages.
 */
export function createJSONReader(options: JSONReaderOptions = {}): Reader {
  const { sharedRefs, maxKeys, ...deserializer } = options;
  if (sharedRefs) {
    const session = createCrossDeserializer(deserializer);
    return createReader(
      {
        open: (_, data) => session.deserialize(data as SerovalNode),
        next(_, data) {
          session.deserialize(data as SerovalNode);
        },
        // The references are shared, so a key cannot free or fail them alone.
        done() {},
        fail() {},
        end(reason) {
          if (session.pending > 0) {
            session.abort(reason);
          }
        },
      },
      { maxKeys },
    );
  }
  const sessions = new Map<string, CrossDeserializer>();
  function stopSession(key: string, reason: unknown): void {
    const session = sessions.get(key);
    sessions.delete(key);
    if (session && session.pending > 0) {
      session.abort(reason);
    }
  }
  return createReader(
    {
      open(key, data) {
        const session = createCrossDeserializer(deserializer);
        sessions.set(key, session);
        return session.deserialize(data as SerovalNode);
      },
      next(key, data) {
        sessions.get(key)?.deserialize(data as SerovalNode);
      },
      done(key) {
        stopSession(key, createEndError());
      },
      fail: stopSession,
      end(reason) {
        // Abort every session, even when a stream listener throws.
        let failure: { value: unknown } | undefined;
        for (const key of Array.from(sessions.keys())) {
          try {
            stopSession(key, reason);
          } catch (error) {
            failure ??= { value: error };
          }
        }
        if (failure) {
          throw failure.value;
        }
      },
    },
    { maxKeys },
  );
}

/**
 * Fails every value in a `$R` scope that is still waiting on a message.
 * These are the open streams and the pending promise resolvers (`{ p, s, f }`)
 * from seroval's constructors. Failing a settled promise or a closed stream
 * does nothing. A ref can be any value a plugin decoded, so each read is
 * guarded.
 */
function releaseScope(scopeId: string, reason: unknown): void {
  // The messages declare `$R` on `self`, which is `globalThis` in browsers
  // and workers.
  const scopes = (globalThis as { self?: { $R?: Record<string, unknown[] | undefined> } }).self?.$R;
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
 * Creates a reader of the messages of `createJSWriter`. Each message runs
 * with `eval`, so only read messages from a writer you trust. Every value
 * shares the references of `$R[scopeId]`, so `cancel` and a failed value
 * only fail what waits in them when the reader ends.
 */
export function createJSReader(options: JSReaderOptions): Reader {
  const scopeId = options.scopeId;
  return createReader(
    {
      open: (_, data) => deserialize(data as string),
      next(_, data) {
        deserialize(data as string);
      },
      done() {},
      fail() {},
      end(reason) {
        releaseScope(scopeId, reason);
      },
    },
    options,
  );
}

/** Reads the value of `toJSONStream`. */
export function fromJSONStream<T>(options: JSONReaderOptions = {}): ValueReader<T> {
  return createValueReader(createJSONReader(options));
}

/** Reads the value of `toJSStream`. */
export function fromJSStream<T>(options: JSReaderOptions): ValueReader<T> {
  return createValueReader(createJSReader(options));
}
