/**
 * Streaming parse mode. Everything here is reached through the function
 * fields of the stream parser state, which only `createStreamParserContext`
 * sets, so synchronous consumers (`serialize`, `toJSON`) never bundle it.
 */
import { createPluginNode, createStreamEventNode } from '../base-primitives';
import { NIL, SerovalNodeType } from '../constants';
import { SerovalParserError } from '../errors';
import type { LiveStream, LiveStreamSink } from '../live-stream';
import { createSerovalNode } from '../node';
import type { Plugin } from '../plugin';
import { SpecialReference } from '../special-reference';
import type { Stream, StreamListener } from '../stream';
import { SYM_ASYNC_ITERATOR } from '../symbols';
import type { SerovalNode, SerovalPluginNode } from '../types';
import { createBaseParserContext, parseSpecialReference } from './parser';
import {
  type OutputRecord,
  ParserMode,
  parseSOS,
  type StreamParserContext,
  type StreamParserContextOptions,
  type StreamParserState,
} from './sync-parser';

export class StreamParsePluginContext {
  constructor(
    private _p: StreamParserContext,
    private depth: number,
  ) {}

  parse<T>(current: T): SerovalNode {
    const state = this._p.state;
    state.parsing++;
    try {
      return parseSOS(this._p, this.depth, current);
    } finally {
      state.parsing--;
      if (!state.alive) {
        releaseParserValues(this._p);
      }
    }
  }

  parseWithError<T>(current: T): SerovalNode | undefined {
    try {
      return this.parse(current);
    } catch (error) {
      stopStreamParse(this._p, 1, error);
      return NIL;
    }
  }

  isAlive(): boolean {
    return this._p.state.alive;
  }
  pushPendingState(): void {
    pushPendingState(this._p);
  }
  popPendingState(): void {
    popPendingState(this._p);
  }

  onParse(node: SerovalNode): void {
    if (this.isAlive()) {
      this._p.state.queue.push({ node, initial: false, accept: NIL });
      drainOutput(this._p);
    }
  }

  onError(error: unknown): void {
    stopStreamParse(this._p, 1, error);
  }
  addCleanup(callback: () => void): void {
    addCleanup(this._p, callback);
  }
}

function addCleanup(ctx: StreamParserContext, callback: () => void): void {
  if (ctx.state.alive) {
    ctx.state.cleanups.push(callback);
  } else {
    callback();
  }
}

function parsePluginStream(
  ctx: StreamParserContext,
  depth: number,
  id: number,
  current: unknown,
  currentPlugins: Plugin<any, any>[],
): SerovalPluginNode | undefined {
  for (let i = 0, len = currentPlugins.length; i < len; i++) {
    const plugin = currentPlugins[i];
    if (plugin.parse.stream && plugin.test(current)) {
      return createPluginNode(
        id,
        plugin.tag,
        plugin.parse.stream(current, new StreamParsePluginContext(ctx, depth), {
          id,
        }),
      );
    }
  }
  return NIL;
}

type StreamEventType =
  | SerovalNodeType.StreamNext
  | SerovalNodeType.StreamThrow
  | SerovalNodeType.StreamReturn;

interface SynchronousSubscription {
  active: boolean;
  failure: { value: unknown } | undefined;
}

/**
 * One listener shape serves both `Stream.on` (no accept) and
 * `LiveStream.pump` (accept tied to record acceptance). Handlers return the
 * parse error so the pump can stop the source.
 */
