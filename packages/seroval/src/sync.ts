import {
  SerializationContext,
  insertRef,
  constructorCheck,
  getRefParam,
  createRef,
  assignRef,
  createSetAdd,
  EMPTY_SET,
  createMapSet,
  EMPTY_MAP,
  createArrayAssign,
  createObjectIdentifierAssign,
  createObjectComputedAssign,
} from './context';
import isPrimitive from './is-primitive';
import quote from './quote';
import serializePrimitive from './serialize-primitive';
import { ServerValue } from './types';

export function lookupRefs(ctx: SerializationContext, current: ServerValue) {
  if (isPrimitive(current)) {
    return;
  }
  if (Array.isArray(current)) {
    if (insertRef(ctx, current)) {
      for (const value of current) {
        lookupRefs(ctx, value);
      }
    }
  } else if (constructorCheck<Set<ServerValue>>(current, Set)) {
    if (insertRef(ctx, current)) {
      for (const item of current.keys()) {
        lookupRefs(ctx, item);
      }
    }
  } else if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    if (insertRef(ctx, current)) {
      for (const [key, value] of current.entries()) {
        lookupRefs(ctx, key);
        lookupRefs(ctx, value);
      }
    }
  } else if (
    (current.constructor === Object || current.constructor == null)
    && insertRef(ctx, current)
  ) {
    for (const value of Object.values(current)) {
      lookupRefs(ctx, value as ServerValue);
    }
  }
}

export function traverseSync(
  ctx: SerializationContext,
  current: ServerValue,
): string {
  // Skip primitives
  if (isPrimitive(current)) {
    return serializePrimitive(current);
  }
  // Get reference of the current object
  let refResult = ctx.refs.get(current);
  if (refResult != null) {
    // Return the reference if already assigned a value
    if (ctx.assignedRefs.has(refResult)) {
      return getRefParam(ctx, refResult);
    }
    // Early sign (to prevent recursion)
    ctx.assignedRefs.add(refResult);
  }
  function getCurrentRef() {
    // This object received a ref, we must generate a setter ref
    if (refResult == null) {
      refResult = createRef(ctx, current);
    }
    return refResult;
  }
  function processRef(value: string) {
    if (refResult != null) {
      return assignRef(ctx, refResult, value);
    }
    return value;
  }
  // Transform Set
  if (constructorCheck<Set<ServerValue>>(current, Set)) {
    const values: string[] = [];

    ctx.stack.push(current);
    for (const value of current.keys()) {
      if (ctx.stack.includes(value)) {
        // Received a ref, this might be a recursive ref, defer an assignment
        createSetAdd(ctx, getCurrentRef(), getRefParam(ctx, createRef(ctx, value)));
      } else {
        values.push(traverseSync(ctx, value));
      }
    }
    ctx.stack.pop();

    return processRef(values.length ? `new Set([${values.join(',')}])` : EMPTY_SET);
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    const values: string[] = [];

    ctx.stack.push(current);
    for (const [key, value] of current.entries()) {
      if (ctx.stack.includes(key)) {
        const ref = getCurrentRef();
        const keyRef = getRefParam(ctx, createRef(ctx, key));
        if (ctx.stack.includes(value)) {
          const valueRef = getRefParam(ctx, createRef(ctx, value));
          createMapSet(ctx, ref, keyRef, valueRef);
        } else {
          const parent = ctx.stack;
          ctx.stack = [];
          createMapSet(ctx, ref, keyRef, traverseSync(ctx, value));
          ctx.stack = parent;
        }
      } else if (ctx.stack.includes(value)) {
        const valueRef = getRefParam(ctx, createRef(ctx, value));
        const parent = ctx.stack;
        ctx.stack = [];
        createMapSet(ctx, getCurrentRef(), traverseSync(ctx, key), valueRef);
        ctx.stack = parent;
      } else {
        values.push(`[${traverseSync(ctx, key)},${traverseSync(ctx, value)}]`);
      }
    }
    ctx.stack.pop();
    return processRef(values.length ? `new Map([${values.join(',')}])` : EMPTY_MAP);
  }
  if (Array.isArray(current)) {
    let values = '';

    ctx.stack.push(current);
    for (let i = 0, len = current.length; i < len; i++) {
      const item = current[i];
      if (i in current) {
        if (ctx.stack.includes(item)) {
          const refParam = getRefParam(ctx, createRef(ctx, item));
          createArrayAssign(ctx, getCurrentRef(), i, refParam);
          values += ',';
        } else {
          values += traverseSync(ctx, item);
          if (i < current.length - 1) {
            values += ',';
          }
        }
      } else {
        values += ',';
      }
    }
    ctx.stack.pop();
    return processRef(`[${values}]`);
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    const values: string[] = [];

    ctx.stack.push(current);
    for (const [key, value] of Object.entries(current)) {
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      if (
        check >= 0
        || (Number.isNaN(check) && /^([$A-Z_][0-9A-Z_$]*)$/i.test(key))
      ) {
        if (ctx.stack.includes(value)) {
          const ref = getCurrentRef();
          const refParam = getRefParam(ctx, createRef(ctx, value));
          if (!Number.isNaN(check)) {
            createObjectComputedAssign(ctx, ref, key, refParam);
          } else {
            createObjectIdentifierAssign(ctx, ref, key, refParam);
          }
        } else {
          values.push(`${key}:${traverseSync(ctx, value as ServerValue)}`);
        }
      } else if (ctx.stack.includes(value)) {
        const refParam = getRefParam(ctx, createRef(ctx, value));
        createObjectComputedAssign(ctx, getCurrentRef(), quote(key), refParam);
      } else {
        values.push(`${quote(key)}:${traverseSync(ctx, value as ServerValue)}`);
      }
    }
    ctx.stack.pop();
    const value = `{${values.join(',')}}`;
    if (empty) {
      return processRef(`Object.assign(Object.create(null),${value})`);
    }
    return processRef(value);
  }
  throw new Error('Unserializable value');
}
