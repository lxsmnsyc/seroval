import {
  createIndexedValueNode,
  createReferenceNode,
  createWKSymbolNode,
} from '../base-primitives';
import { ALL_ENABLED, Feature } from '../compat';
import type { WellKnownSymbols } from '../constants';
import {
  INV_SYMBOL_REF,
  NIL,
  SerovalNodeType,
  SerovalTemporalType,
} from '../constants';
import { SerovalUnsupportedTypeError } from '../errors';
import { createSerovalNode } from '../node';
import type { PluginAccessOptions, SerovalMode } from '../plugin';
import { getReferenceID } from '../reference';
import {
  ASYNC_ITERATOR,
  ITERATOR,
  SPECIAL_REFS,
  SpecialReference,
} from '../special-reference';
import { SYM_ASYNC_ITERATOR, SYM_ITERATOR } from '../symbols';
import type {
  SerovalArrayBufferNode,
  SerovalAsyncIteratorFactoryNode,
  SerovalIndexedValueNode,
  SerovalIteratorFactoryNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordNode,
  SerovalPromiseConstructorNode,
  SerovalReferenceNode,
  SerovalSpecialReferenceNode,
  SerovalWKSymbolNode,
} from '../types';
import { getObjectFlag } from '../utils/get-object-flag';

export interface BaseParserContextOptions extends PluginAccessOptions {
  disabledFeatures?: number;
  refs?: Map<unknown, number>;
  depthLimit?: number;
  /** Copy each typed array or DataView's visible bytes into its own buffer. */
  compactArrayBufferViews?: boolean;
}

export interface BaseParserContext extends PluginAccessOptions {
  readonly mode: SerovalMode;

  marked: Set<number>;

  refs: Map<unknown, number>;

  features: number;

  depthLimit: number;
  compactArrayBufferViews: boolean;
}

export function createBaseParserContext(
  mode: SerovalMode,
  options: BaseParserContextOptions,
): BaseParserContext {
  return {
    plugins: options.plugins,
    mode,
    marked: new Set(),
    features: ALL_ENABLED ^ (options.disabledFeatures || 0),
    refs: options.refs || new Map(),
    depthLimit: options.depthLimit || 1000,
    compactArrayBufferViews: options.compactArrayBufferViews ?? false,
  };
}

/**
 * Ensures that the value (based on an identifier) has been visited by the parser.
 * @param ctx
 * @param id
 */
export function markParserRef(ctx: BaseParserContext, id: number): void {
  ctx.marked.add(id);
}

export function isParserRefMarked(ctx: BaseParserContext, id: number): boolean {
  return ctx.marked.has(id);
}

/**
 * Creates an identifier for a value
 * @param ctx
 * @param current
 */
export function createIndexForValue<T>(
  ctx: BaseParserContext,
  current: T,
): number {
  const id = ctx.refs.size;
  ctx.refs.set(current, id);
  return id;
}

export function getNodeForIndexedValue<T>(
  ctx: BaseParserContext,
  current: T,
): number | SerovalIndexedValueNode {
  const registeredId = ctx.refs.get(current);
  if (registeredId != null) {
    markParserRef(ctx, registeredId);
    return createIndexedValueNode(registeredId);
  }
  return createIndexForValue(ctx, current);
}

export function getReferenceNode<T>(
  ctx: BaseParserContext,
  current: T,
): number | SerovalIndexedValueNode | SerovalReferenceNode {
  const indexed = getNodeForIndexedValue(ctx, current);
  if (typeof indexed !== 'number') {
    return indexed;
  }
  const referenceId = getReferenceID(current);
  return referenceId === undefined
    ? indexed
    : createReferenceNode(indexed, referenceId);
}

/**
 * Parsing methods
 */
