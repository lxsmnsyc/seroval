/// <reference types="tsdown" />

import { serializeString } from './string';

// The catalog of every error that seroval and seroval-plugins throw.
//
// Codes are append-only. A new error takes the next number that was never
// used. Never change the code of an entry and never reuse one. When an error
// is removed, delete its entry and leave its number unused.
//
// Binary mode adds its own errors after the last code here.

export type SerovalErrorStep = 'parse' | 'serialize' | 'deserialize';

export type LiveStreamErrorReason = 'consumed' | 'pending' | 'reading' | 'closed';

/** The docs page that explains a code is `<DOCS_ERRORS_URL>/<code>`. */
export const DOCS_ERRORS_URL = 'https://seroval.vercel.app/docs/errors';

/** Every code with the name of its class or throw site. */
export const ERROR_CODES = {
  // Classes of `core/errors.ts`, in the order of the old `specific` numbers.
  UnsupportedType: 'SRV001',
  UnsupportedNode: 'SRV002',
  MissingPlugin: 'SRV003',
  MissingInstance: 'SRV004',
  MissingReference: 'SRV005',
  MissingReferenceForId: 'SRV006',
  UnknownTypedArray: 'SRV007',
  MalformedNode: 'SRV008',
  ConflictedNodeId: 'SRV009',
  DepthLimit: 'SRV010',
  Aborted: 'SRV011',
  LiveStream: 'SRV012',
  PluginValidation: 'SRV013',
  // One generic code per step, for wrappers around errors that are not seroval's.
  ParseFailure: 'SRV014',
  SerializeFailure: 'SRV015',
  DeserializeFailure: 'SRV016',
  // Plain throws of `packages/seroval/src`.
  StreamConsumed: 'SRV017',
  StreamOutputUnavailable: 'SRV018',
  InvalidMaxBase64Length: 'SRV019',
  Base64LengthLimit: 'SRV020',
} as const;

export type ErrorName = keyof typeof ERROR_CODES;
export type ErrorCode = (typeof ERROR_CODES)[ErrorName];

/** The details of each code. Throw sites and messages agree on these keys. */
export interface CatalogDetails {
  SRV001: { value: unknown };
  SRV002: { nodeType: number };
  SRV003: { tag: string };
  SRV004: { tag: string };
  SRV005: { value: unknown };
  SRV006: { id: string };
  SRV007: { name: string };
  SRV008: { nodeType?: number; nodeId?: number; detail?: string };
  SRV009: { nodeId: number };
  SRV010: { limit: number };
  SRV011: Record<never, never>;
  SRV012: { reason: LiveStreamErrorReason };
  SRV013: { tag: string; field: string };
  SRV014: { cause: unknown };
  SRV015: { cause: unknown };
  SRV016: { cause: unknown };
  SRV017: Record<never, never>;
  SRV018: Record<never, never>;
  SRV019: { value: unknown };
  SRV020: { limit: number };
}

export interface CatalogEntry<C extends ErrorCode = ErrorCode> {
  code: C;
  /**
   * The class that throws the code, or the standard class (such as
   * `RangeError`) for errors caused by how the API is called.
   */
  name: string;
  /** One line for the docs page. */
  title: string;
  /** The development message. It is not part of production builds. */
  message(details: CatalogDetails[C]): string;
}

/**
 * Type-only shape of the base class. errors-base implements it in
 * `core/errors.ts`.
 */
export interface SerovalErrorShape {
  readonly name: string;
  readonly code: ErrorCode;
  readonly step?: SerovalErrorStep;
  readonly path?: (string | number)[];
  readonly nodeType?: number;
  readonly nodeId?: number;
  readonly tag?: string;
  readonly limit?: number;
  readonly detail?: string;
  readonly value?: unknown;
  readonly field?: string;
  readonly reason?: LiveStreamErrorReason;
  readonly cause?: unknown;
}

function describeValue(value: unknown): string {
  return Object.prototype.toString.call(value);
}

function describeCause(type: string, cause: unknown): string {
  if (cause instanceof Error) {
    return `Seroval caught an error during the ${type} process.

${cause.name}
${cause.message}

- For more information, please check the "cause" property of this error.
- If you believe this is an error in Seroval, please submit an issue at https://github.com/lxsmnsyc/seroval/issues/new`;
  }
  return `Seroval caught an error during the ${type} process.

"${describeValue(cause)}"

For more information, please check the "cause" property of this error.`;
}

function defineEntry<C extends ErrorCode>(
  code: C,
  name: string,
  title: string,
  message: (details: CatalogDetails[C]) => string,
): CatalogEntry<C> {
  return { code, name, title, message };
}

type Catalog = { [C in ErrorCode]: CatalogEntry<C> };

