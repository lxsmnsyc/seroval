import { SerovalMissingReferenceForIdError } from './errors';
import { REFERENCES_KEY } from './keys';

const REFERENCE = new Map<unknown, string>();
const INV_REFERENCE = new Map<string, unknown>();

export function createReference<T>(id: string, value: T): T {
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

const GLOBAL_OBJECT = /* @__PURE__ */ getGlobalObject();

if (GLOBAL_OBJECT) {
  Object.defineProperty(GLOBAL_OBJECT, REFERENCES_KEY, {
    value: INV_REFERENCE,
    configurable: true,
    writable: false,
    enumerable: false,
  });
}
