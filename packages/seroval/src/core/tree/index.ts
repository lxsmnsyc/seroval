import { Feature } from '../compat';
import { SerovalNodeType } from '../constants';
import type { SerovalNode } from '../types';
import type { AsyncParserContextOptions } from './async';
import AsyncParserContext from './async';
import type {
  SerializerContext,
} from './context';
import {
  createDeserializerContext,
  createSerializerContext,
  getRefParam,
} from './context';
import deserializeTree from './deserialize';
import serializeTree, { resolvePatches } from './serialize';
import type { SyncParserContextOptions } from './sync';
import SyncParserContext from './sync';

function finalize(
  ctx: SerializerContext,
  rootID: number | undefined,
  isObject: boolean,
  result: string,
): string {
  // Shared references detected
  if (rootID != null && ctx.vars.length) {
    const patches = resolvePatches(ctx);
    let body = result;
    if (patches) {
      // Get (or create) a ref from the source
      const index = getRefParam(ctx, rootID);
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
  options?: Partial<SyncParserContextOptions>,
): string {
  const ctx = new SyncParserContext(options);
  const tree = ctx.parse(source);
  const serial = createSerializerContext({
    markedRefs: ctx.marked,
    features: ctx.features,
  });
  const result = serializeTree(serial, tree);
  return finalize(
    serial,
    tree.i,
    tree.t === SerovalNodeType.Object,
    result,
  );
}

export async function serializeAsync<T>(
  source: T,
  options?: Partial<AsyncParserContextOptions>,
): Promise<string> {
  const ctx = new AsyncParserContext(options);
  const tree = await ctx.parse(source);
  const serial = createSerializerContext({
    markedRefs: ctx.marked,
    features: ctx.features,
  });
  const result = serializeTree(serial, tree);
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
  options?: Partial<SyncParserContextOptions>,
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
  options?: Partial<AsyncParserContextOptions>,
): Promise<SerovalJSON> {
  const ctx = new AsyncParserContext(options);
  return {
    t: await ctx.parse(source),
    f: ctx.features,
    m: Array.from(ctx.marked),
  };
}

export function compileJSON(source: SerovalJSON): string {
  const serial = createSerializerContext({
    features: source.f,
    markedRefs: source.m,
  });
  const result = serializeTree(serial, source.t);
  return finalize(serial, source.t.i, source.t.i === SerovalNodeType.Object, result);
}

export function fromJSON<T>(source: SerovalJSON): T {
  const serial = createDeserializerContext({
    markedRefs: source.m,
  });
  return deserializeTree(serial, source.t) as T;
}