function streamListener(
  ctx: StreamParserContext,
  depth: number,
  id: number,
  subscription?: SynchronousSubscription,
): LiveStreamSink<unknown> & StreamListener<unknown> {
  const handle =
    (type: StreamEventType, terminal: boolean) =>
    (value: unknown, accept?: () => void): unknown => {
      let failure: unknown = NIL;
      if (ctx.state.alive) {
        try {
          failure = parseEvent(
            ctx,
            depth,
            value,
            createStreamEventNode.bind(null, type, id),
            accept,
          );
        } catch (error) {
          // on() can replay synchronously before it returns the unsubscribe.
          // Defer reporting exceptions until that cleanup can be registered.
          if (!subscription?.active) {
            throw error;
          }
          subscription.failure ??= { value: error };
          failure = error;
        }
      }
      // A replay stream has no completion callback, so its terminal event
      // ends the pending slot here; a live stream reports through `done`.
      if (terminal && !accept) {
        popPendingState(ctx);
      }
      return failure;
    };
  return {
    next: handle(SerovalNodeType.StreamNext, false),
    throw: handle(SerovalNodeType.StreamThrow, true),
    return: handle(SerovalNodeType.StreamReturn, true),
    done() {
      popPendingState(ctx);
    },
    error(reason) {
      if (ctx.state.alive) {
        stopStreamParse(ctx, 1, reason);
      }
    },
  };
}

function subscribeStream(
  ctx: StreamParserContext,
  depth: number,
  id: number,
  current: Stream<unknown>,
): void {
  pushPendingState(ctx);
  const subscription: SynchronousSubscription = { active: true, failure: NIL };
  let cleanup: () => void;
  try {
    cleanup = current.on(streamListener(ctx, depth, id, subscription));
  } finally {
    subscription.active = false;
  }
  try {
    addCleanup(ctx, cleanup);
  } catch (error) {
    subscription.failure ??= { value: error };
  }
  const failure = subscription.failure;
  subscription.failure = NIL;
  if (failure) {
    throw failure.value;
  }
}

function consumeLiveStream(
  ctx: StreamParserContext,
  depth: number,
  id: number,
  current: LiveStream<unknown>,
): void {
  const cancel = current.pump(streamListener(ctx, depth, id));
  pushPendingState(ctx);
  addCleanup(ctx, () => cancel(ctx.state.reason));
}

function wrapPromiseResult(
  ctx: StreamParserContext,
  type: SerovalNodeType.PromiseSuccess | SerovalNodeType.PromiseFailure,
  id: number,
  node: SerovalNode,
): SerovalNode {
  return createSerovalNode(
    type,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    [
      parseSpecialReference(
        ctx.base,
        type === SerovalNodeType.PromiseSuccess
          ? SpecialReference.PromiseSuccess
          : SpecialReference.PromiseFailure,
      ),
      node,
    ],
    NIL,
    NIL,
    NIL,
    NIL,
  );
}

function handlePromise(
  this: StreamParserContext,
  type: SerovalNodeType.PromiseSuccess | SerovalNodeType.PromiseFailure,
  id: number,
  depth: number,
  data: unknown,
): void {
  if (this.state.alive) {
    parseEvent(
      this,
      depth,
      data,
      wrapPromiseResult.bind(null, this, type, id),
      NIL,
    );
  }
  popPendingState(this);
}

function watchPromise(
  ctx: StreamParserContext,
  resolver: number,
  depth: number,
  current: Promise<unknown>,
): void {
  pushPendingState(ctx);
  current.then(
    handlePromise.bind(ctx, SerovalNodeType.PromiseSuccess, resolver, depth),
    handlePromise.bind(ctx, SerovalNodeType.PromiseFailure, resolver, depth),
  );
}

function returnIterator(iterator: AsyncIterator<unknown>): void {
  Promise.resolve()
    .then(() => iterator.return?.())
    .catch(() => {
      // no-op
    });
}

/**
 * Drives an async iterator directly. The next value is pulled only after the
 * record for the previous one has been accepted, and cancellation returns
 * the iterator once.
 */
function iterateAsync(
  ctx: StreamParserContext,
  depth: number,
  id: number,
  current: AsyncIterable<unknown>,
): void {
  const iterator = current[SYM_ASYNC_ITERATOR]();
  const listener = streamListener(ctx, depth, id);
  let active = true;
  function stop(): void {
    if (active) {
      active = false;
      returnIterator(iterator);
    }
  }
  function pull(): void {
    if (active) {
      iterator.next().then(
        result => {
          if (active) {
            if (result.done) {
              active = false;
              listener.return(result.value, NIL as unknown as () => void);
            } else if (listener.next(result.value, pull) !== NIL) {
              // The value was never emitted, so stop the source.
              stop();
              (listener.done as () => void)();
            }
          }
        },
        error => {
          if (active) {
            active = false;
            listener.throw(error, NIL as unknown as () => void);
          }
        },
      );
    }
  }
  pushPendingState(ctx);
  addCleanup(ctx, stop);
  pull();
}

