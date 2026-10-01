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
 * Flags for runtime features the deserializing target is assumed to support.
 * Every flag is enabled by default; pass a bitwise-OR of the ones to switch off
 * as `disabledFeatures` so the output avoids syntax or globals the target lacks
 * (for example disable {@link Feature.Temporal} for a runtime without the
 * Temporal API). A value that requires a disabled feature throws instead of
 * being serialized.
 *
 * Stays a runtime `enum` so the published declaration is unchanged for
 * consumers. Its values must match the internal bits (checked by
 * test/feature.test.ts).
 */
export enum Feature {
  /** `AggregateError`. */
  AggregateError = 0x01,
  /** Arrow-function syntax in the output. @deprecated always enabled */
  ArrowFunction = 0x02,
  /** Preserving `Error.prototype.stack`. */
  ErrorPrototypeStack = 0x04,
  /** `Object.assign`, used to rebuild objects with special keys. */
  ObjectAssign = 0x08,
  /** `BigInt64Array` / `BigUint64Array`. */
  BigIntTypedArray = 0x10,
  /** `RegExp`. */
  RegExp = 0x20,
  /** The `Temporal` API. */
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
