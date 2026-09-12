/**
 * References
 * - https://compat-table.github.io/compat-table/es6/
 * - MDN
 */

/**
 * Internal feature bits. A `const enum` so every use inside the library
 * inlines to a literal.
 */
export const enum FeatureFlag {
  AggregateError = 0x01,
  // @deprecated
  ArrowFunction = 0x02,
  ErrorPrototypeStack = 0x04,
  ObjectAssign = 0x08,
  BigIntTypedArray = 0x10,
  RegExp = 0x20,
  Temporal = 0x40,
}

/**
 * Public feature bits for `disabledFeatures`. Stays a runtime `enum` so the
 * published declaration is unchanged for consumers. Its values must match
 * the internal bits (checked by test/feature.test.ts).
 */
export enum Feature {
  AggregateError = 0x01,
  // @deprecated
  ArrowFunction = 0x02,
  ErrorPrototypeStack = 0x04,
  ObjectAssign = 0x08,
  BigIntTypedArray = 0x10,
  RegExp = 0x20,
  Temporal = 0x40,
}

export const ALL_ENABLED =
  FeatureFlag.AggregateError |
  FeatureFlag.ArrowFunction |
  FeatureFlag.ErrorPrototypeStack |
  FeatureFlag.ObjectAssign |
  FeatureFlag.BigIntTypedArray |
  FeatureFlag.RegExp |
  FeatureFlag.Temporal;
