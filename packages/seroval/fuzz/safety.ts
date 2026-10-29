// Checks shared by the untrusted-input fuzzers. A decoder may reject untrusted
// input with an Error, but must not overflow the stack or touch the built-in
// prototypes. With `FUZZ_STRICT_ERRORS=1`, the Error must also be one of the
// decoder's own, which finds input the decoder does not validate yet.
const STRICT_ERRORS = !!process.env.FUZZ_STRICT_ERRORS;

type ErrorConstructor = abstract new (...args: never[]) => Error;

const PROTOTYPES: object[] = [
  Object.prototype,
  Array.prototype,
  Function.prototype,
  Map.prototype,
  Set.prototype,
  Promise.prototype,
  Error.prototype,
  RegExp.prototype,
  Date.prototype,
  String.prototype,
];

export function snapshotPrototypes(): unknown[][] {
  const snapshot: unknown[][] = [];
  for (const prototype of PROTOTYPES) {
    const entries: unknown[] = [Object.getPrototypeOf(prototype)];
    for (const key of Reflect.ownKeys(prototype)) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, key);
      // oxlint-disable-next-line unbound-method -- The accessors are compared, never called.
      entries.push(key, descriptor?.value as unknown, descriptor?.get, descriptor?.set);
    }
    snapshot.push(entries);
  }
  return snapshot;
}

export function isExpectedError(error: unknown, expected: ErrorConstructor[]): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  if (error instanceof RangeError && error.message.includes('call stack')) {
    return false;
  }
  if (!STRICT_ERRORS) {
    return true;
  }
  for (const constructor of expected) {
    if (error instanceof constructor) {
      return true;
    }
  }
  return false;
}
