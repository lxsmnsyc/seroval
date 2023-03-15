import assert from '../assert';
import { constructorCheck } from '../checks';
import { Feature } from '../compat';
import { SerializationContext, ParserContext, markRef } from '../context';
import quote from '../quote';
import { ErrorValue, PrimitiveValue } from '../types';
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
  current: unknown,
  id: number,
): SerovalNode | undefined {
  if (constructorCheck<Date>(current, Date)) {
    return {
      t: SerovalNodeType.Date,
      i: id,
      a: undefined,
      s: current.toISOString(),
      l: undefined,
      m: undefined,
      c: undefined,
      d: undefined,
      n: undefined,
    };
  }
  if (constructorCheck<RegExp>(current, RegExp)) {
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
  }
  if (
    constructorCheck<Int8Array>(current, Int8Array)
    || constructorCheck<Int16Array>(current, Int16Array)
    || constructorCheck<Int32Array>(current, Int32Array)
    || constructorCheck<Uint8Array>(current, Uint8Array)
    || constructorCheck<Uint16Array>(current, Uint16Array)
    || constructorCheck<Uint32Array>(current, Uint32Array)
    || constructorCheck<Uint8ClampedArray>(current, Uint8ClampedArray)
    || constructorCheck<Float32Array>(current, Float32Array)
    || constructorCheck<Float64Array>(current, Float64Array)
  ) {
    const constructor = current.constructor.name;
    assert(ctx.features & Feature.TypedArray, `Unsupported value type "${constructor}"`);
    return {
      t: SerovalNodeType.TypedArray,
      i: id,
      a: undefined,
      s: current.toString(),
      l: current.byteOffset,
      m: undefined,
      c: constructor,
      d: undefined,
      n: undefined,
    };
  }
  if (
    constructorCheck<BigInt64Array>(current, BigInt64Array)
    || constructorCheck<BigUint64Array>(current, BigUint64Array)
  ) {
    const constructor = current.constructor.name;
    assert(
      ctx.features & (Feature.BigIntTypedArray),
      `Unsupported value type "${constructor}"`,
    );
    let result = '';
    const cap = current.length - 1;
    for (let i = 0; i < cap; i++) {
      result += `${current[i]}n,`;
    }
    result += `"${current[cap]}"`;
    return {
      t: SerovalNodeType.TypedArray,
      i: id,
      a: undefined,
      s: result,
      l: current.byteOffset,
      m: undefined,
      c: constructor,
      d: undefined,
      n: undefined,
    };
  }
  return undefined;
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
