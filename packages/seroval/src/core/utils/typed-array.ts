import { SerovalUnknownTypedArrayError } from '../errors';

type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Int16ArrayConstructor
  | Int32ArrayConstructor
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

export type TypedArrayValue =
  | Int8Array
  | Int16Array
  | Int32Array
  | Uint8Array
  | Uint16Array
  | Uint32Array
  | Uint8ClampedArray
  | Float32Array
  | Float64Array;

export type BigIntTypedArrayValue = BigInt64Array | BigUint64Array;

const TYPED_ARRAY_CONSTRUCTORS: Record<string, TypedArrayConstructor> = {
  Int8Array,
  Int16Array,
  Int32Array,
  Uint8Array,
  Uint16Array,
  Uint32Array,
  Uint8ClampedArray,
  Float32Array,
  Float64Array,
  BigInt64Array,
  BigUint64Array,
};

export function getTypedArrayConstructor(name: string): TypedArrayConstructor {
  if (Object.hasOwn(TYPED_ARRAY_CONSTRUCTORS, name)) {
    return TYPED_ARRAY_CONSTRUCTORS[name];
  }
  throw new SerovalUnknownTypedArrayError(name);
}
