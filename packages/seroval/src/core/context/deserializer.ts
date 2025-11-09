import {
  CONSTANT_VAL,
  ERROR_CONSTRUCTOR,
  SerovalNodeType,
  SerovalObjectFlags,
  SYMBOL_REF,
} from '../constants';
import {
  ARRAY_BUFFER_CONSTRUCTOR,
  PROMISE_CONSTRUCTOR,
  type PromiseConstructorResolver,
} from '../constructors';
import {
  SerovalDeserializationError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalUnsupportedNodeError,
} from '../errors';
import type { PluginAccessOptions } from '../plugin';
import { SerovalMode } from '../plugin';
import { getReference } from '../reference';
import type { Stream } from '../stream';
import { createStream, streamToAsyncIterable } from '../stream';
import { deserializeString } from '../string';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayBufferNode,
  SerovalArrayNode,
  SerovalAsyncIteratorFactoryInstanceNode,
  SerovalAsyncIteratorFactoryNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalDataViewNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalIteratorFactoryInstanceNode,
  SerovalIteratorFactoryNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalPromiseNode,
  SerovalPromiseRejectNode,
  SerovalPromiseResolveNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSetNode,
  SerovalStreamConstructorNode,
  SerovalStreamNextNode,
  SerovalStreamReturnNode,
  SerovalStreamThrowNode,
  SerovalTypedArrayNode,
} from '../types';
import type { Sequence } from '../utils/iterator-to-sequence';
import { sequenceToIterator } from '../utils/iterator-to-sequence';
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../utils/typed-array';
import { getTypedArrayConstructor } from '../utils/typed-array';

function applyObjectFlag(obj: unknown, flag: SerovalObjectFlags): unknown {
  switch (flag) {
    case SerovalObjectFlags.Frozen:
      return Object.freeze(obj);
    case SerovalObjectFlags.NonExtensible:
      return Object.preventExtensions(obj);
    case SerovalObjectFlags.Sealed:
      return Object.seal(obj);
    default:
      return obj;
  }
}

type AssignableValue = AggregateError | Error | Iterable<unknown>;
type AssignableNode = SerovalAggregateErrorNode | SerovalErrorNode;

export interface BaseDeserializerContextOptions extends PluginAccessOptions {
  refs?: Map<number, unknown>;
}

export interface BaseDeserializerContext extends PluginAccessOptions {
  readonly mode: SerovalMode;
  /**
   * Mapping ids to values
   */
  refs: Map<number, unknown>;
}

export function createBaseDeserializerContext(
  mode: SerovalMode,
  options: BaseDeserializerContextOptions,
): BaseDeserializerContext {
  return {
    mode,
    plugins: options.plugins,
    refs: options.refs || new Map(),
  };
}

export interface VanillaDeserializerContextOptions
  extends Omit<BaseDeserializerContextOptions, 'refs'> {
  markedRefs: number[] | Set<number>;
}

export interface VanillaDeserializerState {
  marked: Set<number>;
}

export interface VanillaDeserializerContext {
  mode: SerovalMode.Vanilla;
  base: BaseDeserializerContext;
  child: DeserializePluginContext | undefined;
  state: VanillaDeserializerState;
}

export function createVanillaDeserializerContext(
  options: VanillaDeserializerContextOptions,
): VanillaDeserializerContext {
  return {
    mode: SerovalMode.Vanilla,
    base: createBaseDeserializerContext(SerovalMode.Vanilla, options),
    child: undefined,
    state: {
      marked: new Set(options.markedRefs),
    },
  };
}

export interface CrossDeserializerContext {
  mode: SerovalMode.Cross;
  base: BaseDeserializerContext;
  child: DeserializePluginContext | undefined;
}

export type CrossDeserializerContextOptions = BaseDeserializerContextOptions;

export function createCrossDeserializerContext(
  options: CrossDeserializerContextOptions,
): CrossDeserializerContext {
  return {
    mode: SerovalMode.Cross,
    base: createBaseDeserializerContext(SerovalMode.Cross, options),
    child: undefined,
  };
}

type DeserializerContext =
  | VanillaDeserializerContext
  | CrossDeserializerContext;

export class DeserializePluginContext {
  constructor(private _p: DeserializerContext) {}

  deserialize<T>(node: SerovalNode): T {
    return deserialize(this._p, node) as T;
  }
}

function assignIndexedValueVanilla<T>(
  ctx: VanillaDeserializerContext,
  id: number,
  value: T,
): T {
  if (ctx.state.marked.has(id)) {
    ctx.base.refs.set(id, value);
  }
  return value;
}

function assignIndexedValueCross<T>(
  ctx: CrossDeserializerContext,
  id: number,
  value: T,
): T {
  if (!ctx.base.refs.has(id)) {
    ctx.base.refs.set(id, value);
  }
  return value;
}

