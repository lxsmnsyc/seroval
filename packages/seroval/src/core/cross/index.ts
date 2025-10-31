import type { AsyncParserContextOptions } from '../context/parser/async';
import {
  createAsyncParserContext,
  parseTopAsync,
} from '../context/parser/async';
import type {
  StreamParserContextOptions,
  SyncParserContextOptions,
} from '../context/parser/sync';
import {
  createStreamParserContext,
  createSyncParserContext,
  destroyStreamParse,
  parseTop,
  startStreamParse,
} from '../context/parser/sync';
import { resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';
import type { CrossDeserializerContextOptions } from './deserializer';
import CrossDeserializerContext from './deserializer';
import CrossSerializerContext from './serializer';
import type { CrossContextOptions } from './utils';

export interface CrossSerializeOptions
  extends SyncParserContextOptions,
    CrossContextOptions {}

export function crossSerialize<T>(
  source: T,
  options: CrossSerializeOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext('cross', {
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = parseTop(ctx, source);
  const serial = new CrossSerializerContext({
    plugins,
    features: ctx.base.features,
    scopeId: options.scopeId,
    markedRefs: ctx.base.marked,
  });
  return serial.serializeTop(tree);
}

export interface CrossSerializeAsyncOptions
  extends AsyncParserContextOptions,
    CrossContextOptions {}

export async function crossSerializeAsync<T>(
  source: T,
  options: CrossSerializeAsyncOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext('cross', {
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = await parseTopAsync(ctx, source);
  const serial = new CrossSerializerContext({
    plugins,
    features: ctx.base.features,
    scopeId: options.scopeId,
    markedRefs: ctx.base.marked,
  });
  return serial.serializeTop(tree);
}

export type ToCrossJSONOptions = SyncParserContextOptions;

export function toCrossJSON<T>(
  source: T,
  options: ToCrossJSONOptions = {},
): SerovalNode {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext('cross', {
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
  const ctx = createAsyncParserContext('cross', {
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  return await parseTopAsync(ctx, source);
}

export interface CrossSerializeStreamOptions
  extends Omit<StreamParserContextOptions, 'onParse'>,
    CrossContextOptions {
  onSerialize: (data: string, initial: boolean) => void;
}

export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): () => void {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createStreamParserContext({
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial): void {
      const serial = new CrossSerializerContext({
        plugins,
        features: ctx.base.features,
        scopeId: options.scopeId,
        markedRefs: ctx.base.marked,
      });

      let serialized: string;

      try {
        serialized = serial.serializeTop(node);
      } catch (err) {
        if (options.onError) {
          options.onError(err);
        }
        return;
      }

      options.onSerialize(serialized, initial);
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
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
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
  const ctx = new CrossDeserializerContext({
    plugins,
    refs: options.refs,
  });
  return ctx.deserializeTop(source) as T;
}
