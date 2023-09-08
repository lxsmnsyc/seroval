import { Feature } from '../compat';
import {
  CROSS_IIFE_ARGUMENTS,
  CROSS_IIFE_PARAMS,
  ROOT_REFERENCE,
} from '../keys';
import type { SerovalNode } from '../types';
import parseAsync from './async';
import type {
  CrossParserContextOptions, CrossSerializerContext,
} from './context';
import {
  createCrossParserContext,
  createCrossSerializerContext,
} from './context';
import serializeTree, { getRefExpr, resolvePatches } from './serialize';
import parseSync from './sync';

function finalize(
  ctx: CrossSerializerContext,
  id: number | undefined,
  result: string,
): string {
  const patches = resolvePatches(ctx);

  if (ctx.features & Feature.ArrowFunction) {
    if (patches) {
      if (id == null) {
        const params = '(' + CROSS_IIFE_PARAMS + ',' + ROOT_REFERENCE + ')';
        const body = ROOT_REFERENCE + '=' + result + ',' + patches + ROOT_REFERENCE;
        return '(' + params + '=>(' + body + '))';
      }
      return '((' + CROSS_IIFE_PARAMS + ')=>(' + result + ',' + patches + getRefExpr(id) + '))' + CROSS_IIFE_ARGUMENTS;
    }
    return '((' + CROSS_IIFE_PARAMS + ')=>' + result + ')' + CROSS_IIFE_ARGUMENTS;
  }
  if (patches) {
    if (id == null) {
      const params = '(' + CROSS_IIFE_PARAMS + ',' + ROOT_REFERENCE + ')';
      const body = ROOT_REFERENCE + '=' + result + ',' + patches + ROOT_REFERENCE;
      return '(function' + params + '{return ' + body + '})';
    }
    return '(function(' + CROSS_IIFE_PARAMS + '){return ' + result + ',' + patches + getRefExpr(id) + '})' + CROSS_IIFE_ARGUMENTS;
  }
  return '(function(' + CROSS_IIFE_PARAMS + '){return ' + result + '})' + CROSS_IIFE_ARGUMENTS;
}

export function crossSerialize<T>(
  source: T,
  options?: Partial<CrossParserContextOptions>,
): string {
  const ctx = createCrossParserContext(options);
  const tree = parseSync(ctx, source);
  const serial = createCrossSerializerContext({
    features: ctx.features,
  });
  const result = serializeTree(serial, tree);
  return finalize(
    serial,
    tree.i,
    result,
  );
}

export async function crossSerializeAsync<T>(
  source: T,
  options?: Partial<CrossParserContextOptions>,
): Promise<string> {
  const ctx = createCrossParserContext(options);
  const tree = await parseAsync(ctx, source);
  const serial = createCrossSerializerContext({
    features: ctx.features,
  });
  const result = serializeTree(serial, tree);
  return finalize(
    serial,
    tree.i,
    result,
  );
}

export interface SerovalCrossJSON {
  t: SerovalNode;
  f: number;
}

export function toCrossJSON<T>(
  source: T,
  options?: Partial<CrossParserContextOptions>,
): SerovalCrossJSON {
  const ctx = createCrossParserContext(options);
  return {
    t: parseSync(ctx, source),
    f: ctx.features,
  };
}

export async function toCrossJSONAsync<T>(
  source: T,
  options?: Partial<CrossParserContextOptions>,
): Promise<SerovalCrossJSON> {
  const ctx = createCrossParserContext(options);
  return {
    t: await parseAsync(ctx, source),
    f: ctx.features,
  };
}

export function compileCrossJSON(source: SerovalCrossJSON): string {
  const serial = createCrossSerializerContext({
    features: source.f,
  });
  const result = serializeTree(serial, source.t);
  return finalize(
    serial,
    source.t.i,
    result,
  );
}

// export function fromJSON<T>(source: SerovalJSON): T {
//   const serial = createDeserializerContext({
//     markedRefs: source.m,
//   });
//   return deserializeTree(serial, source.t) as T;
// }
