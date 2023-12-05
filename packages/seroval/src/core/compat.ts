/**
 * References
 * - https://compat-table.github.io/compat-table/es6/
 * - MDN
 */

export const enum Feature {
  AggregateError = 0x01,
  ArrowFunction = 0x02,
  BigInt = 0x04,
  ErrorPrototypeStack = 0x08,
  ObjectAssign = 0x10,
  BigIntTypedArray = 0x20,
}

export const ALL_ENABLED = 0x3F;

export const BIGINT_FLAG = Feature.BigIntTypedArray | Feature.BigInt;