function assignIndexedValue<T>(
  ctx: DeserializerContext,
  id: number,
  value: T,
): T {
  return ctx.mode === SerovalMode.Vanilla
    ? assignIndexedValueVanilla(ctx, id, value)
    : assignIndexedValueCross(ctx, id, value);
}

function deserializeReference(
  ctx: DeserializerContext,
  node: SerovalReferenceNode,
): unknown {
  return assignIndexedValue(
    ctx,
    node.i,
    getReference(deserializeString(node.s)),
  );
}

function deserializeArray(
  ctx: DeserializerContext,
  node: SerovalArrayNode,
): unknown[] {
  const len = node.l;
  const result: unknown[] = assignIndexedValue(
    ctx,
    node.i,
    new Array<unknown>(len),
  );
  let item: SerovalNode | undefined;
  for (let i = 0; i < len; i++) {
    item = node.a[i];
    if (item) {
      result[i] = deserialize(ctx, item);
    }
  }
  applyObjectFlag(result, node.o);
  return result;
}

function deserializeProperties(
  ctx: DeserializerContext,
  node: SerovalObjectRecordNode,
  result: Record<string | symbol, unknown>,
): Record<string | symbol, unknown> {
  const len = node.s;
  if (len) {
    const keys = node.k;
    const vals = node.v;
    for (let i = 0, key: SerovalObjectRecordKey; i < len; i++) {
      key = keys[i];
      if (typeof key === 'string') {
        result[deserializeString(key)] = deserialize(ctx, vals[i]);
      } else {
        result[deserialize(ctx, key) as symbol] = deserialize(ctx, vals[i]);
      }
    }
  }
  return result;
}

function deserializeObject(
  ctx: DeserializerContext,
  node: SerovalObjectNode | SerovalNullConstructorNode,
): Record<string, unknown> {
  const result = assignIndexedValue(
    ctx,
    node.i,
    (node.t === SerovalNodeType.Object ? {} : Object.create(null)) as Record<
      string,
      unknown
    >,
  );
  deserializeProperties(ctx, node.p, result);
  applyObjectFlag(result, node.o);
  return result;
}

function deserializeDate(
  ctx: DeserializerContext,
  node: SerovalDateNode,
): Date {
  return assignIndexedValue(ctx, node.i, new Date(node.s));
}

function deserializeRegExp(
  ctx: DeserializerContext,
  node: SerovalRegExpNode,
): RegExp {
  return assignIndexedValue(
    ctx,
    node.i,
    new RegExp(deserializeString(node.c), node.m),
  );
}

function deserializeSet(
  ctx: DeserializerContext,
  node: SerovalSetNode,
): Set<unknown> {
  const result = assignIndexedValue(ctx, node.i, new Set<unknown>());
  const items = node.a;
  for (let i = 0, len = node.l; i < len; i++) {
    result.add(deserialize(ctx, items[i]));
  }
  return result;
}

function deserializeMap(
  ctx: DeserializerContext,
  node: SerovalMapNode,
): Map<unknown, unknown> {
  const result = assignIndexedValue(ctx, node.i, new Map<unknown, unknown>());
  const keys = node.e.k;
  const vals = node.e.v;
  for (let i = 0, len = node.e.s; i < len; i++) {
    result.set(deserialize(ctx, keys[i]), deserialize(ctx, vals[i]));
  }
  return result;
}

function deserializeArrayBuffer(
  ctx: DeserializerContext,
  node: SerovalArrayBufferNode,
): ArrayBuffer {
  const result = assignIndexedValue(
    ctx,
    node.i,
    ARRAY_BUFFER_CONSTRUCTOR(node.l, deserializeString(node.s)),
  );
  return result;
}

function deserializeTypedArray(
  ctx: DeserializerContext,
  node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
): TypedArrayValue | BigIntTypedArrayValue {
  const construct = getTypedArrayConstructor(node.c) as Int8ArrayConstructor;
  const source = deserialize(ctx, node.f) as ArrayBuffer;
  const result = assignIndexedValue(
    ctx,
    node.i,
    new construct(source, node.b, node.l),
  );
  return result;
}

function deserializeDataView(
  ctx: DeserializerContext,
  node: SerovalDataViewNode,
): DataView {
  const source = deserialize(ctx, node.f) as ArrayBuffer;
  const result = assignIndexedValue(
    ctx,
    node.i,
    new DataView(source, node.b, node.l),
  );
  return result;
}

function deserializeDictionary<T extends AssignableValue>(
  ctx: DeserializerContext,
  node: AssignableNode,
  result: T,
): T {
  if (node.p) {
    const fields = deserializeProperties(ctx, node.p, {});
    Object.assign(result, fields);
  }
  return result;
}

