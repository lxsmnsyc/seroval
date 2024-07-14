export class OpaqueReference<V, R = undefined> {
  constructor(
    public readonly value: V,
    public readonly replacement?: R,
  ) {}
}
