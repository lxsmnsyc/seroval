import { Feature } from '../compat';
import {
  ROOT_REFERENCE,
} from '../keys';
// import type { SerovalNode } from '../types';
import parseAsync from './async';
import type {
  CrossParserContextOptions,
  CrossSerializerContext,
} from './context';
import {
  createCrossParserContext,
  createCrossSerializerContext,
  createStreamingCrossParserContext,
} from './context';
import crossSerializeTree, { getRefExpr, resolvePatches } from './serialize';
import crossParseStream from './stream';
import parseSync from './sync';

function finalize(
  ctx: CrossSerializerContext,
  id: number | undefined,
  result: string,
): string {
  const patches = resolvePatches(ctx);
  if (patches) {
    if (id == null) {
      if (ctx.features & Feature.ArrowFunction) {
        const params = '(' + ROOT_REFERENCE + ')';
        const body = ROOT_REFERENCE + '=' + result + ',' + patches + ROOT_REFERENCE;
        return '(' + params + '=>(' + body + '))()';
      }
      const params = '(' + ROOT_REFERENCE + ')';
      const body = ROOT_REFERENCE + '=' + result + ',' + patches + ROOT_REFERENCE;
      return '(function' + params + '{return ' + body + '})()';
    }
    return '(' + result + ',' + patches + getRefExpr(id) + ')';
  }
  return result;
}

export function crossSerialize<T>(
  source: T,
  options?: CrossParserContextOptions,
): string {
  const ctx = createCrossParserContext(options);
  const tree = parseSync(ctx, source);
  const serial = createCrossSerializerContext({
    features: ctx.features,
  });
  const result = crossSerializeTree(serial, tree);
  return finalize(
    serial,
    tree.i,
    result,
  );
}

export async function crossSerializeAsync<T>(
  source: T,
  options?: CrossParserContextOptions,
): Promise<string> {
  const ctx = createCrossParserContext(options);
  const tree = await parseAsync(ctx, source);
  const serial = createCrossSerializerContext({
    features: ctx.features,
  });
  const result = crossSerializeTree(serial, tree);
  return finalize(
    serial,
    tree.i,
    result,
  );
}

// export interface SerovalCrossJSON {
//   t: SerovalNode;
//   f: number;
// }

// export function toCrossJSON<T>(
//   source: T,
//   options?: CrossParserContextOptions,
// ): SerovalCrossJSON {
//   const ctx = createCrossParserContext(options);
//   return {
//     t: parseSync(ctx, source),
//     f: ctx.features,
//   };
// }

// export async function toCrossJSONAsync<T>(
//   source: T,
//   options?: CrossParserContextOptions,
// ): Promise<SerovalCrossJSON> {
//   const ctx = createCrossParserContext(options);
//   return {
//     t: await parseAsync(ctx, source),
//     f: ctx.features,
//   };
// }

// export function compileCrossJSON(source: SerovalCrossJSON): string {
//   const serial = createCrossSerializerContext({
//     features: source.f,
//   });
//   const result = crossSerializeTree(serial, source.t);
//   return finalize(
//     serial,
//     source.t.i,
//     result,
//   );
// }

// export function fromJSON<T>(source: SerovalJSON): T {
//   const serial = createDeserializerContext({
//     markedRefs: source.m,
//   });
//   return deserializeTree(serial, source.t) as T;
// }

export interface CrossSerializeStreamOptions extends CrossParserContextOptions {
  onSerialize: (data: string, initial: boolean) => void;
}

export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): () => void {
  const ctx = createStreamingCrossParserContext({
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial) {
      const serial = createCrossSerializerContext({
        features: ctx.features,
      });

      options.onSerialize(
        finalize(
          serial,
          node.i,
          crossSerializeTree(serial, node),
        ),
        initial,
      );
    },
  });

  ctx.onParse(crossParseStream(ctx, source), true);

  return () => {
    ctx.alive = false;
  };
}