function createStreamParserState(
  options: StreamParserContextOptions,
): StreamParserState {
  return {
    alive: true,
    pending: 0,
    parsing: 0,
    queue: [],
    writing: false,
    inFlight: NIL,
    reason: NIL,
    onParse: options.onParse,
    onError: options.onError,
    onDone: options.onDone,
    cleanups: [],
    stream: subscribeStream,
    live: consumeLiveStream,
    promise: watchPromise,
    iterable: iterateAsync,
    plugin: parsePluginStream,
  };
}

export function createStreamParserContext(
  options: StreamParserContextOptions,
): StreamParserContext {
  return {
    type: ParserMode.Stream,
    base: createBaseParserContext(options),
    state: createStreamParserState(options),
  };
}

function pushPendingState(ctx: StreamParserContext): void {
  if (ctx.state.alive) {
    ctx.state.pending++;
  }
}

function popPendingState(ctx: StreamParserContext): void {
  if (ctx.state.alive) {
    ctx.state.pending--;
    checkStreamParse(ctx);
  }
}

/**
 * Parses a value that arrived after the root. Its record is queued before
 * parsing starts so that records discovered inside it follow it, and it is
 * dropped again if parsing fails. Returns the parse error after reporting
 * it, or `undefined`.
 */
function parseEvent(
  ctx: StreamParserContext,
  depth: number,
  value: unknown,
  wrap: (node: SerovalNode) => SerovalNode,
  accept: (() => void) | undefined,
): unknown {
  const state = ctx.state;
  const record: OutputRecord = { node: NIL, initial: false, accept };
  let failure: { value: unknown } | undefined;
  state.queue.push(record);
  state.parsing++;
  try {
    record.node = wrap(parseSOS(ctx, depth, value));
  } catch (error) {
    failure = { value: error };
  } finally {
    state.parsing--;
    if (!state.alive) {
      releaseParserValues(ctx);
    }
  }
  if (failure) {
    stopStreamParse(ctx, 1, failure.value);
  } else {
    drainOutput(ctx);
  }
  return failure?.value;
}

/**
 * Emits queued records one at a time. A callback that returns a promise
 * pauses emission until it settles; the source event behind the record is
 * accepted only after that.
 */
function drainOutput(ctx: StreamParserContext): void {
  const state = ctx.state;
  if (state.writing || state.parsing > 0) {
    return;
  }
  while (state.alive && state.queue.length > 0) {
    const record = state.queue.shift() as OutputRecord;
    if (!record.node) {
      continue;
    }
    let pending: Promise<void> | undefined;
    state.writing = true;
    state.inFlight = record;
    state.parsing++;
    try {
      if (!state.onParse) {
        throw new Error('Stream output callback is unavailable');
      }
      const result: unknown = state.onParse(record.node, record.initial);
      // Only objects and functions can be thenables; primitive prototypes
      // must not affect incidental callback returns.
      if (
        result !== null &&
        (typeof result === 'object' || typeof result === 'function')
      ) {
        const then: unknown = Reflect.get(result, 'then');
        if (typeof then === 'function') {
          pending = new Promise<void>((resolve, reject) => {
            Reflect.apply(then, result, [resolve, reject]);
          });
        }
      }
    } catch (error) {
      releaseRecord(record);
      stopStreamParse(ctx, 1, error);
      return;
    } finally {
      state.parsing--;
      if (!state.alive) {
        releaseParserValues(ctx);
      }
    }
    record.node = NIL;
    if (pending) {
      // Cancellation inside the callback must still observe its returned
      // thenable's rejection, without retaining the event or accepting it.
      if (!state.alive) {
        releaseRecord(record);
      }
      pending.then(
        () => {
          state.writing = false;
          state.inFlight = NIL;
          if (state.alive) {
            const accept = record.accept;
            releaseRecord(record);
            accept?.();
            drainOutput(ctx);
          }
        },
        error => {
          state.writing = false;
          state.inFlight = NIL;
          releaseRecord(record);
          stopStreamParse(ctx, 1, error);
        },
      );
      return;
    }
    if (!state.alive) {
      releaseRecord(record);
      return;
    }
    state.writing = false;
    state.inFlight = NIL;
    const accept = record.accept;
    releaseRecord(record);
    accept?.();
  }
  checkStreamParse(ctx);
}

