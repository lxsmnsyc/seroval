import type { AsyncParserContextOptions } from '../context/async-parser';
import { createAsyncParserContext, parseTopAsync } from '../context/async-parser';
import type { CrossContextOptions } from '../context/serializer';
import { createCrossSerializerContext, serializeTopCross } from '../context/serializer';
import {
  createStreamParserContext,
  destroyStreamParse,
  startStreamParse,
} from '../context/stream-parser';
import type { StreamParserContextOptions, SyncParserContextOptions } from '../context/sync-parser';
import { createSyncParserContext, parseTop } from '../context/sync-parser';
import { resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';

export interface CrossAssignmentOptions {
  /**
   * Only assign `$R[n]` for values that the output reads more than once,
   * such as shared references and cycles. The output is shorter, but later
   * scripts cannot read the other values from `$R`. Only use it when no
   * later output that shares the same references refers back to this one.
   */
  assignSharedRefsOnly?: boolean;
}

export interface CrossSerializeOptions
  extends SyncParserContextOptions, CrossContextOptions, CrossAssignmentOptions {}

/**
 * Cross-reference variant of {@link serialize}. The output references a shared
 * `$R` reference table on the target realm instead of being fully
 * self-contained, so several payloads that share a `refs` map (and optionally a
 * `scopeId`) can point at the same instances after evaluation - the basis for
 * streaming a value across a network boundary in multiple chunks.
 *
 * Synchronous: use {@link crossSerializeAsync} for values containing Promises,
 * or {@link crossSerializeStream} to emit chunks as they resolve.
 */
export function crossSerialize<T>(source: T, options: CrossSerializeOptions = {}): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = parseTop(ctx, source);
  const serial = createCrossSerializerContext({
    plugins,
    features: ctx.base.features,
    scopeId: options.scopeId,
    markedRefs: ctx.base.marked,
    assignSharedRefsOnly: options.assignSharedRefsOnly,
  });
  return serializeTopCross(serial, tree);
}

export interface CrossSerializeAsyncOptions
  extends AsyncParserContextOptions, CrossContextOptions, CrossAssignmentOptions {}

/**
 * Asynchronous variant of {@link crossSerialize}: awaits every reachable
 * `Promise` before producing the cross-referenced string.
 */
export async function crossSerializeAsync<T>(
  source: T,
  options: CrossSerializeAsyncOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = await parseTopAsync(ctx, source);
  const serial = createCrossSerializerContext({
    plugins,
    features: ctx.base.features,
    scopeId: options.scopeId,
    markedRefs: ctx.base.marked,
    assignSharedRefsOnly: options.assignSharedRefsOnly,
  });
  return serializeTopCross(serial, tree);
}

export type ToCrossJSONOptions = SyncParserContextOptions;

/**
 * Cross-reference variant of {@link toJSON}. Produces a single
 * {@link SerovalNode} tree (not wrapped with feature/marked metadata) meant to
 * be rebuilt with {@link fromCrossJSON} using a shared `refs` map.
 *
 * Synchronous: use {@link toCrossJSONAsync} for Promises, or
 * {@link toCrossJSONStream} to emit nodes as they resolve.
 */
export function toCrossJSON<T>(source: T, options: ToCrossJSONOptions = {}): SerovalNode {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  return parseTop(ctx, source);
}

export type ToCrossJSONAsyncOptions = AsyncParserContextOptions;

/**
 * Asynchronous variant of {@link toCrossJSON}: awaits every reachable `Promise`
 * before producing the node tree.
 */
export async function toCrossJSONAsync<T>(
  source: T,
  options: ToCrossJSONAsyncOptions = {},
): Promise<SerovalNode> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  return await parseTopAsync(ctx, source);
}

export interface CrossSerializeStreamOptions
  extends Omit<StreamParserContextOptions, 'onParse'>, CrossContextOptions {
  /**
   * Called for each serialized chunk. `initial` is `true` for the first chunk
   * (the synchronous part of the value) and `false` for chunks emitted later as
   * Promises and streams resolve. Returning a promise defers the next
   * record, and the acceptance of the live stream event behind this one,
   * until the promise settles.
   */
  onSerialize: (data: string, initial: boolean) => void | PromiseLike<void>;
}

/**
 * Streaming variant of {@link crossSerialize}. Emits the synchronous portion of
 * the value immediately through `onSerialize`, then one further chunk each time
 * a reachable `Promise` or `ReadableStream` produces a value, calling `onDone`
 * when everything has settled.
 *
 * @returns A function that aborts the stream and releases its resources.
 */
export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): (reason?: unknown) => void {
  const plugins = resolvePlugins(options.plugins);
  const onSerialize = options.onSerialize;
  const scopeId = options.scopeId;
  const ctx = createStreamParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial): void | PromiseLike<void> {
      const serial = createCrossSerializerContext({
        plugins,
        features: ctx.base.features,
        scopeId,
        markedRefs: ctx.base.marked,
      });

      return onSerialize(serializeTopCross(serial, node), initial);
    },
    onError: options.onError,
    onDone: options.onDone,
  });

  startStreamParse(ctx, source);

  return destroyStreamParse.bind(null, ctx);
}

export type ToCrossJSONStreamOptions = StreamParserContextOptions;

/**
 * Streaming variant of {@link toCrossJSON}. Delivers {@link SerovalNode} chunks
 * through `onParse` - the synchronous part first, then one per resolving
 * `Promise` / `ReadableStream` - and calls `onDone` when the value has fully
 * settled.
 *
 * @returns A function that aborts the stream and releases its resources.
 */
export function toCrossJSONStream<T>(
  source: T,
  options: ToCrossJSONStreamOptions,
): (reason?: unknown) => void {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createStreamParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    depthLimit: options.depthLimit,
    onParse: options.onParse,
    onError: options.onError,
    onDone: options.onDone,
  });

  startStreamParse(ctx, source);

  return destroyStreamParse.bind(null, ctx);
}
