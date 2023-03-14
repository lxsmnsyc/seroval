/* eslint-disable no-await-in-loop */
import { isPrimitive } from './checks';
import { isFeatureSupported } from './compat';
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

function finalize<T extends ServerValue | AsyncServerValue>(
  ctx: SerializationContext,
  source: NonPrimitiveServerValue<T>,
  result: string,
) {
  // Shared references detected
  if (ctx.vars.length) {
    // Get (or create) a ref from the source
    const index = getRefParam(ctx, createRef(ctx, source));
    const patches = resolvePatches(ctx);
    const params = ctx.vars.length > 1
      ? `(${ctx.vars.join(',')})`
      : ctx.vars[0];
    // Source is probably already assigned
    if (isFeatureSupported('arrow-function', ctx.targets)) {
      if (result.startsWith(`${index}=`)) {
        return `(${params}=>(${result},${patches}${index}))()`;
      }
      return `(${params}=>(${index}=${result},${patches}${index}))()`;
    }
    if (result.startsWith(`${index}=`)) {
      return `(function(${params}){return ${result},${patches}${index}})()`;
    }
    return `(function(${params}){return ${index}=${result},${patches}${index}}))()`;
  }
  if (source.constructor === Object) {
    return `(${result})`;
  }
  return result;
}

export function serialize(source: ServerValue, options?: Partial<Options>) {
  const ctx = createSerializationContext(options);
  if (isPrimitive(source)) {
    return serializePrimitive(ctx, source);
  }
  const tree = generateTreeSync(ctx, source);
  const result = serializeTree(ctx, tree);
  return finalize(ctx, source, result);
}

export async function serializeAsync(source: AsyncServerValue, options?: Partial<Options>) {
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
