import { Feature } from '../compat';
import { SerovalNodeType } from '../constants';
import type { PluginAccessOptions } from '../plugin';
import type { SerovalNode } from '../types';
import type { AsyncParserContextOptions } from './async';
import AsyncParserContext from './async';
import VanillaDeserializerContext from './deserialize';
import VanillaSerializerContext from './serialize';
import type { SyncParserContextOptions } from './sync';
import SyncParserContext from './sync';

function finalize(
  ctx: VanillaSerializerContext,
  rootID: number | undefined,
  isObject: boolean,
  result: string,
): string {
  // Shared references detected
  if (rootID != null && ctx.vars.length) {
    const patches = ctx.resolvePatches();
    let body = result;
    if (patches) {
      // Get (or create) a ref from the source
      const index = ctx.getRefParam(rootID);
      body = result + ',' + patches + index;
      if (!result.startsWith(index + '=')) {
        body = index + '=' + body;
      }
    }
    let params = ctx.vars.length > 1
      ? ctx.vars.join(',')
      : ctx.vars[0];
    // Source is probably already assigned
    if (ctx.features & Feature.ArrowFunction) {
      params = ctx.vars.length > 1 || ctx.vars.length === 0
        ? '(' + params + ')'
        : params;
      return '(' + params + '=>(' + body + '))()';
    }
    return '(function(' + params + '){return ' + body + '})()';
  }
  if (isObject) {
    return '(' + result + ')';
  }
  return result;
}

export function serialize<T>(
  source: T,
  options: SyncParserContextOptions = {},
): string {
  const ctx = new SyncParserContext(options);
  const tree = ctx.parse(source);
  const serial = new VanillaSerializerContext({
    plugins: options.plugins,
    features: ctx.features,
    markedRefs: ctx.marked,
  });
  const result = serial.serialize(tree);
  return finalize(
    serial,
    tree.i,
    tree.t === SerovalNodeType.Object,
    result,
  );
}

export async function serializeAsync<T>(
  source: T,
  options: AsyncParserContextOptions = {},
): Promise<string> {
  const ctx = new AsyncParserContext(options);
  const tree = await ctx.parse(source);
  const serial = new VanillaSerializerContext({
    plugins: options.plugins,
    features: ctx.features,
    markedRefs: ctx.marked,
  });
  const result = serial.serialize(tree);
  return finalize(
    serial,
    tree.i,
    tree.t === SerovalNodeType.Object,
    result,
  );
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
  const ctx = new SyncParserContext(options);
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
  const ctx = new AsyncParserContext(options);
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
  const result = ctx.serialize(source.t);
  return finalize(ctx, source.t.i, source.t.t === SerovalNodeType.Object, result);
}

export function fromJSON<T>(source: SerovalJSON, options: PluginAccessOptions = {}): T {
  const ctx = new VanillaDeserializerContext({
    plugins: options.plugins,
    markedRefs: source.m,
  });
  return ctx.deserialize(source.t) as T;
}
