const { toString: objectToString } = /* @__PURE__ */ Object.prototype;

export default class UnsupportedTypeError extends Error {
  constructor(public value: unknown) {
    super('Unsupported type "' + objectToString.call(value) + '"');
  }
}
