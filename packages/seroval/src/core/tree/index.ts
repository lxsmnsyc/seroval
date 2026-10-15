import { ALL_ENABLED } from '../compat';
import {
  createAsyncParserContext,
  parseTopAsync,
} from '../context/async-parser';
import {
  type BaseDeserializerContextOptions,
  createVanillaDeserializerContext,
  deserializeTop,
} from '../context/deserializer';
import type { BaseParserContextOptions } from '../context/parser';
import {
  createVanillaSerializerContext,
  serializeTopVanilla,
} from '../context/serializer';
import { createSyncParserContext, parseTop } from '../context/sync-parser';
import { type PluginAccessOptions, resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';

/**
 * Options for `serialize`. The same as the parser options, without `refs`:
 * the output is self-contained, so there is nothing to share between calls.
 */
export type SerializeOptions = Omit<BaseParserContextOptions, 'refs'>;
/** Options for `serializeAsync`. */
export type SerializeAsyncOptions = Omit<BaseParserContextOptions, 'refs'>;
/** Options for `toJSON`. */
export type ToJSONOptions = SerializeOptions;
/** Options for `toJSONAsync`. */
export type ToJSONAsyncOptions = SerializeAsyncOptions;

export function serialize<T>(
  source: T,
  options: SerializeOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = parseTop(ctx, source);
  const serial = createVanillaSerializerContext({
    plugins,
    features: ctx.base.features,
    markedRefs: ctx.base.marked,
  });
  return serializeTopVanilla(serial, tree);
}

export async function serializeAsync<T>(
  source: T,
  options: SerializeAsyncOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = await parseTopAsync(ctx, source);
  const serial = createVanillaSerializerContext({
    plugins,
    features: ctx.base.features,
    markedRefs: ctx.base.marked,
  });
  return serializeTopVanilla(serial, tree);
}

export function deserialize<T>(source: string): T {
  // oxlint-disable-next-line no-eval -- Deserializing runs the serialized source by design.
  return (0, eval)(source) as T;
}

export interface SerovalJSON {
  t: SerovalNode;
  f: number;
  m: number[];
}

export interface FromJSONOptions
  extends PluginAccessOptions,
    Pick<BaseDeserializerContextOptions, 'depthLimit' | 'maxBase64Length'> {
  disabledFeatures?: number;
}

export function toJSON<T>(
  source: T,
  options: ToJSONOptions = {},
): SerovalJSON {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: parseTop(ctx, source),
    f: ctx.base.features,
    m: Array.from(ctx.base.marked),
  };
}

export async function toJSONAsync<T>(
  source: T,
  options: ToJSONAsyncOptions = {},
): Promise<SerovalJSON> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext({
    compactArrayBufferViews: options.compactArrayBufferViews,
    depthLimit: options.depthLimit,
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: await parseTopAsync(ctx, source),
    f: ctx.base.features,
    m: Array.from(ctx.base.marked),
  };
}

export function compileJSON(
  source: SerovalJSON,
  options: PluginAccessOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createVanillaSerializerContext({
    plugins,
    features: source.f,
    markedRefs: source.m,
  });
  return serializeTopVanilla(ctx, source.t);
}

export function fromJSON<T>(
  source: SerovalJSON,
  options: FromJSONOptions = {},
): T {
  const plugins = resolvePlugins(options.plugins);
  const disabledFeatures = options.disabledFeatures ?? 0;
  // oxlint-disable-next-line no-unnecessary-condition -- Untrusted JSON can omit the features.
  const sourceFeatures = source.f ?? ALL_ENABLED;
  const ctx = createVanillaDeserializerContext({
    depthLimit: options.depthLimit,
    maxBase64Length: options.maxBase64Length,
    plugins,
    markedRefs: source.m,
    features: sourceFeatures & ~disabledFeatures,
    disabledFeatures,
  });
  return deserializeTop(ctx, source.t) as T;
}
