import { resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';
import type { CrossAsyncParserContextOptions } from './async';
import AsyncCrossParserContext from './async';
import type { CrossDeserializerContextOptions } from './deserializer';
import CrossDeserializerContext from './deserializer';
import type { CrossContextOptions, CrossParserContextOptions } from './parser';
import CrossSerializerContext from './serializer';
import type { CrossStreamParserContextOptions } from './stream';
import StreamCrossParserContext from './stream';
import type { CrossSyncParserContextOptions } from './sync';
import SyncCrossParserContext from './sync';

export interface CrossSerializeOptions
  extends CrossSyncParserContextOptions,
    CrossContextOptions {}

export function crossSerialize<T>(
  source: T,
  options: CrossSerializeOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new SyncCrossParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = ctx.parse(source);
  const serial = new CrossSerializerContext({
    plugins,
    features: ctx.features,
    scopeId: options.scopeId,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
}

export interface CrossSerializeAsyncOptions
  extends CrossAsyncParserContextOptions,
    CrossContextOptions {}

export async function crossSerializeAsync<T>(
  source: T,
  options: CrossSerializeAsyncOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new AsyncCrossParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  const tree = await ctx.parse(source);
  const serial = new CrossSerializerContext({
    plugins,
    features: ctx.features,
    scopeId: options.scopeId,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
}

export type ToCrossJSONOptions = CrossParserContextOptions;

export function toCrossJSON<T>(
  source: T,
  options: CrossParserContextOptions = {},
): SerovalNode {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new SyncCrossParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  return ctx.parse(source);
}

export type ToCrossJSONAsyncOptions = CrossParserContextOptions;

export async function toCrossJSONAsync<T>(
  source: T,
  options: CrossParserContextOptions = {},
): Promise<SerovalNode> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new AsyncCrossParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
    refs: options.refs,
  });
  return await ctx.parse(source);
}

export interface CrossSerializeStreamOptions
  extends Omit<CrossStreamParserContextOptions, 'onParse'>,
    CrossContextOptions {
  onSerialize: (data: string, initial: boolean) => void;
}

export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): () => void {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new StreamCrossParserContext({
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial): void {
      const serial = new CrossSerializerContext({
        plugins,
        features: ctx.features,
        scopeId: options.scopeId,
        markedRefs: ctx.marked,
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

  ctx.start(source);

  return () => {
    ctx.destroy();
  };
}

export type ToCrossJSONStreamOptions = CrossStreamParserContextOptions;

export function toCrossJSONStream<T>(
  source: T,
  options: ToCrossJSONStreamOptions,
): () => void {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new StreamCrossParserContext({
    plugins,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse: options.onParse,
    onError: options.onError,
    onDone: options.onDone,
  });

  ctx.start(source);

  return () => {
    ctx.destroy();
  };
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
  return ctx.deserialize(source) as T;
}
