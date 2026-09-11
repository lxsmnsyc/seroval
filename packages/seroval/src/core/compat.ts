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
 * Public feature bits for `disabledFeatures`. A plain object instead of a
 * runtime enum so consumers that never import it pay nothing for it and
 * consumers that do only ship the forward mapping. Values must match
 * `FeatureFlag` (checked by test/feature.test.ts).
 */
export const Feature = {
  AggregateError: 0x01,
  /** @deprecated */
  ArrowFunction: 0x02,
  ErrorPrototypeStack: 0x04,
  ObjectAssign: 0x08,
  BigIntTypedArray: 0x10,
  RegExp: 0x20,
  Temporal: 0x40,
} as const satisfies Record<keyof typeof FeatureFlag, number>;

export type Feature = (typeof Feature)[keyof typeof Feature];

export const ALL_ENABLED =
  FeatureFlag.AggregateError |
  FeatureFlag.ArrowFunction |
  FeatureFlag.ErrorPrototypeStack |
  FeatureFlag.ObjectAssign |
  FeatureFlag.BigIntTypedArray |
  FeatureFlag.RegExp |
  FeatureFlag.Temporal;
