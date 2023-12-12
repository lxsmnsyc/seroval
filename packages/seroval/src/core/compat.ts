/**
 * References
 * - https://compat-table.github.io/compat-table/es6/
 * - MDN
 */

export const enum Feature {
  AggregateError = 0x01,
  ArrowFunction = 0x02,
  ErrorPrototypeStack = 0x04,
  ObjectAssign = 0x08,
  BigIntTypedArray = 0x10,
}

export const ALL_ENABLED = 0x1f;
