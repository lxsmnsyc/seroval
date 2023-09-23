import { Feature } from '../compat';
import { GLOBAL_CONTEXT_REFERENCES, ROOT_REFERENCE } from '../keys';
import { serializeString } from '../string';
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
  scopeId: string | undefined,
  id: number | undefined,
  result: string,
): string {
  const patches = resolvePatches(ctx);
  const ref = id == null ? '' : getRefExpr(id);
  let params = '';
  if (scopeId != null) {
    params += GLOBAL_CONTEXT_REFERENCES;
  }
  if (id == null && !ref && patches) {
    if (params !== '') {
      params += ',';
    }
    params += ROOT_REFERENCE;
  }
  const mainBody = patches ? result + ',' + patches : result;
  if (params === '') {
    return patches ? '(' + mainBody + ref + ')' : mainBody;
  }
  const tail = id == null ? ROOT_REFERENCE : ref;
  const header = id == null ? ROOT_REFERENCE + '=' : '';
  const args = scopeId == null ? '()' : '(' + GLOBAL_CONTEXT_REFERENCES + '["' + serializeString(scopeId) + '"])';
  const body = header + mainBody + (patches ? tail : '');
  if (ctx.features & Feature.ArrowFunction) {
    return '((' + params + ')=>(' + body + '))' + args;
  }
  return '(function(' + params + '){return ' + body + '})' + args;
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
    ctx.scopeId,
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

export interface CrossSerializeStreamOptions extends CrossParserContextOptions {
  onSerialize: (data: string, initial: boolean) => void;
  onDone?: () => void;
}

export function crossSerializeStream<T>(
  source: T,
  options: CrossSerializeStreamOptions,
): () => void {
  const ctx = createStreamingCrossParserContext({
    scopeId: options.scopeId,
    refs: options.refs,
    disabledFeatures: options.disabledFeatures,
    onParse(node, initial) {
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

  ctx.onParse(crossParseStream(ctx, source), true);

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
