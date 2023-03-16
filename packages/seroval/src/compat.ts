/* eslint-disable guard-for-in */
/**
 * References
 * - https://kangax.github.io/compat-table/es6/
 * - MDN
 */

export const enum Feature {
  AggregateError = 0x01,
  ArrayPrototypeValues = 0x02,
  ArrowFunction = 0x04,
  BigInt = 0x08,
  ErrorPrototypeStack = 0x10,
  Map = 0x20,
  MethodShorthand = 0x40,
  ObjectAssign = 0x80,
  Promise = 0x100,
  Set = 0x200,
  Symbol = 0x400,
  TypedArray = 0x800,
  BigIntTypedArray = 0x1000,
}

export const ALL_ENABLED = 0x1FFF;