function checkStreamParse(ctx: StreamParserContext): void {
  const state = ctx.state;
  if (
    state.alive &&
    state.parsing === 0 &&
    state.pending <= 0 &&
    state.queue.length === 0 &&
    !state.writing
  ) {
    stopStreamParse(ctx, 0);
  }
}

export function startStreamParse<T>(
  ctx: StreamParserContext,
  current: T,
): void {
  const state = ctx.state;
  let parsed: SerovalNode | undefined;
  let failure: { value: unknown } | undefined;
  state.parsing++;
  try {
    parsed = parseSOS(ctx, 0, current);
  } catch (error) {
    failure = { value: error };
  } finally {
    state.parsing--;
    if (!state.alive) {
      releaseParserValues(ctx);
    }
  }
  if (failure) {
    if (state.alive) {
      stopStreamParse(ctx, 1, failure.value);
    } else {
      throw failure.value;
    }
  } else if (parsed && state.alive) {
    state.queue.unshift({ node: parsed, initial: true, accept: NIL });
    drainOutput(ctx);
  }
}

// Runs every cleanup once, even if one throws, then rethrows the first error.
function runCleanups(state: StreamParserState): void {
  const cleanups = state.cleanups;
  let failure: { value: unknown } | undefined;
  state.cleanups = [];
  for (const record of state.queue) {
    releaseRecord(record);
  }
  state.queue.length = 0;
  if (state.inFlight) {
    releaseRecord(state.inFlight);
  }
  state.inFlight = NIL;
  for (let i = 0, len = cleanups.length; i < len; i++) {
    try {
      cleanups[i]();
    } catch (error) {
      failure ??= { value: error };
    }
  }
  if (failure) {
    throw failure.value;
  }
}

function releaseRecord(record: OutputRecord): void {
  record.node = NIL;
  record.accept = NIL;
}

function releaseParserValues(ctx: StreamParserContext): void {
  // Detach, never clear, a possibly caller-owned map. Also run after an
  // interrupted synchronous parse unwinds, in case it produced more nodes.
  ctx.base.refs = new Map();
  ctx.base.marked.clear();
  ctx.base.plugins = NIL;
  // Late cleanup can still register while a parser/output/terminal callback
  // unwinds. Live producers already own any reason needed for future writes.
  if (ctx.state.parsing === 0) {
    ctx.state.reason = NIL;
  }
}

/**
 * Ends the parse once: `onDone` on success, `onError` on failure, and every
 * cleanup either way.
 */
function stopStreamParse(
  ctx: StreamParserContext,
  mode: 0 | 1 | 2,
  reason?: unknown,
): void {
  const state = ctx.state;
  if (state.alive) {
    state.alive = false;
    const onError = state.onError;
    const onDone = state.onDone;
    if (mode === 1 && !onError && !(reason instanceof SerovalParserError)) {
      reason = new SerovalParserError(reason);
    }
    state.reason = reason;
    state.onParse = NIL;
    state.onError = NIL;
    state.onDone = NIL;
    state.writing = false;
    state.parsing++;
    let failure: { value: unknown } | undefined;
    try {
      if (mode === 1) {
        if (onError) {
          onError(reason);
        } else {
          throw reason;
        }
      } else if (mode === 0) {
        onDone?.();
      }
    } catch (error) {
      failure = { value: error };
    }
    try {
      runCleanups(state);
    } catch (error) {
      failure ??= { value: error };
    } finally {
      state.parsing--;
      releaseParserValues(ctx);
      state.pending = 0;
    }
    if (failure) {
      throw failure.value;
    }
  }
}

export function destroyStreamParse(
  ctx: StreamParserContext,
  reason?: unknown,
): void {
  stopStreamParse(ctx, 2, reason);
}