function deserializeAggregateError(
  ctx: DeserializerContext,
  node: SerovalAggregateErrorNode,
): AggregateError {
  // Serialize the required arguments
  const result = assignIndexedValue(
    ctx,
    node.i,
    new AggregateError([], deserializeString(node.m)),
  );
  // `AggregateError` might've been extended
  // either through class or custom properties
  // Make sure to assign extra properties
  return deserializeDictionary(ctx, node, result);
}

function deserializeError(
  ctx: DeserializerContext,
  node: SerovalErrorNode,
): Error {
  const construct = ERROR_CONSTRUCTOR[node.s];
  const result = assignIndexedValue(
    ctx,
    node.i,
    new construct(deserializeString(node.m)),
  );
  return deserializeDictionary(ctx, node, result);
}

function deserializePromise(
  ctx: DeserializerContext,
  node: SerovalPromiseNode,
): Promise<unknown> {
  const deferred = PROMISE_CONSTRUCTOR();
  const result = assignIndexedValue(ctx, node.i, deferred.p);
  const deserialized = deserialize(ctx, node.f);
  if (node.s) {
    deferred.s(deserialized);
  } else {
    deferred.f(deserialized);
  }
  return result;
}

function deserializeBoxed(
  ctx: DeserializerContext,
  node: SerovalBoxedNode,
): unknown {
  // biome-ignore lint/style/useConsistentBuiltinInstantiation: intended
  return assignIndexedValue(ctx, node.i, Object(deserialize(ctx, node.f)));
}

function deserializePlugin(
  ctx: DeserializerContext,
  node: SerovalPluginNode,
): unknown {
  const currentPlugins = ctx.base.plugins;
  if (currentPlugins) {
    const tag = deserializeString(node.c);
    for (let i = 0, len = currentPlugins.length; i < len; i++) {
      const plugin = currentPlugins[i];
      if (plugin.tag === tag) {
        if (ctx.child == null) {
          ctx.child = new DeserializePluginContext(ctx);
        }
        return assignIndexedValue(
          ctx,
          node.i,
          plugin.deserialize(node.s, ctx.child, {
            id: node.i,
          }),
        );
      }
    }
  }
  throw new SerovalMissingPluginError(node.c);
}

function deserializePromiseConstructor(
  ctx: DeserializerContext,
  node: SerovalPromiseConstructorNode,
): unknown {
  return assignIndexedValue(
    ctx,
    node.i,
    assignIndexedValue(ctx, node.s, PROMISE_CONSTRUCTOR()).p,
  );
}

function deserializePromiseResolve(
  ctx: DeserializerContext,
  node: SerovalPromiseResolveNode,
): unknown {
  const deferred = ctx.base.refs.get(node.i) as
    | PromiseConstructorResolver
    | undefined;
  if (deferred) {
    deferred.s(deserialize(ctx, node.a[1]));
    return undefined;
  }
  throw new SerovalMissingInstanceError('Promise');
}

function deserializePromiseReject(
  ctx: DeserializerContext,
  node: SerovalPromiseRejectNode,
): unknown {
  const deferred = ctx.base.refs.get(node.i) as
    | PromiseConstructorResolver
    | undefined;
  if (deferred) {
    deferred.f(deserialize(ctx, node.a[1]));
    return undefined;
  }
  throw new SerovalMissingInstanceError('Promise');
}

function deserializeIteratorFactoryInstance(
  ctx: DeserializerContext,
  node: SerovalIteratorFactoryInstanceNode,
): unknown {
  deserialize(ctx, node.a[0]);
  const source = deserialize(ctx, node.a[1]);
  return sequenceToIterator(source as Sequence);
}

function deserializeAsyncIteratorFactoryInstance(
  ctx: DeserializerContext,
  node: SerovalAsyncIteratorFactoryInstanceNode,
): unknown {
  deserialize(ctx, node.a[0]);
  const source = deserialize(ctx, node.a[1]);
  return streamToAsyncIterable(source as Stream<any>);
}

function deserializeStreamConstructor(
  ctx: DeserializerContext,
  node: SerovalStreamConstructorNode,
): unknown {
  const result = assignIndexedValue(ctx, node.i, createStream());
  const len = node.a.length;
  if (len) {
    for (let i = 0; i < len; i++) {
      deserialize(ctx, node.a[i]);
    }
  }
  return result;
}

function deserializeStreamNext(
  ctx: DeserializerContext,
  node: SerovalStreamNextNode,
): unknown {
  const deferred = ctx.base.refs.get(node.i) as Stream<unknown> | undefined;
  if (deferred) {
    deferred.next(deserialize(ctx, node.f));
    return undefined;
  }
  throw new SerovalMissingInstanceError('Stream');
}

