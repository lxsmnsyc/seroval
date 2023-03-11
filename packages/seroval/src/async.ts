/* eslint-disable no-await-in-loop */
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
  createObjectComputedAssign,
} from './context';
import isPrimitive from './is-primitive';
import isPromise from './is-promise';
import quote from './quote';
import serializePrimitive from './serialize-primitive';
import { ServerValue, AsyncServerValue } from './types';

export async function lookupRefsAsync(
  ctx: SerializationContext,
  current: AsyncServerValue,
) {
  if (isPrimitive(current)) {
    return;
  }
  if (isPromise(current)) {
    if (insertRef(ctx, current)) {
      await current.then((value) => lookupRefsAsync(ctx, value));
    }
  } else if (Array.isArray(current)) {
    if (insertRef(ctx, current)) {
      for (const value of current) {
        await lookupRefsAsync(ctx, value);
      }
    }
  } else if (constructorCheck<Set<AsyncServerValue>>(current, Set)) {
    if (insertRef(ctx, current)) {
      for (const item of current.keys()) {
        await lookupRefsAsync(ctx, item);
      }
    }
  } else if (constructorCheck<Map<AsyncServerValue, AsyncServerValue>>(current, Map)) {
    if (insertRef(ctx, current)) {
      for (const [key, value] of current.entries()) {
        await lookupRefsAsync(ctx, key);
        await lookupRefsAsync(ctx, value);
      }
    }
  } else if (
    (current.constructor === Object || current.constructor == null)
    && insertRef(ctx, current)
  ) {
    for (const value of Object.values(current)) {
      await lookupRefsAsync(ctx, value);
    }
  }
}

export async function traverseAsync(
  ctx: SerializationContext,
  current: AsyncServerValue,
): Promise<string> {
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
  if (isPromise(current)) {
    return current.then(async (value) => {
      ctx.stack.add(current);
      let result: string;
      if (ctx.stack.has(value)) {
        const refParam = getRefParam(ctx, createRef(ctx, value));
        result = `Promise.resolve().then(()=>${refParam})`;
      } else {
        result = `Promise.resolve(${await traverseAsync(ctx, value)})`;
      }
      ctx.stack.delete(current);
      return processRef(result);
    });
  }
  // Transform Set
  if (constructorCheck<Set<AsyncServerValue>>(current, Set)) {
    if (current.size) {
      const values: string[] = [];

      ctx.stack.add(current);
      for (const value of current.keys()) {
        if (ctx.stack.has(value)) {
          // Received a ref, this might be a recursive ref, defer an assignment
          createSetAdd(ctx, getCurrentRef(), getRefParam(ctx, createRef(ctx, value)));
        } else {
          values.push(await traverseAsync(ctx, value));
        }
      }
      ctx.stack.delete(current);

      return processRef(values.length ? `new Set([${values.join(',')}])` : EMPTY_SET);
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
            const valueResult = await traverseAsync(ctx, value);
            createMapSet(ctx, ref, keyRef, valueResult);
          }
        } else if (ctx.stack.has(value)) {
          const valueRef = getRefParam(ctx, createRef(ctx, value));
          const keyResult = await traverseAsync(ctx, key);
          createMapSet(ctx, getCurrentRef(), keyResult, valueRef);
        } else {
          const keyResult = await traverseAsync(ctx, key);
          const valueResult = await traverseAsync(ctx, value);
          values.push(`[${keyResult},${valueResult}]`);
        }
      }
      ctx.stack.delete(current);
      return processRef(values.length ? `new Map([${values.join(',')}])` : EMPTY_MAP);
    }
    return EMPTY_MAP;
  }
  if (Array.isArray(current)) {
    if (current.length) {
      let values = '';

      ctx.stack.add(current);
      for (let i = 0, len = current.length; i < len; i += 1) {
        if (i in current) {
          const item = current[i];
          if (ctx.stack.has(item)) {
            const refParam = getRefParam(ctx, createRef(ctx, item));
            createArrayAssign(ctx, getCurrentRef(), i, refParam);
            values += ',';
          } else {
            values += await traverseAsync(ctx, item);
            if (i < current.length - 1) {
              values += ',';
            }
          }
        } else {
          values += ',';
        }
      }
      ctx.stack.delete(current);
      return processRef(`[${values}]`);
    }
    return EMPTY_ARRAY;
  }
  const empty = current.constructor == null;
  if (current.constructor === Object || empty) {
    const values: string[] = [];

    ctx.stack.add(current);
    for (const [key, value] of Object.entries(current)) {
      const check = Number(key);
      // Test if key is a valid number or JS identifier
      // so that we don't have to serialize the key and wrap with brackets
      if (
        check >= 0
        || (Number.isNaN(check) && /^([$A-Z_][0-9A-Z_$]*)$/i.test(key))
      ) {
        if (ctx.stack.has(value)) {
          const ref = getCurrentRef();
          const refParam = getRefParam(ctx, createRef(ctx, value));
          if (Number.isNaN(check)) {
            createObjectIdentifierAssign(ctx, ref, key, refParam);
          } else {
            createObjectComputedAssign(ctx, ref, key, refParam);
          }
        } else {
          const valueResult = await traverseAsync(ctx, value as AsyncServerValue);
          values.push(`${key}:${valueResult}`);
        }
      } else if (ctx.stack.has(value)) {
        const refParam = getRefParam(ctx, createRef(ctx, value));
        createObjectComputedAssign(ctx, getCurrentRef(), quote(key), refParam);
      } else {
        const valueResult = await traverseAsync(ctx, value as AsyncServerValue);
        values.push(`${quote(key)}:${valueResult}`);
      }
    }
    ctx.stack.delete(current);
    const value = `{${values.join(',')}}`;
    if (empty) {
      return processRef(`Object.assign(Object.create(null),${value})`);
    }
    return processRef(value);
  }
  throw new Error('Unserializable value');
}
