import type { PluginAccessOptions } from '../plugin';
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
  const ctx = new SyncParserContext({
    plugins: options.plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = ctx.parse(source);
  const serial = new VanillaSerializerContext({
    plugins: options.plugins,
    features: ctx.features,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
}

export async function serializeAsync<T>(
  source: T,
  options: AsyncParserContextOptions = {},
): Promise<string> {
  const ctx = new AsyncParserContext({
    plugins: options.plugins,
    disabledFeatures: options.disabledFeatures,
  });
  const tree = await ctx.parse(source);
  const serial = new VanillaSerializerContext({
    plugins: options.plugins,
    features: ctx.features,
    markedRefs: ctx.marked,
  });
  return serial.serializeTop(tree);
}

export function deserialize<T>(source: string): T {
  // eslint-disable-next-line no-eval
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
  const ctx = new SyncParserContext({
    plugins: options.plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: ctx.parse(source),
    f: ctx.features,
    m: Array.from(ctx.marked),
  };
}

export async function toJSONAsync<T>(
  source: T,
  options: AsyncParserContextOptions = {},
): Promise<SerovalJSON> {
  const ctx = new AsyncParserContext({
    plugins: options.plugins,
    disabledFeatures: options.disabledFeatures,
  });
  return {
    t: await ctx.parse(source),
    f: ctx.features,
    m: Array.from(ctx.marked),
  };
}

export function compileJSON(source: SerovalJSON, options: PluginAccessOptions = {}): string {
  const ctx = new VanillaSerializerContext({
    plugins: options.plugins,
    features: source.f,
    markedRefs: source.m,
  });
  return ctx.serializeTop(source.t);
}

export function fromJSON<T>(source: SerovalJSON, options: PluginAccessOptions = {}): T {
  const ctx = new VanillaDeserializerContext({
    plugins: options.plugins,
    markedRefs: source.m,
  });
  return ctx.deserialize(source.t) as T;
}
