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

export function getTypedArrayConstructor(name: string): TypedArrayConstructor {
  switch (name) {
    case 'Int8Array':
      return Int8Array;
    case 'Int16Array':
      return Int16Array;
    case 'Int32Array':
      return Int32Array;
    case 'Uint8Array':
      return Uint8Array;
    case 'Uint16Array':
      return Uint16Array;
    case 'Uint32Array':
      return Uint32Array;
    case 'Uint8ClampedArray':
      return Uint8ClampedArray;
    case 'Float32Array':
      return Float32Array;
    case 'Float64Array':
      return Float64Array;
    case 'BigInt64Array':
      return BigInt64Array;
    case 'BigUint64Array':
      return BigUint64Array;
    default:
      throw new SerovalUnknownTypedArrayError(name);
  }
}

type TypedArrayNameGetter = (this: TypedArrayValue | BigIntTypedArrayValue) => string;

let typedArrayNameGetter: TypedArrayNameGetter | undefined;

// The getter behind `TypedArray.prototype[Symbol.toStringTag]` reads the
// array's internal type. Unlike `value.constructor.name`, an own property on
// the value cannot change what it returns.
export function getTypedArrayName(
  value: TypedArrayValue | BigIntTypedArrayValue,
): string {
  if (!typedArrayNameGetter) {
    typedArrayNameGetter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(Int8Array.prototype) as object,
      Symbol.toStringTag,
    )!.get as TypedArrayNameGetter;
  }
  return typedArrayNameGetter.call(value);
}

/**
 * The parts of an `ArrayBufferView` that seroval writes, read from its
 * internal state.
 */
export interface ArrayBufferViewState {
  buffer: ArrayBuffer;
  byteOffset: number;
  byteLength: number;
  // The element count for typed arrays, the byte length for a `DataView`.
  length: number;
}

type ViewGetter = (this: ArrayBufferView) => unknown;

interface ViewGetters {
  buffer: ViewGetter;
  byteOffset: ViewGetter;
  byteLength: ViewGetter;
  length: ViewGetter;
}

let typedArrayGetters: ViewGetters | undefined;
let dataViewGetters: ViewGetters | undefined;

function getAccessor(proto: object, key: string): ViewGetter {
  // oxlint-disable-next-line unbound-method, no-unsafe-type-assertion -- `key` names an accessor the language defines on `proto`, and it is only called with `.call`.
  return Object.getOwnPropertyDescriptor(proto, key)!.get as ViewGetter;
}

function getViewGetters(proto: object, lengthKey: string): ViewGetters {
  return {
    buffer: getAccessor(proto, 'buffer'),
    byteOffset: getAccessor(proto, 'byteOffset'),
    byteLength: getAccessor(proto, 'byteLength'),
    length: getAccessor(proto, lengthKey),
  };
}

// Own `buffer`, `byteOffset`, `byteLength` and `length` properties on the
// value cannot replace these getters, and the getters throw for anything that
// is not a real view of the expected kind.
export function readArrayBufferView(
  value: ArrayBufferView,
  isDataView: boolean,
): ArrayBufferViewState {
  let getters: ViewGetters;
  if (isDataView) {
    getters = dataViewGetters ??= getViewGetters(DataView.prototype, 'byteLength');
  } else {
    getters = typedArrayGetters ??= getViewGetters(
      Object.getPrototypeOf(Int8Array.prototype) as object,
      'length',
    );
  }
  return {
    buffer: getters.buffer.call(value) as ArrayBuffer,
    byteOffset: getters.byteOffset.call(value) as number,
    byteLength: getters.byteLength.call(value) as number,
    length: getters.length.call(value) as number,
  };
}
