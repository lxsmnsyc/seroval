import { createAsyncParserContext, parseTopAsync } from '../context/async-parser';
import type { BaseParserContextOptions } from '../context/parser';
import { createVanillaSerializerContext, serializeTopVanilla } from '../context/serializer';
import { createSyncParserContext, parseTop } from '../context/sync-parser';
import { type PluginAccessOptions, resolvePlugins } from '../plugin';
import type { SerovalJSON } from './read';

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

export function serialize<T>(source: T, options: SerializeOptions = {}): string {
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

export function toJSON<T>(source: T, options: ToJSONOptions = {}): SerovalJSON {
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

export function compileJSON(source: SerovalJSON, options: PluginAccessOptions = {}): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createVanillaSerializerContext({
    plugins,
    features: source.f,
    markedRefs: source.m,
  });
  return serializeTopVanilla(ctx, source.t);
}
