/**
 * References
 * - https://compat-table.github.io/compat-table/es6/
 * - MDN
 */

/**
 * Flags for runtime features the deserializing target is assumed to support.
 * Every flag is enabled by default; pass a bitwise-OR of the ones to switch off
 * as `disabledFeatures` so the output avoids syntax or globals the target lacks
 * (for example disable {@link Feature.Temporal} for a runtime without the
 * Temporal API). A value that requires a disabled feature throws instead of
 * being serialized.
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
  Feature.AggregateError |
  Feature.ArrowFunction |
  Feature.ErrorPrototypeStack |
  Feature.ObjectAssign |
  Feature.BigIntTypedArray |
  Feature.RegExp |
  Feature.Temporal;
