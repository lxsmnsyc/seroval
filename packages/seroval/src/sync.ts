import { forEach, join } from './array';
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
  EMPTY_ARRAY,
  createObjectIdentifierAssign,
  createObjectStringAssign,
} from './context';
import isPrimitive from './is-primitive';
import quote from './quote';
import serializePrimitive from './serialize-primitive';
import { AsyncServerValue, ServerValue } from './types';

export function lookupRefs(ctx: SerializationContext, current: ServerValue) {
  if (isPrimitive(current)) {
    return;
  }
  if (Array.isArray(current)) {
    if (insertRef(ctx, current)) {
      forEach(current, (value) => {
        lookupRefs(ctx, value);
      });
    }
  } else if (constructorCheck<Set<AsyncServerValue>>(current, Set)) {
    if (insertRef(ctx, current)) {
      for (const item of current.keys()) {
        lookupRefs(ctx, item);
      }
    }
  } else if (constructorCheck<Map<AsyncServerValue, AsyncServerValue>>(current, Map)) {
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
    forEach(Object.values(current), (value) => {
      lookupRefs(ctx, value);
    });
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
    if (current.size) {
      const values: string[] = [];

      ctx.stack.add(current);
      for (const value of current.keys()) {
        if (ctx.stack.has(value)) {
          // Received a ref, this might be a recursive ref, defer an assignment
          createSetAdd(ctx, getCurrentRef(), getRefParam(ctx, createRef(ctx, value)));
        } else {
          values.push(traverseSync(ctx, value));
        }
      }
      ctx.stack.delete(current);

      return processRef(values.length ? `new Set([${join(values, ',')}])` : EMPTY_SET);
    }
    return EMPTY_SET;
  }
  if (constructorCheck<Map<ServerValue, ServerValue>>(current, Map)) {
    if (current.size) {
      const values: string[] = [];

      ctx.stack.add(current);
      for (const [key, value] of current.entries()) {
        if (ctx.stack.has(key)) {
          const ref = getCurrentRef();
          const keyRef = getRefParam(ctx, createRef(ctx, key));
          if (ctx.stack.has(value)) {
            const valueRef = getRefParam(ctx, createRef(ctx, value));
            createMapSet(ctx, ref, keyRef, valueRef);
          } else {
            createMapSet(ctx, ref, keyRef, traverseSync(ctx, value));
          }
        } else if (ctx.stack.has(value)) {
          const valueRef = getRefParam(ctx, createRef(ctx, value));
          createMapSet(ctx, getCurrentRef(), traverseSync(ctx, key), valueRef);
        } else {
          values.push(`[${traverseSync(ctx, key)},${traverseSync(ctx, value)}]`);
        }
      }
      ctx.stack.delete(current);
      return processRef(values.length ? `new Map([${join(values, ',')}])` : EMPTY_MAP);
    }
    return EMPTY_MAP;
  }
  if (Array.isArray(current)) {
    if (current.length) {
      let values = '';

      ctx.stack.add(current);
      forEach(current, (item, i) => {
        if (i in current) {
          if (ctx.stack.has(item)) {
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
      });
      ctx.stack.delete(current);
      return processRef(`[${values}]`);
    }
    return EMPTY_ARRAY;
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    const values: string[] = [];

    ctx.stack.add(current);
    forEach(Object.entries(current), ([key, value]) => {
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      if (Number.isNaN(check) || /^([$A-Z_][0-9A-Z_$]*)$/i.test(key)) {
        if (ctx.stack.has(value)) {
          const refParam = getRefParam(ctx, createRef(ctx, value));
          createObjectIdentifierAssign(ctx, getCurrentRef(), key, refParam);
        } else {
          values.push(`${key}:${traverseSync(ctx, value)}`);
        }
      } else if (ctx.stack.has(value)) {
        const refParam = getRefParam(ctx, createRef(ctx, value));
        createObjectStringAssign(ctx, getCurrentRef(), key, refParam);
      } else {
        values.push(`${quote(key)}:${traverseSync(ctx, value)}`);
      }
    });
    ctx.stack.delete(current);
    const value = `{${join(values, ',')}}`;
    if (empty) {
      return processRef(`Object.assign(Object.create(null),${value})`);
    }
    return processRef(value);
  }
  throw new Error('Unserializable value');
}