function deserializeStreamThrow(
  ctx: DeserializerContext,
  node: SerovalStreamThrowNode,
): unknown {
  const deferred = ctx.base.refs.get(node.i) as Stream<unknown> | undefined;
  if (deferred) {
    deferred.throw(deserialize(ctx, node.f));
    return undefined;
  }
  throw new SerovalMissingInstanceError('Stream');
}

function deserializeStreamReturn(
  ctx: DeserializerContext,
  node: SerovalStreamReturnNode,
): unknown {
  const deferred = ctx.base.refs.get(node.i) as Stream<unknown> | undefined;
  if (deferred) {
    deferred.return(deserialize(ctx, node.f));
    return undefined;
  }
  throw new SerovalMissingInstanceError('Stream');
}

function deserializeIteratorFactory(
  ctx: DeserializerContext,
  node: SerovalIteratorFactoryNode,
): unknown {
  deserialize(ctx, node.f);
  return undefined;
}

function deserializeAsyncIteratorFactory(
  ctx: DeserializerContext,
  node: SerovalAsyncIteratorFactoryNode,
): unknown {
  deserialize(ctx, node.a[1]);
  return undefined;
}
export function deserialize(
  ctx: DeserializerContext,
  node: SerovalNode,
): unknown {
  switch (node.t) {
    case SerovalNodeType.Constant:
      return CONSTANT_VAL[node.s];
    case SerovalNodeType.Number:
      return node.s;
    case SerovalNodeType.String:
      return deserializeString(node.s);
    case SerovalNodeType.BigInt:
      return BigInt(node.s);
    case SerovalNodeType.IndexedValue:
      return ctx.base.refs.get(node.i);
    case SerovalNodeType.Reference:
      return deserializeReference(ctx, node);
    case SerovalNodeType.Array:
      return deserializeArray(ctx, node);
    case SerovalNodeType.Object:
    case SerovalNodeType.NullConstructor:
      return deserializeObject(ctx, node);
    case SerovalNodeType.Date:
      return deserializeDate(ctx, node);
    case SerovalNodeType.RegExp:
      return deserializeRegExp(ctx, node);
    case SerovalNodeType.Set:
      return deserializeSet(ctx, node);
    case SerovalNodeType.Map:
      return deserializeMap(ctx, node);
    case SerovalNodeType.ArrayBuffer:
      return deserializeArrayBuffer(ctx, node);
    case SerovalNodeType.BigIntTypedArray:
    case SerovalNodeType.TypedArray:
      return deserializeTypedArray(ctx, node);
    case SerovalNodeType.DataView:
      return deserializeDataView(ctx, node);
    case SerovalNodeType.AggregateError:
      return deserializeAggregateError(ctx, node);
    case SerovalNodeType.Error:
      return deserializeError(ctx, node);
    case SerovalNodeType.Promise:
      return deserializePromise(ctx, node);
    case SerovalNodeType.WKSymbol:
      return SYMBOL_REF[node.s];
    case SerovalNodeType.Boxed:
      return deserializeBoxed(ctx, node);
    case SerovalNodeType.Plugin:
      return deserializePlugin(ctx, node);
    case SerovalNodeType.PromiseConstructor:
      return deserializePromiseConstructor(ctx, node);
    case SerovalNodeType.PromiseSuccess:
      return deserializePromiseResolve(ctx, node);
    case SerovalNodeType.PromiseFailure:
      return deserializePromiseReject(ctx, node);
    case SerovalNodeType.IteratorFactoryInstance:
      return deserializeIteratorFactoryInstance(ctx, node);
    case SerovalNodeType.AsyncIteratorFactoryInstance:
      return deserializeAsyncIteratorFactoryInstance(ctx, node);
    case SerovalNodeType.StreamConstructor:
      return deserializeStreamConstructor(ctx, node);
    case SerovalNodeType.StreamNext:
      return deserializeStreamNext(ctx, node);
    case SerovalNodeType.StreamThrow:
      return deserializeStreamThrow(ctx, node);
    case SerovalNodeType.StreamReturn:
      return deserializeStreamReturn(ctx, node);
    case SerovalNodeType.IteratorFactory:
      return deserializeIteratorFactory(ctx, node);
    case SerovalNodeType.AsyncIteratorFactory:
      return deserializeAsyncIteratorFactory(ctx, node);
    // case SerovalNodeType.SpecialReference:
    default:
      throw new SerovalUnsupportedNodeError(node);
  }
}

export function deserializeTop(
  ctx: DeserializerContext,
  node: SerovalNode,
): unknown {
  try {
    return deserialize(ctx, node);
  } catch (error) {
    throw new SerovalDeserializationError(error);
  }
}
