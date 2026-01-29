import { ALL_ENABLED, Feature } from '../core/compat';
import {
  type BigIntTypedArrayValue,
  DEFAULT_DEPTH_LIMIT,
  getBigIntTypedArrayTag,
  getTypedArrayTag,
  INV_SYMBOL_REF,
  isWellKnownSymbol,
  NIL,
  SerovalConstant,
  type TypedArrayValue,
} from '../core/constants';
import {
  SerovalDepthLimitError,
  SerovalUnsupportedTypeError,
} from '../core/errors';
import { OpaqueReference } from '../core/opaque-reference';
import {
  createSequenceFromIterable,
  isSequence,
  type Sequence,
} from '../core/sequence';
import {
  createStreamFromAsyncIterable,
  isStream,
  type Stream,
} from '../core/stream';
import {
  SYM_ASYNC_ITERATOR,
  SYM_IS_CONCAT_SPREADABLE,
  SYM_ITERATOR,
  SYM_TO_STRING_TAG,
} from '../core/symbols';
import { getErrorConstructor, getErrorOptions } from '../core/utils/error';
import { getObjectFlag } from '../core/utils/get-object-flag';
import { type SerovalNode, SerovalNodeType } from './nodes';
import type { Plugin } from './plugin';
import { bigintToBytes } from './utils';

export interface ParserContext {
  alive: boolean;
  pending: number;
  depthLimit: number;
  refs: Map<unknown, number>;
  features: number;
  plugins?: Plugin<any, any>[];
  onParse(node: SerovalNode): void;
  onDone(): void;
  onError(error: unknown): void;
}

export interface ParserContextOptions {
  features?: number;
  disabledFeatures?: number;
  depthLimit?: number;
  refs: Map<unknown, number>;
  plugins?: Plugin<any, any>[];
  onParse(node: SerovalNode): void;
  onDone(): void;
  onError(error: unknown): void;
}

export function createParserContext(
  options: ParserContextOptions,
): ParserContext {
  return {
    alive: true,
    pending: 0,
    refs: options.refs ?? new Map(),
    depthLimit: options.depthLimit ?? DEFAULT_DEPTH_LIMIT,
    features: options.features ?? ALL_ENABLED ^ (options.disabledFeatures || 0),
    onParse: options.onParse,
    onDone: options.onDone,
    onError: options.onError,
    plugins: options.plugins,
  };
}

function pushPendingState(ctx: ParserContext): void {
  ctx.pending++;
}

function popPendingState(ctx: ParserContext): void {
  if (--ctx.pending <= 0) {
    ctx.onDone();
  }
}

let CURRENT_DEPTH = 0;

function parseWithError<T>(
  ctx: ParserContext,
  depth: number,
  current: T,
): number | undefined {
  const prevDepth = CURRENT_DEPTH;
  CURRENT_DEPTH = depth;
  try {
    return parse(ctx, current);
  } catch (err) {
    ctx.onError(err);
    return NIL;
  } finally {
    CURRENT_DEPTH = prevDepth;
  }
}

function createID(ctx: ParserContext, value: unknown): number {
  const id = ctx.refs.size + 1;
  ctx.refs.set(value, id);
  return id;
}

function parseConstant(ctx: ParserContext, value: SerovalConstant) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Constant, id, value]);
  return id;
}

function parseNumber(ctx: ParserContext, value: number) {
  switch (value) {
    case Number.POSITIVE_INFINITY:
      return parseConstant(ctx, SerovalConstant.Inf);
    case Number.NEGATIVE_INFINITY:
      return parseConstant(ctx, SerovalConstant.NegInf);
  }
  if (value !== value) {
    return parseConstant(ctx, SerovalConstant.Nan);
  }
  if (Object.is(value, -0)) {
    return parseConstant(ctx, SerovalConstant.NegZero);
  }
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Number, id, value]);
  return id;
}

function parseString(ctx: ParserContext, value: string) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.String, id, value]);
  return id;
}

function parseBigInt(ctx: ParserContext, value: bigint) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.BigInt, id, parse(ctx, bigintToBytes(value))]);
  return id;
}

function parseWellKnownSymbol(ctx: ParserContext, value: symbol): number {
  if (isWellKnownSymbol(value)) {
    const id = createID(ctx, value);
    ctx.onParse([SerovalNodeType.WKSymbol, id, INV_SYMBOL_REF[value]]);
    return id;
  }
  // TODO allow plugins to support symbols?
  throw new SerovalUnsupportedTypeError(value);
}

