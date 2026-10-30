// oxlint-disable no-unsafe-type-assertion -- The generator builds and walks values of every type.
import fc from 'fast-check';

// Strings that the escaping in `serialize` and `crossSerialize` must handle.
const TRICKY_STRINGS = [
  '</script>',
  '</SCRIPT><script>',
  '<!--',
  String.fromCharCode(0x2028),
  String.fromCharCode(0x2029),
  '\ud800',
  '\\',
  '"',
  "'",
  // oxlint-disable-next-line no-template-curly-in-string -- A template literal inside a string value.
  '`${x}`',
  '__proto__',
  'constructor',
  'prototype',
];

// Keys that change behavior when an object is built with plain assignment.
const TRICKY_KEYS = ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf', 'then', ''];

const REGEXP_FLAGS = ['', 'g', 'i', 'm', 's', 'u', 'y', 'd', 'gimsuy', 'v'];

const ERROR_CONSTRUCTORS = [Error, EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError];

function escapeRegExpSource(source: string): string {
  return source.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
}

const stringArb = fc.oneof(
  { weight: 3, arbitrary: fc.string({ unit: 'binary', maxLength: 32 }) },
  { weight: 1, arbitrary: fc.constantFrom(...TRICKY_STRINGS) },
  { weight: 1, arbitrary: fc.string({ unit: 'grapheme', minLength: 64, maxLength: 128 }) },
);

const keyArb = fc.oneof(
  { weight: 3, arbitrary: fc.string({ maxLength: 8 }) },
  { weight: 1, arbitrary: fc.constantFrom(...TRICKY_KEYS) },
  { weight: 1, arbitrary: fc.nat({ max: 2 ** 32 }).map(String) },
);

const primitiveArb = fc.oneof(
  stringArb,
  fc.double(),
  fc.integer(),
  fc.constantFrom(0, -0, NaN, Infinity, -Infinity, 2 ** 53, Number.MIN_VALUE),
  fc.bigInt(),
  fc.boolean(),
  fc.constant(null),
  fc.constant(undefined),
);

const regexpArb = fc
  .tuple(
    fc.oneof(
      fc.string({ maxLength: 16 }).map(escapeRegExpSource),
      fc.constantFrom('[</script>]', '(?<name>a)\\k<name>', '\\u{1F600}', '[/]', '\\n', '^$'),
    ),
    fc.constantFrom(...REGEXP_FLAGS),
  )
  .map(([source, flags]) => {
    try {
      return new RegExp(source, flags);
    } catch {
      return new RegExp(escapeRegExpSource(source), flags.replace('v', 'u'));
    }
  });

const binaryArb = fc.oneof(
  fc.uint8Array({ maxLength: 16 }),
  fc.uint8ClampedArray({ maxLength: 16 }),
  fc.int8Array({ maxLength: 16 }),
  fc.uint16Array({ maxLength: 16 }),
  fc.int16Array({ maxLength: 16 }),
  fc.uint32Array({ maxLength: 16 }),
  fc.int32Array({ maxLength: 16 }),
  fc.float32Array({ maxLength: 16 }),
  fc.float64Array({ maxLength: 16 }),
  fc.bigInt64Array({ maxLength: 16 }),
  fc.bigUint64Array({ maxLength: 16 }),
  fc.uint8Array({ maxLength: 16 }).map((bytes) => new DataView(bytes.buffer)),
  fc.uint8Array({ maxLength: 16 }).map((bytes) => bytes.buffer),
  // A view over part of a larger buffer.
  fc
    .tuple(fc.uint8Array({ minLength: 8, maxLength: 16 }), fc.nat({ max: 4 }), fc.nat({ max: 4 }))
    .map(([bytes, offset, length]) => new Uint8Array(bytes.buffer, offset, length)),
);

const boxedArb = fc.oneof(
  stringArb.map((value) => Object(value) as object),
  fc.double().map((value) => Object(value) as object),
  fc.boolean().map((value) => Object(value) as object),
  fc.bigInt().map((value) => Object(value) as object),
);

const leafArb = fc.oneof(
  { weight: 6, arbitrary: primitiveArb },
  { weight: 1, arbitrary: fc.date() },
  { weight: 1, arbitrary: regexpArb },
  { weight: 1, arbitrary: binaryArb },
  { weight: 1, arbitrary: boxedArb },
);

function createNullPrototypeObject(entries: Record<string, unknown>): Record<string, unknown> {
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(entries)) {
    result[key] = entries[key];
  }
  return result;
}

function createError([index, message, cause]: [number, string, unknown]): Error {
  const error = new ERROR_CONSTRUCTORS[index](message, cause === undefined ? undefined : { cause });
  // The stack depends on where the value was built, so it never survives a round trip.
  delete error.stack;
  return error;
}

