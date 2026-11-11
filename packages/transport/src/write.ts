import type { CrossSerializeStreamOptions, ToCrossJSONStreamOptions } from 'seroval/write';
import { crossSerializeStream, getCrossReferenceHeader, toCrossJSONStream } from 'seroval/write';

import type { Writer, WriterOptions } from './create-writer';
import { createWriter } from './create-writer';

export type { Message } from './message';
export { SerovalTransportError } from './message';
export type { MessageSink, Writer, WriterOptions } from './create-writer';

export interface JSONWriterOptions
  extends Omit<ToCrossJSONStreamOptions, 'onParse' | 'onDone' | 'onError' | 'refs'>, WriterOptions {
  /**
   * Shares one set of references across every value, so a later value can
   * refer to an earlier one. The references are then kept until the writer
   * is done. By default, each value has its own and frees them when it is
   * done. The reader must use the same setting.
   */
  sharedRefs?: boolean;
}

export interface JSWriterOptions
  extends
    Omit<CrossSerializeStreamOptions, 'onSerialize' | 'onDone' | 'onError' | 'refs' | 'scopeId'>,
    WriterOptions {
  /**
   * The key of `$R` that holds the references of this writer. The reader
   * must use the same one. Every value shares these references.
   */
  scopeId: string;
}

/**
 * Creates a writer that sends each value as cross-reference JSON nodes. Read
 * the messages with `createJSONReader`.
 */
export function createJSONWriter(options: JSONWriterOptions): Writer {
  const shared = options.sharedRefs ? new Map<unknown, number>() : undefined;
  return createWriter(options, (value, callbacks) => {
    // The first piece of a value is parsed before `toCrossJSONStream`
    // returns, so the references it adds are the ones after `mark`.
    const mark = shared ? shared.size : 0;
    let sent = false;
    // seroval ignores the writer's own options, such as `send`.
    return toCrossJSONStream(value, {
      ...options,
      refs: shared ?? new Map(),
      onParse(data, initial) {
        sent = true;
        return callbacks.onData(data, initial);
      },
      onDone: callbacks.onDone,
      onError(error) {
        // A value that fails before its first message added references the
        // reader never received. Drop them, so a later value sends its own
        // copy instead of a reference the reader cannot resolve.
        if (shared && !sent) {
          dropReferences(shared, mark);
        }
        callbacks.onError(error);
      },
    });
  });
}

/** Removes the references of `refs` that were added after the first `count`. */
function dropReferences(refs: Map<unknown, number>, count: number): void {
  let index = 0;
  for (const key of Array.from(refs.keys())) {
    if (index >= count) {
      refs.delete(key);
    }
    index++;
  }
}

/**
 * Creates a writer that sends each value as code. The first message declares
 * `$R[scopeId]`. Read the messages with `createJSReader`, which runs them with
 * `eval`, so only use it when the reader trusts the writer.
 */
export function createJSWriter(options: JSWriterOptions): Writer {
  const header = getCrossReferenceHeader(options.scopeId);
  const refs = new Map<unknown, number>();
  let declared = false;
  return createWriter<string>(options, (value, callbacks) =>
    crossSerializeStream(value, {
      ...options,
      refs,
      onSerialize(data, initial) {
        // The first piece of a value is an expression that evaluates to it.
        if (initial && !declared) {
          declared = true;
          return callbacks.onData(`(${header},${data})`, initial);
        }
        return callbacks.onData(data, initial);
      },
      onDone: callbacks.onDone,
      onError: callbacks.onError,
    }),
  );
}

/**
 * Sends one value as cross-reference JSON nodes, and finishes when it is done.
 * Read it with `fromJSONStream`.
 */
export function toJSONStream(value: unknown, options: JSONWriterOptions): Writer {
  const writer = createJSONWriter(options);
  writer.push(value);
  writer.flush();
  return writer;
}

/**
 * Sends one value as code, and finishes when it is done. Read it with
 * `fromJSStream`.
 */
export function toJSStream(value: unknown, options: JSWriterOptions): Writer {
  const writer = createJSWriter(options);
  writer.push(value);
  writer.flush();
  return writer;
}
