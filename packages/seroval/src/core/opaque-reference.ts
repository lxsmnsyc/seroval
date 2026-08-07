/**
 * An opaque reference allows hiding values from the serializer.
 */
export default class OpaqueReference<V, R = undefined> {
  constructor(
    public readonly value: V,
    public readonly replacement?: R,
  ) {}
}