const { tree } = fc.letrec<{ tree: unknown; node: unknown }>((tie) => ({
  tree: fc.oneof({ depthSize: 'small', withCrossShrink: true }, leafArb, tie('node')),
  node: fc.oneof(
    fc.array(tie('tree'), { maxLength: 6 }),
    fc.sparseArray(tie('tree'), { maxLength: 6 }),
    fc.dictionary(keyArb, tie('tree'), { maxKeys: 6, noNullPrototype: true }),
    fc
      .dictionary(keyArb, tie('tree'), { maxKeys: 6, noNullPrototype: true })
      .map(createNullPrototypeObject),
    fc.array(fc.tuple(tie('tree'), tie('tree')), { maxLength: 6 }).map((entries) => new Map(entries)),
    fc.array(tie('tree'), { maxLength: 6 }).map((items) => new Set(items)),
    fc
      .tuple(fc.nat({ max: ERROR_CONSTRUCTORS.length - 1 }), fc.string({ maxLength: 16 }), tie('tree'))
      .map(createError),
    fc.array(tie('tree'), { maxLength: 4 }).map((errors) => {
      const error = new AggregateError(errors, 'aggregate');
      delete error.stack;
      return error;
    }),
  ),
}));

function collectContainers(value: unknown, seen: Set<object>, result: object[]): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return;
  }
  seen.add(value);
  if (Array.isArray(value) || value instanceof Set || value instanceof Map) {
    result.push(value);
  } else if (!ArrayBuffer.isView(value) && !(value instanceof ArrayBuffer)) {
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype === Object.prototype || prototype === null) {
      result.push(value);
    }
  }
  if (value instanceof Map) {
    for (const [key, item] of value) {
      collectContainers(key, seen, result);
      collectContainers(item, seen, result);
    }
  } else if (value instanceof Set) {
    for (const item of value) {
      collectContainers(item, seen, result);
    }
  } else {
    for (const key of Object.keys(value)) {
      collectContainers((value as Record<string, unknown>)[key], seen, result);
    }
    if (value instanceof Error) {
      collectContainers(value.cause, seen, result);
    }
  }
}

function copyError(error: Error): Error {
  const copy =
    error instanceof AggregateError
      ? new AggregateError(copyValue(error.errors) as unknown[], error.message)
      : new (error.constructor as ErrorConstructor)(
          error.message,
          'cause' in error ? { cause: copyValue(error.cause) } : undefined,
        );
  delete copy.stack;
  return copy;
}

// fast-check reuses generated values while it shrinks, so the links go on a copy.
function copyValue(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    const copy: unknown[] = [];
    copy.length = value.length;
    for (const key of Object.keys(value)) {
      copy[Number(key)] = copyValue(value[Number(key)]);
    }
    return copy;
  }
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    for (const [key, item] of value) {
      copy.set(copyValue(key), copyValue(item));
    }
    return copy;
  }
  if (value instanceof Set) {
    const copy = new Set<unknown>();
    for (const item of value) {
      copy.add(copyValue(item));
    }
    return copy;
  }
  if (value instanceof Error) {
    return copyError(value);
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype === Object.prototype || prototype === null) {
    const copy: object = Object.create(prototype) as object;
    for (const key of Object.keys(value)) {
      Object.defineProperty(copy, key, {
        value: copyValue((value as Record<string, unknown>)[key]),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return copy;
  }
  // Leaves are never linked into, so sharing them is safe.
  return value;
}

function linkContainers(source: unknown, links: [number, number][]): unknown {
  // Pick the arrays, plain objects, Maps and Sets in a fresh copy of the tree.
  const root = copyValue(source);
  const containers: object[] = [];
  collectContainers(root, new Set(), containers);
  if (containers.length === 0) {
    return root;
  }
  // Put a reference to one container inside another. Links to an ancestor make cycles.
  let index = 0;
  for (const [from, to] of links) {
    const holder = containers[from % containers.length];
    const target = containers[to % containers.length];
    if (Array.isArray(holder)) {
      holder.push(target);
    } else if (holder instanceof Map) {
      holder.set(`link${index}`, target);
    } else if (holder instanceof Set) {
      holder.add(target);
    } else {
      (holder as Record<string, unknown>)[`link${index}`] = target;
    }
    index++;
  }
  return root;
}

/**
 * Values that every serialization mode supports, with shared references and
 * cycles between their containers.
 */
export const valueArb = fc
  .tuple(tree, fc.array(fc.tuple(fc.nat(), fc.nat()), { maxLength: 4 }))
  .map(([root, links]) => linkContainers(root, links));

/** How many runs each property makes. Set `FUZZ_RUNS` to search longer. */
export const NUM_RUNS = Number(process.env.FUZZ_RUNS) || 200;

/** Set `FUZZ_SEED` (and `FUZZ_PATH`) to replay a failure that fast-check reported. */
export const FUZZ_PARAMETERS: fc.Parameters<unknown> = {
  numRuns: NUM_RUNS,
  seed: process.env.FUZZ_SEED ? Number(process.env.FUZZ_SEED) : undefined,
  path: process.env.FUZZ_PATH,
  endOnFailure: !!process.env.FUZZ_PATH,
};
