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
import { type Plugin, SerovalMode } from '../plugin';
import { SpecialReference } from '../special-reference';
import type { Stream } from '../stream';
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
    return parseSOS(this._p, this.depth, current);
  }

  parseWithError<T>(current: T): SerovalNode | undefined {
    return parseWithError(this._p, this.depth, current);
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
    onParse(this._p, node);
  }

  onError(error: unknown): void {
    onError(this._p, error);
  }

  addCleanup(callback: () => void): void {
    this._p.state.cleanups.push(callback);
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

/**
 * One listener shape serves both `Stream.on` (no accept) and
 * `LiveStream.pump` (accept tied to record acceptance). Handlers return the
 * parse error so the pump can stop the source.
 */
function streamListener(
  ctx: StreamParserContext,
  depth: number,
  id: number,
): LiveStreamSink<unknown> {
  const handle =
    (type: StreamEventType, terminal: boolean) =>
    (value: unknown, accept?: () => void): unknown => {
      let failure: unknown = NIL;
      if (ctx.state.alive) {
        failure = parseEvent(
          ctx,
          depth,
          value,
          createStreamEventNode.bind(null, type, id),
          accept,
        );
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
        popPendingState(ctx);
        onError(ctx, reason);
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
  ctx.state.cleanups.push(current.on(streamListener(ctx, depth, id)));
}

function consumeLiveStream(
  ctx: StreamParserContext,
  depth: number,
  id: number,
  current: LiveStream<unknown>,
): void {
  const cancel = current.pump(streamListener(ctx, depth, id));
  pushPendingState(ctx);
  ctx.state.cleanups.push(() => cancel(ctx.state.reason));
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

function handlePromiseSuccess(
  this: StreamParserContext,
  id: number,
  depth: number,
  data: unknown,
): void {
  if (this.state.alive) {
    parseEvent(
      this,
      depth,
      data,
      wrapPromiseResult.bind(null, this, SerovalNodeType.PromiseSuccess, id),
      NIL,
    );
    popPendingState(this);
  }
}

function handlePromiseFailure(
  this: StreamParserContext,
  id: number,
  depth: number,
  data: unknown,
): void {
  if (this.state.alive) {
    parseEvent(
      this,
      depth,
      data,
      wrapPromiseResult.bind(null, this, SerovalNodeType.PromiseFailure, id),
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
    handlePromiseSuccess.bind(ctx, resolver, depth),
    handlePromiseFailure.bind(ctx, resolver, depth),
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
  let active = true;
  pushPendingState(ctx);
  ctx.state.cleanups.push(() => {
    if (active) {
      active = false;
      returnIterator(iterator);
    }
  });
  function settle(
    type: StreamEventType,
    value: unknown,
    accept: (() => void) | undefined,
  ): void {
    if (active) {
      const failure = parseEvent(
        ctx,
        depth,
        value,
        createStreamEventNode.bind(null, type, id),
        accept,
      );
      if (accept === NIL) {
        active = false;
        popPendingState(ctx);
      } else if (failure !== NIL) {
        // The value was never emitted, so stop the source.
        active = false;
        returnIterator(iterator);
        popPendingState(ctx);
      }
    }
  }
  function pull(): void {
    if (active) {
      iterator.next().then(
        result =>
          result.done
            ? settle(SerovalNodeType.StreamReturn, result.value, NIL)
            : settle(SerovalNodeType.StreamNext, result.value, pull),
        error => settle(SerovalNodeType.StreamThrow, error, NIL),
      );
    }
  }
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
    base: createBaseParserContext(SerovalMode.Cross, options),
    state: createStreamParserState(options),
  };
}

function onParse(ctx: StreamParserContext, node: SerovalNode): void {
  ctx.state.queue.push({ node, initial: false, accept: NIL });
  drainOutput(ctx);
}

function onError(ctx: StreamParserContext, error: unknown): void {
  if (ctx.state.onError) {
    ctx.state.onError(error);
  } else {
    throw error instanceof SerovalParserError
      ? error
      : new SerovalParserError(error);
  }
}

function pushPendingState(ctx: StreamParserContext): void {
  ctx.state.pending++;
}

function popPendingState(ctx: StreamParserContext): void {
  ctx.state.pending--;
  checkStreamParse(ctx);
}

/**
 * Parses a value that arrived after the root, queues its wrapper record
 * ahead of any records discovered while parsing it, and emits what can be
 * emitted. Returns the parse error after reporting it, or `undefined`.
 */
function parseEvent(
  ctx: StreamParserContext,
  depth: number,
  value: unknown,
  wrap: (node: SerovalNode) => SerovalNode,
  accept: (() => void) | undefined,
): unknown {
  const state = ctx.state;
  const outer = state.queue;
  let parsed: SerovalNode | undefined;
  let failure: unknown = NIL;
  state.queue = [];
  state.parsing++;
  try {
    parsed = parseSOS(ctx, depth, value);
  } catch (error) {
    failure = error;
  } finally {
    state.parsing--;
    const inner = state.queue;
    state.queue = outer;
    if (parsed) {
      outer.push({ node: wrap(parsed), initial: false, accept });
    }
    for (let i = 0, len = inner.length; i < len; i++) {
      outer.push(inner[i]);
    }
  }
  if (failure === NIL) {
    drainOutput(ctx);
  } else {
    onError(ctx, failure);
  }
  return failure;
}

function parseWithError<T>(
  ctx: StreamParserContext,
  depth: number,
  current: T,
): SerovalNode | undefined {
  try {
    return parseSOS(ctx, depth, current);
  } catch (err) {
    onError(ctx, err);
    return NIL;
  }
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
    let result: void | PromiseLike<void>;
    try {
      result = state.onParse(record.node, record.initial);
    } catch (error) {
      onError(ctx, error);
      continue;
    }
    if (result && typeof result.then === 'function') {
      state.writing = true;
      result.then(
        () => {
          state.writing = false;
          if (state.alive) {
            if (record.accept) {
              record.accept();
            }
            drainOutput(ctx);
          }
        },
        error => {
          state.writing = false;
          stopStreamParse(ctx, error);
        },
      );
      return;
    }
    if (record.accept) {
      record.accept();
    }
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
    destroyStreamParse(ctx);
  }
}

export function startStreamParse<T>(
  ctx: StreamParserContext,
  current: T,
): void {
  const state = ctx.state;
  let parsed: SerovalNode | undefined;
  let failure: unknown = NIL;
  state.parsing++;
  try {
    parsed = parseSOS(ctx, 0, current);
  } catch (error) {
    failure = error;
  } finally {
    state.parsing--;
  }
  if (failure !== NIL) {
    stopStreamParse(ctx, failure);
  } else if (parsed) {
    state.queue.unshift({ node: parsed, initial: true, accept: NIL });
    drainOutput(ctx);
  }
}

// Runs every cleanup once, even if one throws, then rethrows the first error.
function runCleanups(state: StreamParserState): void {
  const cleanups = state.cleanups;
  let failure: unknown = NIL;
  state.cleanups = [];
  state.queue.length = 0;
  for (let i = 0, len = cleanups.length; i < len; i++) {
    try {
      cleanups[i]();
    } catch (error) {
      if (failure === NIL) {
        failure = error;
      }
    }
  }
  if (failure !== NIL) {
    throw failure;
  }
}

/**
 * Ends the parse once: `onDone` on success, `onError` on failure, and every
 * cleanup either way.
 */
function stopStreamParse(ctx: StreamParserContext, failure: unknown): void {
  const state = ctx.state;
  if (state.alive) {
    state.alive = false;
    state.reason = failure;
    try {
      if (failure !== NIL) {
        onError(ctx, failure);
      } else if (state.onDone) {
        state.onDone();
      }
    } finally {
      runCleanups(state);
    }
  }
}

export function destroyStreamParse(ctx: StreamParserContext): void {
  stopStreamParse(ctx, NIL);
}
