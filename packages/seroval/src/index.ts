/* eslint-disable no-await-in-loop */
import { Feature } from './compat';
import type {
  SerializationContext,
  Options,
} from './tree/context';
import {
  getRefParam,
  createParserContext,
  createSerializationContext,
  getRootID,
} from './tree/context';
import parseSync from './tree/sync';
import parseAsync from './tree/async';
import deserializeTree from './tree/deserialize';
import serializeTree, { resolvePatches } from './tree/serialize';
import type { SerovalNode } from './tree/types';
import { SerovalNodeType } from './constants';

export type {
  AsyncServerValue,
  ServerValue,
  PrimitiveValue,
  CommonServerValue,
  SemiPrimitiveValue,
  ErrorValue,
} from './types';
export { Feature } from './compat';

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
  options?: Partial<Options>,
): string {
  const ctx = createParserContext(options);
  const tree = parseSync(ctx, source);
  const serial = createSerializationContext(ctx);
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
  options?: Partial<Options>,
): Promise<string> {
  const ctx = createParserContext(options);
  const tree = await parseAsync(ctx, source);
  const serial = createSerializationContext(ctx);
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
  options?: Partial<Options>,
): SerovalJSON {
  const ctx = createParserContext(options);
  return {
    t: parseSync(ctx, source),
    r: getRootID(ctx, source),
    f: ctx.features,
    m: Array.from(ctx.markedRefs),
  };
}

export async function toJSONAsync<T>(
  source: T,
  options?: Partial<Options>,
): Promise<SerovalJSON> {
  const ctx = createParserContext(options);
  return {
    t: await parseAsync(ctx, source),
    r: getRootID(ctx, source),
    f: ctx.features,
    m: Array.from(ctx.markedRefs),
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
  const serial = createSerializationContext({
    features: source.f,
    markedRefs: source.m,
  });
  return deserializeTree(serial, source.t) as T;
}

export default serialize;

export { createReference } from './reference';
