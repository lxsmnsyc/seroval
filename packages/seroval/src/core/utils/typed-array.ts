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

export function getTypedArrayConstructor(name: string): TypedArrayConstructor {
  switch (name) {
    case 'Int8Array': return Int8Array;
    case 'Int16Array': return Int16Array;
    case 'Int32Array': return Int32Array;
    case 'Uint8Array': return Uint8Array;
    case 'Uint16Array': return Uint16Array;
    case 'Uint32Array': return Uint32Array;
    case 'Uint8ClampedArray': return Uint8ClampedArray;
    case 'Float32Array': return Float32Array;
    case 'Float64Array': return Float64Array;
    case 'BigInt64Array': return BigInt64Array;
    case 'BigUint64Array': return BigUint64Array;
    default:
      throw new Error(`Unknown TypedArray "${name}"`);
  }
}
