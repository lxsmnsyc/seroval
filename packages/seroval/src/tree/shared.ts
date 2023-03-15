import assert from '../assert';
import { Feature } from '../compat';
import { SerializationContext, ParserContext } from '../context';
import quote from '../quote';
import {
  AsyncServerValue,
  ErrorValue,
  NonPrimitiveServerValue,
  PrimitiveValue,
} from '../types';
import { SerovalNode, SerovalReferenceNode, SerovalNodeType } from './types';

export function getErrorConstructor(error: ErrorValue) {
  if (error instanceof EvalError) {
    return 'EvalError';
  }
  if (error instanceof RangeError) {
    return 'RangeError';
  }
  if (error instanceof ReferenceError) {
    return 'ReferenceError';
  }
  if (error instanceof SyntaxError) {
    return 'SyntaxError';
  }
  if (error instanceof TypeError) {
    return 'TypeError';
  }
  if (error instanceof URIError) {
    return 'URIError';
  }
  return 'Error';
}

export function getErrorOptions(
  error: Error,
) {
  let options: Record<string, any> | undefined;
  const constructor = getErrorConstructor(error);
  // Name has been modified
  if (error.name !== constructor) {
    options = { name: error.name };
  } else if (error.constructor.name !== constructor) {
    // Otherwise, name is overriden because
    // the Error class is extended
    options = { name: error.constructor.name };
  }
  const names = Object.getOwnPropertyNames(error);
  for (const name of names) {
    if (name !== 'name' && name !== 'message') {
      options = options || {};
      options[name] = error[name as keyof Error];
    }
  }
  return options;
}

export function getIterableOptions(obj: Iterable<any>) {
  const names = Object.getOwnPropertyNames(obj);
  if (names.length) {
    const options: Record<string, unknown> = {};
    for (const name of names) {
      options[name] = obj[name as unknown as keyof typeof obj];
    }
    return options;
  }
  return undefined;
}

export function isReferenceInStack(
  ctx: SerializationContext,
  node: SerovalNode,
): node is SerovalReferenceNode {
  return node.t === SerovalNodeType.Reference && ctx.stack.includes(node.i);
}

export function generateSemiPrimitiveValue(
  ctx: ParserContext,
  current: NonPrimitiveServerValue<AsyncServerValue>,
  id: number,
): SerovalNode | undefined {
  const cs = current.constructor;
  switch (cs) {
    case Date:
      return {
        t: SerovalNodeType.Date,
        i: id,
        a: undefined,
        s: (current as Date).toISOString(),
        l: undefined,
        m: undefined,
        c: undefined,
        d: undefined,
        n: undefined,
      };
    case RegExp:
      return {
        t: SerovalNodeType.RegExp,
        i: id,
        a: undefined,
        s: String(current),
        l: undefined,
        m: undefined,
        c: undefined,
        d: undefined,
        n: undefined,
      };
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array: {
      const constructor = cs.name;
      assert(ctx.features & Feature.TypedArray, `Unsupported value type "${constructor}"`);
      return {
        t: SerovalNodeType.TypedArray,
        i: id,
        a: undefined,
        s: current.toString(),
        l: (current as Int8Array).byteOffset,
        m: undefined,
        c: constructor,
        d: undefined,
        n: undefined,
      };
    }
    case BigInt64Array:
    case BigUint64Array: {
      const constructor = cs.name;
      assert(
        ctx.features & (Feature.BigIntTypedArray),
        `Unsupported value type "${constructor}"`,
      );
      let result = '';
      const cap = (current as BigInt64Array).length - 1;
      for (let i = 0; i < cap; i++) {
        result += `${(current as BigInt64Array)[i]}n,`;
      }
      result += `"${(current as BigInt64Array)[cap]}"`;
      return {
        t: SerovalNodeType.TypedArray,
        i: id,
        a: undefined,
        s: result,
        l: (current as BigInt64Array).byteOffset,
        m: undefined,
        c: constructor,
        d: undefined,
        n: undefined,
      };
    }
    default:
      return undefined;
  }
}

export function serializePrimitive(
  value: PrimitiveValue,
): string | number | null {
  // Shortened forms
  if (value === true) {
    return '!0';
  }
  if (value === false) {
    return '!1';
  }
  if (value === undefined) {
    return 'void 0';
  }
  if (value === null) {
    return null;
  }
  if (typeof value === 'string') {
    return quote(value);
  }
  // negative 0 isn't the same as 0
  if (Object.is(value, -0)) {
    return '-0';
  }
  if (Object.is(value, Infinity)) {
    return '1/0';
  }
  if (Object.is(value, -Infinity)) {
    return '-1/0';
  }
  return value;
}
