// oxlint-disable no-unsafe-type-assertion -- Each branch has checked the original's type.
// A structural comparison for round trips. Vitest's `toStrictEqual` reads
// `value.constructor`, which an own `constructor` key replaces, and treats
// Error fields differently from how seroval rebuilds them. This one also checks
// that shared references and cycles come back with the same shape.

interface Pairs {
  // Original object to decoded object, and back.
  decoded: Map<object, object>;
  original: Map<object, object>;
}

function compareBytes(actual: ArrayBufferLike, expected: ArrayBufferLike): boolean {
  const left = new Uint8Array(actual);
  const right = new Uint8Array(expected);
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function findKeyDifference(actual: object, expected: object, path: string, pairs: Pairs): string | undefined {
  // Seroval assigns back-references to cycles after the other keys, so the key
  // order may change.
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (actualKeys.join('\0') !== expectedKeys.join('\0')) {
    return `${path}: keys ${JSON.stringify(actualKeys)} instead of ${JSON.stringify(expectedKeys)}`;
  }
  for (const key of expectedKeys) {
    const difference = findDifferenceAt(
      (actual as Record<string, unknown>)[key],
      (expected as Record<string, unknown>)[key],
      `${path}[${JSON.stringify(key)}]`,
      pairs,
    );
    if (difference) {
      return difference;
    }
  }
  return undefined;
}

function copyPairs(pairs: Pairs): Pairs {
  return { decoded: new Map(pairs.decoded), original: new Map(pairs.original) };
}

function findEntryDifference(
  actual: Iterable<unknown>,
  expected: Iterable<unknown>,
  path: string,
  pairs: Pairs,
): string | undefined {
  const actualItems = [...actual];
  const expectedItems = [...expected];
  if (actualItems.length !== expectedItems.length) {
    return `${path}: ${actualItems.length} entries instead of ${expectedItems.length}`;
  }
  // Seroval adds entries that refer back to a cycle after the others, so the
  // entries may come back in another order. Match each one with the first
  // decoded entry that fits, trying it on a copy of the pairs first.
  const unmatched = new Set(actualItems.keys());
  for (let i = 0; i < expectedItems.length; i++) {
    let match: number | undefined;
    for (const j of unmatched) {
      if (!findDifferenceAt(actualItems[j], expectedItems[i], path, copyPairs(pairs))) {
        match = j;
        break;
      }
    }
    if (match === undefined) {
      return `${path}<${i}>: no matching entry`;
    }
    unmatched.delete(match);
    findDifferenceAt(actualItems[match], expectedItems[i], path, pairs);
  }
  return undefined;
}

function findObjectDifference(actual: object, expected: object, path: string, pairs: Pairs): string | undefined {
  if (expected instanceof Map) {
    return findEntryDifference((actual as Map<unknown, unknown>).entries(), expected.entries(), path, pairs);
  }
  if (expected instanceof Set) {
    return findEntryDifference(actual as Set<unknown>, expected, path, pairs);
  }
  if (expected instanceof Date) {
    return Object.is((actual as Date).getTime(), expected.getTime()) ? undefined : `${path}: different time`;
  }
  if (expected instanceof RegExp) {
    const regexp = actual as RegExp;
    return regexp.source === expected.source && regexp.flags === expected.flags
      ? undefined
      : `${path}: ${String(regexp)} instead of ${String(expected)}`;
  }
  if (expected instanceof ArrayBuffer) {
    return compareBytes(actual as ArrayBuffer, expected) ? undefined : `${path}: different bytes`;
  }
  if (ArrayBuffer.isView(expected)) {
    const view = actual as ArrayBufferView;
    if (view.byteOffset !== expected.byteOffset || view.byteLength !== expected.byteLength) {
      return `${path}: different view range`;
    }
    return findDifferenceAt(view.buffer, expected.buffer, `${path}.buffer`, pairs);
  }
  if (expected instanceof Error) {
    const error = actual as Error;
    if (error.message !== expected.message) {
      return `${path}: message ${JSON.stringify(error.message)} instead of ${JSON.stringify(expected.message)}`;
    }
    if ('cause' in error !== 'cause' in expected) {
      return `${path}: cause is ${'cause' in error ? 'present' : 'missing'}`;
    }
    const difference = findDifferenceAt(error.cause, expected.cause, `${path}.cause`, pairs);
    if (difference || !(expected instanceof AggregateError)) {
      return difference;
    }
    return findDifferenceAt((error as AggregateError).errors, expected.errors, `${path}.errors`, pairs);
  }
  if (
    expected instanceof String ||
    expected instanceof Number ||
    expected instanceof Boolean ||
    expected instanceof BigInt
  ) {
    return Object.is(actual.valueOf(), expected.valueOf()) ? undefined : `${path}: different boxed value`;
  }
  return findKeyDifference(actual, expected, path, pairs);
}

function findDifferenceAt(actual: unknown, expected: unknown, path: string, pairs: Pairs): string | undefined {
  if (typeof expected !== 'object' || expected === null) {
    return Object.is(actual, expected) ? undefined : `${path}: ${String(actual)} instead of ${String(expected)}`;
  }
  if (typeof actual !== 'object' || actual === null) {
    return `${path}: ${String(actual)} instead of an object`;
  }
  // Each original object must map to exactly one decoded object, so shared
  // references stay shared and cycles stay cycles.
  const decoded = pairs.decoded.get(expected);
  if (decoded) {
    return decoded === actual ? undefined : `${path}: a copy instead of a shared reference`;
  }
  if (pairs.original.has(actual)) {
    return `${path}: a shared reference instead of a separate object`;
  }
  pairs.decoded.set(expected, actual);
  pairs.original.set(actual, expected);
  if (Object.getPrototypeOf(actual) !== Object.getPrototypeOf(expected)) {
    return `${path}: different prototype`;
  }
  if (Array.isArray(expected)) {
    if ((actual as unknown[]).length !== expected.length) {
      return `${path}: length ${(actual as unknown[]).length} instead of ${expected.length}`;
    }
    return findKeyDifference(actual, expected, path, pairs);
  }
  return findObjectDifference(actual, expected, path, pairs);
}

/** Describes the first place where `actual` differs from `expected`, if any. */
export default function findDifference(actual: unknown, expected: unknown): string | undefined {
  return findDifferenceAt(actual, expected, '$', { decoded: new Map(), original: new Map() });
}
