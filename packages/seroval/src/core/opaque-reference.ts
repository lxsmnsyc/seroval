export class OpaqueReference<V, R = undefined> {
  constructor(
    public value: V,
    public replacement?: R,
  ) {}
}