function parseArray(ctx: ParserContext, value: unknown[]) {
  const id = createID(ctx, value);
  const len = value.length;
  ctx.onParse([SerovalNodeType.Array, id, getObjectFlag(value), len]);
  for (let i = 0; i < len; i++) {
    if (i in value) {
      ctx.onParse([SerovalNodeType.ArrayAssign, id, i, parse(ctx, value[i])]);
    }
  }
  ctx.onParse([SerovalNodeType.Close, id]);
  return id;
}

function parseStream(ctx: ParserContext, current: Stream<unknown>) {
  const id = createID(ctx, current);
  pushPendingState(ctx);
  ctx.onParse([SerovalNodeType.Stream, id]);

  const prevDepth = CURRENT_DEPTH;

  current.on({
    next: value => {
      if (ctx.alive) {
        const parsed = parseWithError(ctx, prevDepth, value);
        if (parsed) {
          ctx.onParse([SerovalNodeType.Add, id, parsed]);
        }
      }
    },
    throw: value => {
      if (ctx.alive) {
        const parsed = parseWithError(ctx, prevDepth, value);
        if (parsed) {
          ctx.onParse([SerovalNodeType.Throw, id, parsed]);
        }
      }
      popPendingState(ctx);
    },
    return: value => {
      if (ctx.alive) {
        const parsed = parseWithError(ctx, prevDepth, value);
        if (parsed) {
          ctx.onParse([SerovalNodeType.Return, id, parsed]);
        }
      }
      popPendingState(ctx);
    },
  });
  return id;
}

function parseSequence(ctx: ParserContext, value: Sequence) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Sequence, id, value.t, value.d]);
  for (let i = 0, len = value.v.length; i < len; i++) {
    ctx.onParse([SerovalNodeType.Add, id, parse(ctx, value.v[i])]);
  }
  ctx.onParse([SerovalNodeType.Close, id]);
  return id;
}

function parseProperties(ctx: ParserContext, id: number, properties: object) {
  const entries = Object.entries(properties);
  for (let i = 0, len = entries.length; i < len; i++) {
    ctx.onParse([
      SerovalNodeType.ObjectAssign,
      id,
      parse(ctx, entries[i][0]),
      parse(ctx, entries[i][1]),
    ]);
  }

  // Check special properties, symbols in this case
  if (SYM_ITERATOR in properties) {
    ctx.onParse([
      SerovalNodeType.ObjectAssign,
      id,
      parse(ctx, SYM_ITERATOR),
      parse(
        ctx,
        createSequenceFromIterable(properties as unknown as Iterable<unknown>),
      ),
    ]);
  }
  if (SYM_ASYNC_ITERATOR in properties) {
    ctx.onParse([
      SerovalNodeType.ObjectAssign,
      id,
      parse(ctx, SYM_ASYNC_ITERATOR),
      parse(
        ctx,
        createStreamFromAsyncIterable(
          properties as unknown as AsyncIterable<unknown>,
        ),
      ),
    ]);
  }
  if (SYM_TO_STRING_TAG in properties) {
    ctx.onParse([
      SerovalNodeType.ObjectAssign,
      id,
      parse(ctx, SYM_TO_STRING_TAG),
      parse(ctx, properties[SYM_TO_STRING_TAG]),
    ]);
  }
  if (SYM_IS_CONCAT_SPREADABLE in properties) {
    ctx.onParse([
      SerovalNodeType.ObjectAssign,
      id,
      parse(ctx, SYM_IS_CONCAT_SPREADABLE),
      parse(ctx, properties[SYM_IS_CONCAT_SPREADABLE]),
    ]);
  }
}

function parsePlainObject(ctx: ParserContext, value: object, empty: boolean) {
  const id = createID(ctx, value);
  ctx.onParse([
    empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
    id,
    getObjectFlag(value),
  ]);
  parseProperties(ctx, id, value);
  ctx.onParse([SerovalNodeType.Close, id]);
  return id;
}

function parseDate(ctx: ParserContext, value: Date) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Date, id, value.getTime()]);
  return id;
}

function parseError(ctx: ParserContext, value: Error) {
  const id = createID(ctx, value);
  ctx.onParse([
    SerovalNodeType.Error,
    id,
    getErrorConstructor(value),
    parse(ctx, value.message),
  ]);
  const properties = getErrorOptions(value, ctx.features);
  if (properties) {
    parseProperties(ctx, id, properties);
  }
  ctx.onParse([SerovalNodeType.Close, id]);
  return id;
}

function parseBoxed(ctx: ParserContext, value: object) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Boxed, id, parse(ctx, value.valueOf())]);
  return id;
}

