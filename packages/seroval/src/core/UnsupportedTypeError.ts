// eslint-disable-next-line @typescript-eslint/unbound-method
const { toString } = /* @__PURE__ */Object.prototype;

export default class UnsupportedTypeError extends Error {
  constructor(public value: unknown) {
    super('Unsupported type "' + toString.call(value) + '"');
  }
}
