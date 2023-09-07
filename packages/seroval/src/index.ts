/* eslint-disable no-await-in-loop */
import { Feature } from './core/compat';
import type {
  SerializationContext,
  ParserOptions,
} from './core/tree/context';
import {
  getRefParam,
  createParserContext,
  createSerializationContext,
  getRootID,
  createDeserializationContext,
} from './core/tree/context';
import parseSync from './core/tree/sync';
import parseAsync from './core/tree/async';
import deserializeTree from './core/tree/deserialize';
import serializeTree, { resolvePatches } from './core/tree/serialize';
import type { SerovalNode } from './core/types';
import { SerovalNodeType } from './core/constants';

export type {
  AsyncServerValue,
  ServerValue,
  PrimitiveValue,
  CommonServerValue,
  SemiPrimitiveValue,
  ErrorValue,
} from './types';
export { Feature } from './core/compat';

function finalize(
  ctx: SerializationContext,
  rootID: number,
  isObject: boolean,
  result: string,
): string {
  // Shared references detected
  if (ctx.vars.length) {
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
  options?: Partial<ParserOptions>,
): string {
  const ctx = createParserContext(options);
  const tree = parseSync(ctx, source);
  const serial = createSerializationContext({
    markedRefs: ctx.reference.marked,
    features: ctx.features,
  });
  const result = serializeTree(serial, tree);
  return finalize(
    serial,
    getRootID(ctx, source),
    tree.t === SerovalNodeType.Object,
    result,
  );
}

export async function serializeAsync<T>(
  source: T,
  options?: Partial<ParserOptions>,
): Promise<string> {
  const ctx = createParserContext(options);
  const tree = await parseAsync(ctx, source);
  const serial = createSerializationContext({
    markedRefs: ctx.reference.marked,
    features: ctx.features,
  });
  const result = serializeTree(serial, tree);
  return finalize(
    serial,
    getRootID(ctx, source),
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
  r: number;
  f: number;
  m: number[];
}

export function toJSON<T>(
  source: T,
  options?: Partial<ParserOptions>,
): SerovalJSON {
  const ctx = createParserContext(options);
  return {
    t: parseSync(ctx, source),
    r: getRootID(ctx, source),
    f: ctx.features,
    m: Array.from(ctx.reference.marked),
  };
}

export async function toJSONAsync<T>(
  source: T,
  options?: Partial<ParserOptions>,
): Promise<SerovalJSON> {
  const ctx = createParserContext(options);
  return {
    t: await parseAsync(ctx, source),
    r: getRootID(ctx, source),
    f: ctx.features,
    m: Array.from(ctx.reference.marked),
  };
}

export function compileJSON(source: SerovalJSON): string {
  const serial = createSerializationContext({
    features: source.f,
    markedRefs: source.m,
  });
  const result = serializeTree(serial, source.t);
  return finalize(serial, source.r, source.t.i === SerovalNodeType.Object, result);
}

export function fromJSON<T>(source: SerovalJSON): T {
  const serial = createDeserializationContext({
    markedRefs: source.m,
  });
  return deserializeTree(serial, source.t) as T;
}

export default serialize;

export { createReference } from './core/reference';