function parseArrayBuffer(ctx: ParserContext, value: ArrayBuffer) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.ArrayBuffer, id, new Uint8Array(value)]);
  return id;
}

function parseTypedArray(ctx: ParserContext, value: TypedArrayValue) {
  const id = createID(ctx, value);
  ctx.onParse([
    SerovalNodeType.TypedArray,
    id,
    getTypedArrayTag(value),
    value.byteOffset,
    value.byteLength,
    parse(ctx, value.buffer),
  ]);
  return id;
}

function parseBigIntTypedArray(
  ctx: ParserContext,
  value: BigIntTypedArrayValue,
) {
  const id = createID(ctx, value);
  ctx.onParse([
    SerovalNodeType.BigIntTypedArray,
    id,
    getBigIntTypedArrayTag(value),
    value.byteOffset,
    value.byteLength,
    parse(ctx, value.buffer),
  ]);
  return id;
}

function parseDataView(ctx: ParserContext, value: DataView) {
  const id = createID(ctx, value);
  ctx.onParse([
    SerovalNodeType.DataView,
    id,
    value.byteOffset,
    value.byteLength,
    parse(ctx, value.buffer),
  ]);
  return id;
}

function parseMap(ctx: ParserContext, value: Map<unknown, unknown>) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Map, id]);
  for (const [key, val] of value.entries()) {
    ctx.onParse([
      SerovalNodeType.ObjectAssign,
      id,
      parse(ctx, key),
      parse(ctx, val),
    ]);
  }
  ctx.onParse([SerovalNodeType.Close, id]);
  return id;
}

function parseSet(ctx: ParserContext, value: Set<unknown>) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Set, id]);
  for (const key of value.keys()) {
    ctx.onParse([SerovalNodeType.Add, id, parse(ctx, key)]);
  }
  ctx.onParse([SerovalNodeType.Close, id]);
  return id;
}

function parsePromise(ctx: ParserContext, value: Promise<unknown>) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.Promise, id]);
  const prevDepth = CURRENT_DEPTH;
  pushPendingState(ctx);
  value.then(
    val => {
      if (ctx.alive) {
        const parsed = parseWithError(ctx, prevDepth, val);
        if (parsed) {
          ctx.onParse([SerovalNodeType.Return, id, parsed]);
        }
      }
      popPendingState(ctx);
    },
    val => {
      if (ctx.alive) {
        const parsed = parseWithError(ctx, prevDepth, val);
        if (parsed) {
          ctx.onParse([SerovalNodeType.Throw, id, parsed]);
        }
      }
      popPendingState(ctx);
    },
  );
  return id;
}

function parseRegExp(ctx: ParserContext, value: RegExp) {
  const id = createID(ctx, value);
  ctx.onParse([
    SerovalNodeType.RegExp,
    id,
    parse(ctx, value.source),
    parse(ctx, value.flags),
  ]);
  return id;
}

function parseAggregateError(ctx: ParserContext, value: AggregateError) {
  const id = createID(ctx, value);
  ctx.onParse([SerovalNodeType.AggregateError, id, parse(ctx, value.message)]);
  const properties = getErrorOptions(value, ctx.features);
  if (properties) {
    parseProperties(ctx, id, properties);
  }
  ctx.onParse([SerovalNodeType.Close, id]);
  return id;
}

