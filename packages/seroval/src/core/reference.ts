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

export function createReference<T>(id: string, value: T): T {
  installReferenceStore();
  REFERENCE.set(value, id);
  INV_REFERENCE.set(id, value);
  return value;
}

export function hasReference(id: string): boolean {
  return INV_REFERENCE.has(id);
}

export function getReferenceID(value: unknown): string | undefined {
  return REFERENCE.get(value);
}

export function getReference<T>(id: string): T {
  if (hasReference(id)) {
    return INV_REFERENCE.get(id) as T;
  }
  throw new SerovalMissingReferenceForIdError(id);
}