export function parseWellKnownSymbol(
  ctx: BaseParserContext,
  current: symbol,
): SerovalIndexedValueNode | SerovalWKSymbolNode | SerovalReferenceNode {
  const ref = getReferenceNode(ctx, current);
  if (typeof ref !== 'number') {
    return ref;
  }
  if (current in INV_SYMBOL_REF) {
    return createWKSymbolNode(ref, current as WellKnownSymbols);
  }
  throw new SerovalUnsupportedTypeError(current);
}

export function parseSpecialReference(
  ctx: BaseParserContext,
  ref: SpecialReference,
): SerovalIndexedValueNode | SerovalSpecialReferenceNode {
  const result = getNodeForIndexedValue(ctx, SPECIAL_REFS[ref]);
  if (typeof result !== 'number') {
    return result;
  }
  return createSerovalNode(SerovalNodeType.SpecialReference, result, ref);
}

export function parseIteratorFactory(
  ctx: BaseParserContext,
): SerovalIndexedValueNode | SerovalIteratorFactoryNode {
  const result = getNodeForIndexedValue(ctx, ITERATOR);
  if (typeof result !== 'number') {
    return result;
  }
  return createSerovalNode(
    SerovalNodeType.IteratorFactory,
    result,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    parseWellKnownSymbol(ctx, SYM_ITERATOR),
  );
}

export function parseAsyncIteratorFactory(
  ctx: BaseParserContext,
): SerovalIndexedValueNode | SerovalAsyncIteratorFactoryNode {
  const result = getNodeForIndexedValue(ctx, ASYNC_ITERATOR);
  if (typeof result !== 'number') {
    return result;
  }
  return createSerovalNode(
    SerovalNodeType.AsyncIteratorFactory,
    result,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    [
      parseSpecialReference(ctx, SpecialReference.PromiseConstructor),
      parseWellKnownSymbol(ctx, SYM_ASYNC_ITERATOR),
    ],
  );
}

export function getTemporalType(
  currentClass: unknown,
): SerovalTemporalType | undefined {
  switch (currentClass) {
    case Temporal.Instant:
      return SerovalTemporalType.Instant;
    case Temporal.Duration:
      return SerovalTemporalType.Duration;
    case Temporal.PlainDate:
      return SerovalTemporalType.PlainDate;
    case Temporal.PlainDateTime:
      return SerovalTemporalType.PlainDateTime;
    case Temporal.PlainMonthDay:
      return SerovalTemporalType.PlainMonthDay;
    case Temporal.PlainTime:
      return SerovalTemporalType.PlainTime;
    case Temporal.PlainYearMonth:
      return SerovalTemporalType.PlainYearMonth;
    case Temporal.ZonedDateTime:
      return SerovalTemporalType.ZonedDateTime;
    default:
      return NIL;
  }
}

export const enum ObjectKind {
  Unsupported = 0,
  PlainObject = 1,
  NullObject = 2,
  Date = 3,
  Error = 4,
  AggregateError = 5,
  Boxed = 6,
  ArrayBuffer = 7,
  TypedArray = 8,
  BigIntTypedArray = 9,
  DataView = 10,
  Map = 11,
  Set = 12,
  Promise = 13,
  RegExp = 14,
  Temporal = 15,
  Iterable = 16,
}

export function getObjectClass(current: object): unknown {
  const currentClass: unknown = current.constructor;
  // `constructor` is an ordinary own property, so data can shadow it
  // (`JSON.parse('{"constructor":1}')`) and hide the real class. A class is
  // always callable, so anything else means the lookup was shadowed; only
  // then fall back to the prototype, keeping the common path free of it.
  if (currentClass !== NIL && typeof currentClass !== 'function') {
    const proto = Object.getPrototypeOf(current) as object | null;
    return proto === null ? NIL : proto.constructor;
  }
  return currentClass;
}

/**
 * Decides how an object is parsed. Shared by the sync, stream and async
 * parsers so the class checks and feature gates live in one place.
 */
