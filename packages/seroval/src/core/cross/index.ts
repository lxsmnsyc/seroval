import type { AsyncParserContextOptions } from '../context/async-parser';
import {
  createAsyncParserContext,
  parseTopAsync,
} from '../context/async-parser';
import type { CrossDeserializerContextOptions } from '../context/deserializer';
import {
  createCrossDeserializerContext,
  deserializeTop,
} from '../context/deserializer';
import type { CrossContextOptions } from '../context/serializer';
import {
  createCrossSerializerContext,
  serializeTopCross,
} from '../context/serializer';
import {
  createStreamParserContext,
  destroyStreamParse,
  startStreamParse,
} from '../context/stream-parser';
import type {
  StreamParserContextOptions,
  SyncParserContextOptions,
} from '../context/sync-parser';
import { createSyncParserContext, parseTop } from '../context/sync-parser';
import { resolvePlugins, SerovalMode } from '../plugin';
import type { SerovalNode } from '../types';

export interface CrossSerializeOptions
  extends SyncParserContextOptions,
    CrossContextOptions {}

export function crossSerialize<T>(
  source: T,
  options: CrossSerializeOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext(SerovalMode.Cross, {
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
  });
  return serializeTopCross(serial, tree);
}

export interface CrossSerializeAsyncOptions
  extends AsyncParserContextOptions,
    CrossContextOptions {}

export async function crossSerializeAsync<T>(
  source: T,
  options: CrossSerializeAsyncOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext(SerovalMode.Cross, {
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
  });
  return serializeTopCross(serial, tree);
}

export type ToCrossJSONOptions = SyncParserContextOptions;

export function toCrossJSON<T>(
  source: T,
  options: ToCrossJSONOptions = {},
): SerovalNode {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext(SerovalMode.Cross, {
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  return parseTop(ctx, source);
}

export type ToCrossJSONAsyncOptions = AsyncParserContextOptions;

export async function toCrossJSONAsync<T>(
  source: T,
  options: ToCrossJSONAsyncOptions = {},
): Promise<SerovalNode> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext(SerovalMode.Cross, {
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  return await parseTopAsync(ctx, source);
}

export interface CrossSerializeStreamOptions
  extends Omit<StreamParserContextOptions, 'onParse'>,
    CrossContextOptions {
  /**
   * Receives each serialized record. Returning a promise defers the next
   * record, and the acceptance of the live stream event behind this one,
   * until the promise settles.
   */
  onSerialize: (data: string, initial: boolean) => void | PromiseLike<void>;
}

export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): () => void {
  const plugins = resolvePlugins(options.plugins);
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
        scopeId: options.scopeId,
        markedRefs: ctx.base.marked,
      });

      let serialized: string;

      try {
        serialized = serializeTopCross(serial, node);
      } catch (err) {
        if (options.onError) {
          options.onError(err);
        }
        return;
      }

      return options.onSerialize(serialized, initial);
    },
    onError: options.onError,
    onDone: options.onDone,
  });

  startStreamParse(ctx, source);

  return destroyStreamParse.bind(null, ctx);
}

export type ToCrossJSONStreamOptions = StreamParserContextOptions;

export function toCrossJSONStream<T>(
  source: T,
  options: ToCrossJSONStreamOptions,
): () => void {
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

export type FromCrossJSONOptions = CrossDeserializerContextOptions;

export function fromCrossJSON<T>(
  source: SerovalNode,
  options: FromCrossJSONOptions,
): T {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createCrossDeserializerContext({
    maxBase64Length: options.maxBase64Length,
    plugins,
    refs: options.refs,
    features: options.features,
    disabledFeatures: options.disabledFeatures,
    depthLimit: options.depthLimit,
  });
  return deserializeTop(ctx, source) as T;
}