function parseObjectPhase2(
  ctx: ParserContext,
  current: object,
  currentClass: unknown,
): number {
  switch (currentClass) {
    case Object:
      return parsePlainObject(ctx, current as Record<string, unknown>, false);
    case NIL:
      return parsePlainObject(ctx, current as Record<string, unknown>, true);
    case Date:
      return parseDate(ctx, current as Date);
    case Error:
    case EvalError:
    case RangeError:
    case ReferenceError:
    case SyntaxError:
    case TypeError:
    case URIError:
      return parseError(ctx, current as unknown as Error);
    case Number:
    case Boolean:
    case String:
    case BigInt:
      return parseBoxed(ctx, current);
    case ArrayBuffer:
      return parseArrayBuffer(ctx, current as unknown as ArrayBuffer);
    case Int8Array:
    case Int16Array:
    case Int32Array:
    case Uint8Array:
    case Uint16Array:
    case Uint32Array:
    case Uint8ClampedArray:
    case Float32Array:
    case Float64Array:
      return parseTypedArray(ctx, current as unknown as TypedArrayValue);
    case DataView:
      return parseDataView(ctx, current as unknown as DataView);
    case Map:
      return parseMap(ctx, current as unknown as Map<unknown, unknown>);
    case Set:
      return parseSet(ctx, current as unknown as Set<unknown>);
    default:
      break;
  }
  // Promises
  if (currentClass === Promise || current instanceof Promise) {
    return parsePromise(ctx, current as unknown as Promise<unknown>);
  }
  const currentFeatures = ctx.features;
  if (currentFeatures & Feature.RegExp && currentClass === RegExp) {
    return parseRegExp(ctx, current as unknown as RegExp);
  }
  // BigInt Typed Arrays
  if (currentFeatures & Feature.BigIntTypedArray) {
    switch (currentClass) {
      case BigInt64Array:
      case BigUint64Array:
        return parseBigIntTypedArray(
          ctx,
          current as unknown as BigIntTypedArrayValue,
        );
      default:
        break;
    }
  }
  if (
    currentFeatures & Feature.AggregateError &&
    typeof AggregateError !== 'undefined' &&
    (currentClass === AggregateError || current instanceof AggregateError)
  ) {
    return parseAggregateError(ctx, current as unknown as AggregateError);
  }
  // Slow path. We only need to handle Errors and Iterators
  // since they have very broad implementations.
  if (current instanceof Error) {
    return parseError(ctx, current);
  }
  // Generator functions don't have a global constructor
  // despite existing
  if (SYM_ITERATOR in current || SYM_ASYNC_ITERATOR in current) {
    return parsePlainObject(ctx, current, !!currentClass);
  }
  throw new SerovalUnsupportedTypeError(current);
}

function parsePlugin(ctx: ParserContext, value: object) {
  const plugins = ctx.plugins;
  if (plugins) {
    for (let i = 0, len = plugins.length; i < len; i++) {
      const current = plugins[i];
      if (current.test(value)) {
        const id = createID(ctx, value);
        ctx.onParse([
          SerovalNodeType.Plugin,
          id,
          parse(ctx, current.tag),
          parse(ctx, current.serialize(value)),
        ]);
        return id;
      }
    }
  }
  return undefined;
}

function parseObject(ctx: ParserContext, value: object) {
  const prevDepth = CURRENT_DEPTH;
  CURRENT_DEPTH += 1;
  try {
    if (Array.isArray(value)) {
      return parseArray(ctx, value);
    }
    if (isStream(value)) {
      return parseStream(ctx, value);
    }
    if (isSequence(value)) {
      return parseSequence(ctx, value);
    }
    const currentClass = value.constructor;
    if (currentClass === OpaqueReference) {
      return parse(
        ctx,
        (value as OpaqueReference<unknown, unknown>).replacement,
      );
    }
    const parsed = parsePlugin(ctx, value);
    if (parsed != null) {
      return parsed;
    }
    return parseObjectPhase2(ctx, value, currentClass);
  } finally {
    CURRENT_DEPTH = prevDepth;
  }
}

function parseFunction(ctx: ParserContext, current: Function) {
  const plugin = parsePlugin(ctx, current);
  if (plugin) {
    return plugin;
  }
  throw new SerovalUnsupportedTypeError(current);
}

function parse<T>(ctx: ParserContext, current: T): number {
  if (CURRENT_DEPTH >= ctx.depthLimit) {
    throw new SerovalDepthLimitError(ctx.depthLimit);
  }
  const currentID = ctx.refs.get(current);
  if (currentID != null) {
    return currentID;
  }
  switch (typeof current) {
    case 'boolean':
      return parseConstant(
        ctx,
        current ? SerovalConstant.True : SerovalConstant.False,
      );
    case 'undefined':
      return parseConstant(ctx, SerovalConstant.Undefined);
    case 'number':
      return parseNumber(ctx, current);
    case 'string':
      return parseString(ctx, current as string);
    case 'bigint':
      return parseBigInt(ctx, current as bigint);
    case 'object': {
      if (current) {
        return parseObject(ctx, current);
      }
      return parseConstant(ctx, SerovalConstant.Null);
    }
    case 'symbol':
      return parseWellKnownSymbol(ctx, current);
    case 'function': {
      return parseFunction(ctx, current);
    }
    default:
      throw new SerovalUnsupportedTypeError(current);
  }
}

export function startParse<T>(ctx: ParserContext, value: T) {
  const parsed = parseWithError(ctx, 0, value);
  if (parsed) {
    ctx.onParse([SerovalNodeType.Root, parsed]);

    if (ctx.pending <= 0) {
      endParse(ctx);
    }
  }
}

export function endParse(ctx: ParserContext) {
  if (ctx.alive) {
    ctx.onDone();
    ctx.alive = false;
  }
}
