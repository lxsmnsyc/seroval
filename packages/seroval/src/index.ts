/* eslint-disable no-await-in-loop */
import { join } from './array';
import { lookupRefsAsync, traverseAsync } from './async';
import {
  SerializationContext,
  getRefParam,
  createRef,
  resolvePatches,
  createSerializationContext,
} from './context';
import isPrimitive from './is-primitive';
import serializePrimitive from './serialize-primitive';
import { lookupRefs, traverseSync } from './sync';
import {
  AsyncServerValue,
  NonPrimitiveServerValue,
  ServerValue,
} from './types';

export { AsyncServerValue, ServerValue };

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
      ? `(${join(ctx.vars, ',')})`
      : ctx.vars[0];
    // Source is probably already assigned
    if (result.startsWith(`${index}=`)) {
      return `(${params}=>(${result},${patches}${index}))()`;
    }
    return `(${params}=>(${index}=${result},${patches}${index}))()`;
  }
  if (source.constructor === Object) {
    return `(${result})`;
  }
  return result;
}

export function serialize(source: ServerValue) {
  if (isPrimitive(source)) {
    return serializePrimitive(source);
  }
  const ctx = createSerializationContext();
  // Lookup possible shared references
  lookupRefs(ctx, source);
  // Add shared references to refs
  for (const [key, value] of ctx.refCount.entries()) {
    if (value > 1) {
      createRef(ctx, key);
    }
  }
  // Get top-level serialization
  const result = traverseSync(ctx, source);
  if (typeof result !== 'string') {
    throw new Error('Unreachable error');
  }
  return finalize(ctx, source, result);
}

export async function serializeAsync(source: AsyncServerValue) {
  if (isPrimitive(source)) {
    return serializePrimitive(source);
  }
  const ctx = createSerializationContext();
  // Lookup possible shared references
  await lookupRefsAsync(ctx, source);
  // Add shared references to refs
  for (const [key, value] of ctx.refCount.entries()) {
    if (value > 1) {
      createRef(ctx, key);
    }
  }
  // Get top-level serialization
  const result = await traverseAsync(ctx, source);
  if (typeof result !== 'string') {
    throw new Error('Unreachable error');
  }
  return finalize(ctx, source, result);
}

export function deserialize<T extends ServerValue>(source: string): ServerValue {
  // eslint-disable-next-line no-eval
  return (0, eval)(source) as T;
}

export default serialize;
