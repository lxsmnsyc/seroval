import type { BigIntTypedArrayValue, TypedArrayValue } from '../constants';

type TypedArrayNameGetter = (this: TypedArrayValue | BigIntTypedArrayValue) => string | undefined;

let typedArrayNameGetter: TypedArrayNameGetter | undefined;

// The getter behind `TypedArray.prototype[Symbol.toStringTag]` reads the
// array's internal type. Unlike `value.constructor.name` or `instanceof`, the
// value's own properties and prototype cannot change what it returns. It
// returns `undefined` for anything that is not a typed array, a `DataView`
// included.
export function getTypedArrayName(
  value: TypedArrayValue | BigIntTypedArrayValue,
): string | undefined {
  // oxlint-disable-next-line unbound-method, no-unsafe-type-assertion -- The language defines this accessor, and it is only called with `.call`.
  typedArrayNameGetter ??= Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Int8Array.prototype) as object,
    Symbol.toStringTag,
  )!.get as TypedArrayNameGetter;
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
