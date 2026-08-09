/**
 * Hides a value from the serializer. When an `OpaqueReference` is encountered,
 * its `value` is never serialized; the `replacement` is serialized in its place
 * (or `undefined` if none is given). Use it to keep a non-serializable or
 * sensitive value out of the output while still producing a valid result.
 *
 * @typeParam V The hidden value's type.
 * @typeParam R The replacement's type.
 */
export class OpaqueReference<V, R = undefined> {
  constructor(
    /** The value that is hidden from serialization. */
    public readonly value: V,
    /** The value serialized in place of {@link value}; defaults to `undefined`. */
    public readonly replacement?: R,
  ) {}
}