export function getObjectKind(
  current: object,
  currentClass: unknown,
  features: number,
): ObjectKind {
  switch (currentClass) {
    case Object:
      return ObjectKind.PlainObject;
    case NIL:
      return ObjectKind.NullObject;
    case Date:
      return ObjectKind.Date;
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return ObjectKind.Error;
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return ObjectKind.Boxed;
    case ArrayBuffer:
      return ObjectKind.ArrayBuffer;
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
      return ObjectKind.TypedArray;
    case DataView:
      return ObjectKind.DataView;
    case Map:
      return ObjectKind.Map;
    case Set:
      return ObjectKind.Set;
    default:
      break;
  }
  if (currentClass === Promise || current instanceof Promise) {
    return ObjectKind.Promise;
  }
  if (features & Feature.RegExp && currentClass === RegExp) {
    return ObjectKind.RegExp;
  }
  if (
    features & Feature.BigIntTypedArray &&
    (currentClass === BigInt64Array || currentClass === BigUint64Array)
  ) {
    return ObjectKind.BigIntTypedArray;
  }
  if (
    features & Feature.AggregateError &&
    typeof AggregateError !== 'undefined' &&
    (currentClass === AggregateError || current instanceof AggregateError)
  ) {
    return ObjectKind.AggregateError;
  }
  if (
    features & Feature.Temporal &&
    typeof Temporal !== 'undefined' &&
    getTemporalType(currentClass) != null
  ) {
    return ObjectKind.Temporal;
  }
  // Slow path. Errors and iterables have very broad implementations.
  if (current instanceof Error) {
    return ObjectKind.Error;
  }
  if (SYM_ITERATOR in current || SYM_ASYNC_ITERATOR in current) {
    return ObjectKind.Iterable;
  }
  return ObjectKind.Unsupported;
}

export function createObjectNode(
  id: number,
  current: Record<string, unknown>,
  empty: boolean,
  record: SerovalObjectRecordNode,
): SerovalObjectNode | SerovalNullConstructorNode {
  return createSerovalNode(
    empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
    id,
    NIL,
    NIL,
    NIL,
    record,
    NIL,
    NIL,
    NIL,
    NIL,
    getObjectFlag(current),
  );
}

export function createMapNode(
  ctx: BaseParserContext,
  id: number,
  k: SerovalNode[],
  v: SerovalNode[],
): SerovalMapNode {
  return createSerovalNode(
    SerovalNodeType.Map,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    { k, v },
    NIL,
    parseSpecialReference(ctx, SpecialReference.MapSentinel),
  );
}

export function createPromiseConstructorNode(
  ctx: BaseParserContext,
  id: number,
  resolver: number,
): SerovalPromiseConstructorNode {
  return createSerovalNode(
    SerovalNodeType.PromiseConstructor,
    id,
    resolver,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    parseSpecialReference(ctx, SpecialReference.PromiseConstructor),
  );
}

export function getArrayBufferView<T extends ArrayBufferView>(
  ctx: BaseParserContext,
  current: T,
): T {
  if (!ctx.compactArrayBufferViews) {
    return current;
  }
  const buffer = new Uint8Array(
    current.buffer,
    current.byteOffset,
    current.byteLength,
  ).slice().buffer;
  const Constructor = current.constructor as new (buffer: ArrayBuffer) => T;
  return new Constructor(buffer);
}

function encodeArrayBuffer(current: ArrayBuffer): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(current).toString('base64');
  }
  const bytes = new Uint8Array(current);
  if (typeof bytes.toBase64 === 'function') {
    return bytes.toBase64();
  }
  let result = '';
  for (let i = 0, len = bytes.length; i < len; i++) {
    result += String.fromCharCode(bytes[i]);
  }
  return btoa(result);
}

export function createArrayBufferNode(
  ctx: BaseParserContext,
  id: number,
  current: ArrayBuffer,
): SerovalArrayBufferNode {
  return createSerovalNode(
    SerovalNodeType.ArrayBuffer,
    id,
    encodeArrayBuffer(current),
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    parseSpecialReference(ctx, SpecialReference.ArrayBufferConstructor),
  );
}