function createCatalog(): Catalog {
  return {
    SRV001: defineEntry(
      'SRV001',
      'SerovalUnsupportedTypeError',
      'A value cannot be serialized',
      ({
        value,
      }) => `The value ${describeValue(value)} of type "${typeof value}" cannot be parsed/serialized.

There are few workarounds for this problem:
- Transform the value in a way that it can be serialized.
- If the reference is present on multiple runtimes (isomorphic), you can use the Reference API to map the references.`,
    ),
    SRV002: defineEntry(
      'SRV002',
      'SerovalUnsupportedNodeError',
      'A node has a type that is not supported',
      ({ nodeType }) => 'Unsupported node type "' + nodeType + '".',
    ),
    SRV003: defineEntry(
      'SRV003',
      'SerovalMissingPluginError',
      'A plugin for a tag is missing',
      ({ tag }) => 'Missing plugin for tag "' + tag + '".',
    ),
    SRV004: defineEntry(
      'SRV004',
      'SerovalMissingInstanceError',
      'A required instance is missing',
      ({ tag }) => 'Missing "' + tag + '" instance.',
    ),
    SRV005: defineEntry(
      'SRV005',
      'SerovalMissingReferenceError',
      'A reference is missing (deprecated)',
      ({ value }) =>
        'Missing reference for the value "' +
        describeValue(value) +
        '" of type "' +
        typeof value +
        '"',
    ),
    SRV006: defineEntry(
      'SRV006',
      'SerovalMissingReferenceForIdError',
      'A reference id is missing',
      ({ id }) => 'Missing reference for id "' + serializeString(id) + '"',
    ),
    SRV007: defineEntry(
      'SRV007',
      'SerovalUnknownTypedArrayError',
      'A typed array name is unknown',
      ({ name }) => 'Unknown TypedArray "' + name + '"',
    ),
    SRV008: defineEntry(
      'SRV008',
      'SerovalMalformedNodeError',
      'A node has the wrong shape',
      ({ nodeType, detail }) =>
        (nodeType === undefined ? 'Malformed node.' : 'Malformed node type "' + nodeType + '".') +
        (detail ? ' ' + detail : ''),
    ),
    SRV009: defineEntry(
      'SRV009',
      'SerovalConflictedNodeIdError',
      'Two nodes have the same id',
      ({ nodeId }) => 'Conflicted node id "' + nodeId + '".',
    ),
    SRV010: defineEntry(
      'SRV010',
      'SerovalDepthLimitError',
      'The depth limit was reached',
      ({ limit }) => 'Depth limit of ' + limit + ' reached',
    ),
    SRV011: defineEntry(
      'SRV011',
      'SerovalAbortedError',
      'The cross deserializer was aborted',
      () => 'Cross deserializer has been aborted.',
    ),
    SRV012: defineEntry(
      'SRV012',
      'SerovalLiveStreamError',
      'A live stream was used in a wrong state',
      ({ reason }) => {
        switch (reason) {
          case 'consumed':
            return 'Live stream already has a consumer';
          case 'pending':
            return 'Live stream already has a pending event';
          case 'reading':
            return 'Live stream already has a pending read';
          default:
            return 'Live stream is closed';
        }
      },
    ),
    SRV013: defineEntry(
      'SRV013',
      'SerovalPluginValidationError',
      'A plugin value failed its validator',
      ({ tag, field }) =>
        'Plugin "' + tag + '" received a value for "' + field + '" that failed its validator.',
    ),
    SRV014: defineEntry(
      'SRV014',
      'SerovalParserError',
      'The parser failed with an error that is not from seroval',
      ({ cause }) => describeCause('parsing', cause),
    ),
    SRV015: defineEntry(
      'SRV015',
      'SerovalSerializationError',
      'The serializer failed with an error that is not from seroval',
      ({ cause }) => describeCause('serialization', cause),
    ),
    SRV016: defineEntry(
      'SRV016',
      'SerovalDeserializationError',
      'The deserializer failed with an error that is not from seroval',
      ({ cause }) => describeCause('deserialization', cause),
    ),
    SRV017: defineEntry(
      'SRV017',
      'SerovalStreamConsumedError',
      'A stream already has a consumer',
      () => 'Stream consumed',
    ),
    SRV018: defineEntry(
      'SRV018',
      'SerovalStreamOutputError',
      'The stream parser has no output callback',
      () => 'Stream output callback is unavailable',
    ),
    SRV019: defineEntry(
      'SRV019',
      'RangeError',
      'The maxBase64Length option is invalid',
      ({ value }) =>
        'maxBase64Length must be a non-negative safe integer, received ' + describeValue(value),
    ),
    SRV020: defineEntry(
      'SRV020',
      'SerovalBase64LimitError',
      'An ArrayBuffer is larger than maxBase64Length',
      ({ limit }) => 'ArrayBuffer exceeds maxBase64Length (' + limit + ')',
    ),
  };
}

// `import.meta.env.PROD` is replaced at build time, so the whole catalog is
// removed from production builds.
const CATALOG: Catalog | undefined = import.meta.env.PROD ? undefined : createCatalog();

/** The entry of a code. It is `undefined` in production builds. */
export function getCatalogEntry<C extends ErrorCode>(code: C): CatalogEntry<C> | undefined {
  return CATALOG?.[code];
}

/** The development message of a code. It is empty in production builds. */
export function getDevMessage<C extends ErrorCode>(code: C, details: CatalogDetails[C]): string {
  const entry = getCatalogEntry(code);
  return entry ? entry.message(details) : '';
}

/** The production message: the code, the step and the docs link, no values. */
export function getProdMessage(code: ErrorCode, step?: SerovalErrorStep): string {
  return 'Seroval ' + code + (step ? ' (' + step + ')' : '') + ': ' + DOCS_ERRORS_URL + '/' + code;
}
