import {
  createIndexedValueNode,
  createReferenceNode,
  createWKSymbolNode,
} from '../base-primitives';
import { ALL_ENABLED } from '../compat';
import type { WellKnownSymbols } from '../constants';
import { INV_SYMBOL_REF, NIL, SerovalNodeType } from '../constants';
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
