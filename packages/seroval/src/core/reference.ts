import {
  SerovalMissingReferenceError,
  SerovalMissingReferenceForIdError,
} from '..';
import { REFERENCES_KEY } from './keys';

const REFERENCE = new Map<unknown, string>();
const INV_REFERENCE = new Map<string, unknown>();

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
  REFERENCE.set(value, id);
  INV_REFERENCE.set(id, value);
  return value;
}

/** Returns whether `value` has been registered with {@link createReference}. */
export function hasReferenceID<T>(value: T): boolean {
  return REFERENCE.has(value);
}

/** Returns whether a reference `id` has been registered with {@link createReference}. */
export function hasReference(id: string): boolean {
  return INV_REFERENCE.has(id);
}

/**
 * Returns the reference id a value was registered under.
 *
 * @throws {SerovalMissingReferenceError} If the value was never registered.
 */
export function getReferenceID<T>(value: T): string {
  if (hasReferenceID(value)) {
    return REFERENCE.get(value)!;
  }
  throw new SerovalMissingReferenceError(value);
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

if (typeof globalThis !== 'undefined') {
  Object.defineProperty(globalThis, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false,
  });
} else if (typeof window !== 'undefined') {
  Object.defineProperty(window, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false,
  });
} else if (typeof self !== 'undefined') {
  Object.defineProperty(self, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false,
  });
} else if (typeof global !== 'undefined') {
  Object.defineProperty(global, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false,
  });
}
