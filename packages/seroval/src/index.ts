/* eslint-disable no-await-in-loop */
import { isPrimitive } from './checks';
import { Feature } from './compat';
import {
  createRef,
  createSerializationContext,
  generateTreeAsync,
  generateTreeSync,
  getRefParam,
  Options,
  resolvePatches,
  SerializationContext,
  serializePrimitive,
  serializeTree,
} from './tree';
import {
  AsyncServerValue,
  NonPrimitiveServerValue,
  PrimitiveValue,
  ServerValue,
  CommonServerValue,
  SemiPrimitiveValue,
  ErrorValue,
} from './types';

export {
  AsyncServerValue,
  ServerValue,
  PrimitiveValue,
  CommonServerValue,
  SemiPrimitiveValue,
  ErrorValue,
};

function finalize<T extends NonPrimitiveServerValue<ServerValue | AsyncServerValue>>(
  ctx: SerializationContext,
  source: T,
  result: string,
) {
  // Shared references detected
  if (ctx.vars.length) {
    const patches = resolvePatches(ctx);
    let body = result;
    if (patches) {
      // Get (or create) a ref from the source
      const index = getRefParam(ctx, createRef(ctx, source));
      if (result.startsWith(`${index}=`)) {
        body = `${result},${patches}${index}`;
      } else {
        body = `${index}=${result},${patches}${index}`;
      }
    }
    let params = ctx.vars.length > 1
      ? ctx.vars.join(',')
      : ctx.vars[0];
    // Source is probably already assigned
    if (ctx.features.has(Feature.ArrowFunction)) {
      params = ctx.vars.length > 1 || ctx.vars.length === 0
        ? `(${params})`
        : params;
      return `(${params}=>(${body}))()`;
    }
    return `(function(${params}){return ${body}})()`;
  }
  if (source.constructor === Object) {
    return `(${result})`;
  }
  return result;
}

export function serialize<T extends ServerValue>(
  source: T,
  options?: Partial<Options>,
) {
  const ctx = createSerializationContext(options);
  if (isPrimitive(source)) {
    return serializePrimitive(ctx, source);
  }
  const tree = generateTreeSync(ctx, source);
  const result = serializeTree(ctx, tree);
  return finalize(ctx, source, result);
}

export async function serializeAsync<T extends AsyncServerValue>(
  source: T,
  options?: Partial<Options>,
) {
  const ctx = createSerializationContext(options);
  if (isPrimitive(source)) {
    return serializePrimitive(ctx, source);
  }
  const tree = await generateTreeAsync(ctx, source);
  const result = serializeTree(ctx, tree);
  return finalize(ctx, source, result);
}

export function deserialize<T extends AsyncServerValue>(source: string): T {
  // eslint-disable-next-line no-eval
  return (0, eval)(source) as T;
}

export default serialize;
