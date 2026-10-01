import { SerovalMissingReferenceForIdError } from './errors';
import { REFERENCES_KEY } from './keys';

const REFERENCE = new Map<unknown, string>();
const INV_REFERENCE = new Map<string, unknown>();

let installed = false;

function getGlobalObject(): object | undefined {
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  if (typeof window !== 'undefined') {
    return window;
  }
  if (typeof self !== 'undefined') {
    return self;
  }
  if (typeof global !== 'undefined') {
    return global;
  }
  return undefined;
}

// Serialized output resolves named references through the global
// `__SEROVAL_REFS__` store. Defining it at import time is a side effect
// that keeps this module in every consumer bundle, including ones that
// never register a reference. The store can only resolve values that were
// registered here, so it is defined on the first registration instead.
function installReferenceStore(): void {
  if (!installed) {
    installed = true;
    const globalObject = getGlobalObject();
    if (globalObject) {
      Object.defineProperty(globalObject, REFERENCES_KEY, {
        value: INV_REFERENCE,
        configurable: true,
        writable: false,
        enumerable: false,
      });
    }
  }
}

/**
 * Registers a value under a stable string `id` so it can be serialized by
 * reference instead of by value. Values that cannot be serialized structurally
 * - functions, class instances, symbols - become serializable this way, as
 * long as the same `id` is registered on both the serializing and
 * deserializing realms (an isomorphic reference).
 *
 * Call this once at module scope on each realm; it returns `value` unchanged so
 * it can wrap a declaration.
 *
 * @param id A stable identifier, unique within the reference registry.
 * @param value The value to register.
 * @returns The same `value`.
 */
export function createReference<T>(id: string, value: T): T {
  installReferenceStore();
  REFERENCE.set(value, id);
  INV_REFERENCE.set(id, value);
  return value;
}

/** Returns whether a reference `id` has been registered with {@link createReference}. */
export function hasReference(id: string): boolean {
  return INV_REFERENCE.has(id);
}

/**
 * Returns the reference id a value was registered under, or `undefined` if the
 * value was never registered.
 */
export function getReferenceID(value: unknown): string | undefined {
  return REFERENCE.get(value);
}

/**
 * Returns the value registered under a reference id.
 *
 * @throws {SerovalMissingReferenceForIdError} If no value was registered for the id.
 */
export function getReference<T>(id: string): T {
  if (hasReference(id)) {
    return INV_REFERENCE.get(id) as T;
  }
  throw new SerovalMissingReferenceForIdError(id);
}
