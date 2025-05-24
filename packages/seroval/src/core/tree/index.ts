import { type PluginAccessOptions, resolvePlugins } from '../plugin';
import type { SerovalNode } from '../types';
import type { AsyncParserContextOptions } from './async';
import AsyncParserContext from './async';
import VanillaDeserializerContext from './deserializer';
import VanillaSerializerContext from './serializer';
import type { SyncParserContextOptions } from './sync';
import SyncParserContext from './sync';

export function serialize<T>(
  source: T,
  options: SyncParserContextOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new SyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = ctx.parseTop(source);
  const serial = new VanillaSerializerContext({
    plugins,
    features: ctx.features,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
}

export async function serializeAsync<T>(
  source: T,
  options: AsyncParserContextOptions = {},
): Promise<string> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new AsyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = await ctx.parseTop(source);
  const serial = new VanillaSerializerContext({
    plugins,
    features: ctx.features,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
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
  const ctx = new SyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: ctx.parseTop(source),
    f: ctx.features,
    m: Array.from(ctx.marked),
  };
}

export async function toJSONAsync<T>(
  source: T,
  options: AsyncParserContextOptions = {},
): Promise<SerovalJSON> {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new AsyncParserContext({
    plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: await ctx.parseTop(source),
    f: ctx.features,
    m: Array.from(ctx.marked),
  };
}

export function compileJSON(
  source: SerovalJSON,
  options: PluginAccessOptions = {},
): string {
  const plugins = resolvePlugins(options.plugins);
  const ctx = new VanillaSerializerContext({
    plugins,
    features: source.f,
    markedRefs: source.m,
  });
  return ctx.serializeTop(source.t);
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
