import type { BaseParserContextOptions } from '../context/parser';
import {
  createAsyncParserContext,
  parseTopAsync,
} from '../context/parser/async';
import { createSyncParserContext, parseTop } from '../context/parser/sync';
import { createVanillaSerializerContext, serializeTopVanilla } from '../context/serializer';
import { type PluginAccessOptions, resolvePlugins, SerovalMode } from '../plugin';
import type { SerovalNode } from '../types';
import VanillaDeserializerContext from './deserializer';

export type SyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>;
export type AsyncParserContextOptions = Omit<BaseParserContextOptions, 'refs'>;

export function serialize<T>(
  source: T,
  options: SyncParserContextOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext(SerovalMode.Vanilla, {
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
  options: AsyncParserContextOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext(SerovalMode.Vanilla, {
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
  return (0, eval)(source) as T;
}

export interface SerovalJSON {
  t: SerovalNode;
  f: number;
  m: number[];
}

export function toJSON<T>(
  source: T,
  options: SyncParserContextOptions = {},
): SerovalJSON {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createSyncParserContext(SerovalMode.Vanilla, {
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
  options: AsyncParserContextOptions = {},
): Promise<SerovalJSON> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = createAsyncParserContext(SerovalMode.Vanilla, {
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
  options: PluginAccessOptions = {},
): T {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new VanillaDeserializerContext({
    plugins,
    markedRefs: source.m,
  });
  return ctx.deserializeTop(source.t) as T;
}
