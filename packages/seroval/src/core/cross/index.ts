import { Feature } from '../compat';
import { GLOBAL_CONTEXT_REFERENCES } from '../keys';
import { serializeString } from '../string';
import type { AsyncCrossParserContextOptions } from './async';
import AsyncCrossParserContext from './async';
// import type { SerovalNode } from '../types';
import type {
  CrossSerializerContext,
} from './context';
import {
  createCrossSerializerContext,
} from './context';
import crossSerializeTree, { getRefExpr, resolvePatches } from './serialize';
import type { StreamCrossParserContextOptions } from './stream';
import StreamCrossParserContext from './stream';
import type { SyncCrossParserContextOptions } from './sync';
import SyncCrossParserContext from './sync';

function finalize(
  ctx: CrossSerializerContext,
  scopeId: string | undefined,
  id: number | undefined,
  result: string,
): string {
  if (id == null) {
    return result;
  }
  const patches = resolvePatches(ctx);
  const ref = getRefExpr(id);
  const params = scopeId == null ? '' : GLOBAL_CONTEXT_REFERENCES;
  const mainBody = patches ? result + ',' + patches : result;
  if (params === '') {
    return patches ? '(' + mainBody + ref + ')' : mainBody;
  }
  const args = scopeId == null ? '()' : '(' + GLOBAL_CONTEXT_REFERENCES + '["' + serializeString(scopeId) + '"])';
  const body = mainBody + (patches ? ref : '');
  if (ctx.features & Feature.ArrowFunction) {
    return '(' + params + '=>(' + body + '))' + args;
  }
  return '(function(' + params + '){return ' + body + '})' + args;
}

export function crossSerialize<T>(
  source: T,
  options?: SyncCrossParserContextOptions,
): string {
  const ctx = new SyncCrossParserContext(options);
  const tree = ctx.parse(source);
  const serial = createCrossSerializerContext({
    features: ctx.features,
  });
  const result = crossSerializeTree(serial, tree);
  return finalize(
    serial,
    ctx.scopeId,
    tree.i,
    result,
  );
}

export async function crossSerializeAsync<T>(
  source: T,
  options?: AsyncCrossParserContextOptions,
): Promise<string> {
  const ctx = new AsyncCrossParserContext(options);
  const tree = await ctx.parse(source);
  const serial = createCrossSerializerContext({
    features: ctx.features,
  });
  const result = crossSerializeTree(serial, tree);
  return finalize(
    serial,
    ctx.scopeId,
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

export interface CrossSerializeStreamOptions extends Omit<StreamCrossParserContextOptions, 'onParse'> {
  onSerialize: (data: string, initial: boolean) => void;
}

export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): () => void {
  const ctx = new StreamCrossParserContext({
    scopeId: options.scopeId,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial): void {
      const serial = createCrossSerializerContext({
        features: ctx.features,
      });

      options.onSerialize(
        finalize(
          serial,
          ctx.scopeId,
          node.i,
          crossSerializeTree(serial, node),
        ),
        initial,
      );
    },
    onDone: options.onDone,
  });

  ctx.onParse(ctx.parse(source), true);

  if (ctx.pending <= 0) {
    ctx.onDone();
    ctx.alive = false;
  }

  return () => {
    if (ctx.alive) {
      ctx.alive = false;
      ctx.onDone();
    }
  };
}
