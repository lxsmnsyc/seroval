import {
  CONSTANT_VAL,
  ERROR_CONSTRUCTOR,
  SYMBOL_REF,
  SerovalNodeType,
  SerovalObjectFlags,
} from '../constants';
import {
  SerovalDeserializationError,
  SerovalMissingInstanceError,
  SerovalMissingPluginError,
  SerovalUnsupportedNodeError,
} from '../errors';
import type { Plugin, PluginAccessOptions, SerovalMode } from '../plugin';
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
import assert from '../utils/assert';
import type { Deferred } from '../utils/deferred';
import { createDeferred } from '../utils/deferred';
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

export interface BaseDeserializerOptions extends PluginAccessOptions {
  refs?: Map<number, unknown>;
}

export default abstract class BaseDeserializerContext
  implements PluginAccessOptions
{
  abstract readonly mode: SerovalMode;

  /**
   * Mapping ids to values
   * @private
   */
  refs: Map<number, unknown>;

  plugins?: Plugin<any, any>[] | undefined;

  constructor(options: BaseDeserializerOptions) {
    this.plugins = options.plugins;
    this.refs = options.refs || new Map<number, unknown>();
  }

  protected abstract assignIndexedValue<T>(id: number, value: T): T;

  private deserializeReference(node: SerovalReferenceNode): unknown {
    return this.assignIndexedValue(
      node.i,
      getReference(deserializeString(node.s)),
    );
  }

  private deserializeArray(node: SerovalArrayNode): unknown[] {
    const len = node.l;
    const result: unknown[] = this.assignIndexedValue(
      node.i,
      new Array<unknown>(len),
    );
    let item: SerovalNode | undefined;
    for (let i = 0; i < len; i++) {
      item = node.a[i];
      if (item) {
        result[i] = this.deserialize(item);
      }
    }
    applyObjectFlag(result, node.o);
    return result;
  }

  private deserializeProperties(
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
          result[deserializeString(key)] = this.deserialize(vals[i]);
        } else {
          result[this.deserialize(key) as symbol] = this.deserialize(vals[i]);
        }
      }
    }
    return result;
  }

  private deserializeObject(
    node: SerovalObjectNode | SerovalNullConstructorNode,
  ): Record<string, unknown> {
    const result = this.assignIndexedValue(
      node.i,
      (node.t === SerovalNodeType.Object ? {} : Object.create(null)) as Record<
        string,
        unknown
      >,
    );
    this.deserializeProperties(node.p, result);
    applyObjectFlag(result, node.o);
    return result;
  }

  private deserializeDate(node: SerovalDateNode): Date {
    return this.assignIndexedValue(node.i, new Date(node.s));
  }

  private deserializeRegExp(node: SerovalRegExpNode): RegExp {
    return this.assignIndexedValue(
      node.i,
      new RegExp(deserializeString(node.c), node.m),
    );
  }

  private deserializeSet(node: SerovalSetNode): Set<unknown> {
    const result = this.assignIndexedValue(node.i, new Set<unknown>());
    const items = node.a;
    for (let i = 0, len = node.l; i < len; i++) {
      result.add(this.deserialize(items[i]));
    }
    return result;
  }

  private deserializeMap(node: SerovalMapNode): Map<unknown, unknown> {
    const result = this.assignIndexedValue(node.i, new Map<unknown, unknown>());
    const keys = node.e.k;
    const vals = node.e.v;
    for (let i = 0, len = node.e.s; i < len; i++) {
      result.set(this.deserialize(keys[i]), this.deserialize(vals[i]));
    }
    return result;
  }

  private deserializeArrayBuffer(node: SerovalArrayBufferNode): ArrayBuffer {
    const bytes = new Uint8Array(node.s);
    const result = this.assignIndexedValue(node.i, bytes.buffer);
    return result;
  }

  private deserializeTypedArray(
    node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
  ): TypedArrayValue | BigIntTypedArrayValue {
    const construct = getTypedArrayConstructor(node.c);
    const source = this.deserialize(node.f) as ArrayBuffer;
    const result = this.assignIndexedValue(
      node.i,
      new construct(source, node.b, node.l),
    );
    return result;
  }

  private deserializeDataView(node: SerovalDataViewNode): DataView {
    const source = this.deserialize(node.f) as ArrayBuffer;
    const result = this.assignIndexedValue(
      node.i,
      new DataView(source, node.b, node.l),
    );
    return result;
  }

  private deserializeDictionary<T extends AssignableValue>(
    node: AssignableNode,
    result: T,
  ): T {
    if (node.p) {
      const fields = this.deserializeProperties(node.p, {});
      Object.assign(result, fields);
    }
    return result;
  }

  private deserializeAggregateError(
    node: SerovalAggregateErrorNode,
  ): AggregateError {
    // Serialize the required arguments
    const result = this.assignIndexedValue(
      node.i,
      new AggregateError([], deserializeString(node.m)),
    );
    // `AggregateError` might've been extended
    // either through class or custom properties
    // Make sure to assign extra properties
    return this.deserializeDictionary(node, result);
  }

  private deserializeError(node: SerovalErrorNode): Error {
    const construct = ERROR_CONSTRUCTOR[node.s];
    const result = this.assignIndexedValue(
      node.i,
      new construct(deserializeString(node.m)),
    );
    return this.deserializeDictionary(node, result);
  }

  private deserializePromise(node: SerovalPromiseNode): Promise<unknown> {
    const deferred = createDeferred();
    const result = this.assignIndexedValue(node.i, deferred);
    const deserialized = this.deserialize(node.f);
    if (node.s) {
      deferred.resolve(deserialized);
    } else {
      deferred.reject(deserialized);
    }
    return result.promise;
  }

  private deserializeBoxed(node: SerovalBoxedNode): unknown {
    return this.assignIndexedValue(node.i, Object(this.deserialize(node.f)));
  }

  private deserializePlugin(node: SerovalPluginNode): unknown {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      const tag = deserializeString(node.c);
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.tag === tag) {
          return this.assignIndexedValue(
            node.i,
            plugin.deserialize(node.s, this, {
              id: node.i,
            }),
          );
        }
      }
    }
    throw new SerovalMissingPluginError(node.c);
  }

  private deserializePromiseConstructor(
    node: SerovalPromiseConstructorNode,
  ): unknown {
    return this.assignIndexedValue(node.i, createDeferred()).promise;
  }

  private deserializePromiseResolve(node: SerovalPromiseResolveNode): unknown {
    const deferred = this.refs.get(node.i) as Deferred | undefined;
    assert(deferred, new SerovalMissingInstanceError('Promise'));
    deferred.resolve(this.deserialize(node.a[1]));
    return undefined;
  }

  private deserializePromiseReject(node: SerovalPromiseRejectNode): unknown {
    const deferred = this.refs.get(node.i) as Deferred | undefined;
    assert(deferred, new SerovalMissingInstanceError('Promise'));
    deferred.reject(this.deserialize(node.a[1]));
    return undefined;
  }

  private deserializeIteratorFactoryInstance(
    node: SerovalIteratorFactoryInstanceNode,
  ): unknown {
    this.deserialize(node.a[0]);
    const source = this.deserialize(node.a[1]);
    return sequenceToIterator(source as Sequence);
  }

  private deserializeAsyncIteratorFactoryInstance(
    node: SerovalAsyncIteratorFactoryInstanceNode,
  ): unknown {
    this.deserialize(node.a[0]);
    const source = this.deserialize(node.a[1]);
    return streamToAsyncIterable(source as Stream<any>);
  }

  private deserializeStreamConstructor(
    node: SerovalStreamConstructorNode,
  ): unknown {
    const result = this.assignIndexedValue(node.i, createStream());
    const len = node.a.length;
    if (len) {
      for (let i = 0; i < len; i++) {
        this.deserialize(node.a[i]);
      }
    }
    return result;
  }

  private deserializeStreamNext(node: SerovalStreamNextNode): unknown {
    const deferred = this.refs.get(node.i) as Stream<unknown> | undefined;
    assert(deferred, new SerovalMissingInstanceError('Stream'));
    deferred.next(this.deserialize(node.f));
    return undefined;
  }

  private deserializeStreamThrow(node: SerovalStreamThrowNode): unknown {
    const deferred = this.refs.get(node.i) as Stream<unknown> | undefined;
    assert(deferred, new SerovalMissingInstanceError('Stream'));
    deferred.throw(this.deserialize(node.f));
    return undefined;
  }

  private deserializeStreamReturn(node: SerovalStreamReturnNode): unknown {
    const deferred = this.refs.get(node.i) as Stream<unknown> | undefined;
    assert(deferred, new SerovalMissingInstanceError('Stream'));
    deferred.return(this.deserialize(node.f));
    return undefined;
  }

  private deserializeIteratorFactory(
    node: SerovalIteratorFactoryNode,
  ): unknown {
    this.deserialize(node.f);
    return undefined;
  }

  private deserializeAsyncIteratorFactory(
    node: SerovalAsyncIteratorFactoryNode,
  ): unknown {
    this.deserialize(node.a[1]);
    return undefined;
  }

  deserialize(node: SerovalNode): unknown {
    try {
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
          return this.refs.get(node.i);
        case SerovalNodeType.Reference:
          return this.deserializeReference(node);
        case SerovalNodeType.Array:
          return this.deserializeArray(node);
        case SerovalNodeType.Object:
        case SerovalNodeType.NullConstructor:
          return this.deserializeObject(node);
        case SerovalNodeType.Date:
          return this.deserializeDate(node);
        case SerovalNodeType.RegExp:
          return this.deserializeRegExp(node);
        case SerovalNodeType.Set:
          return this.deserializeSet(node);
        case SerovalNodeType.Map:
          return this.deserializeMap(node);
        case SerovalNodeType.ArrayBuffer:
          return this.deserializeArrayBuffer(node);
        case SerovalNodeType.BigIntTypedArray:
        case SerovalNodeType.TypedArray:
          return this.deserializeTypedArray(node);
        case SerovalNodeType.DataView:
          return this.deserializeDataView(node);
        case SerovalNodeType.AggregateError:
          return this.deserializeAggregateError(node);
        case SerovalNodeType.Error:
          return this.deserializeError(node);
        case SerovalNodeType.Promise:
          return this.deserializePromise(node);
        case SerovalNodeType.WKSymbol:
          return SYMBOL_REF[node.s];
        case SerovalNodeType.Boxed:
          return this.deserializeBoxed(node);
        case SerovalNodeType.Plugin:
          return this.deserializePlugin(node);
        case SerovalNodeType.PromiseConstructor:
          return this.deserializePromiseConstructor(node);
        case SerovalNodeType.PromiseResolve:
          return this.deserializePromiseResolve(node);
        case SerovalNodeType.PromiseReject:
          return this.deserializePromiseReject(node);
        case SerovalNodeType.IteratorFactoryInstance:
          return this.deserializeIteratorFactoryInstance(node);
        case SerovalNodeType.AsyncIteratorFactoryInstance:
          return this.deserializeAsyncIteratorFactoryInstance(node);
        case SerovalNodeType.StreamConstructor:
          return this.deserializeStreamConstructor(node);
        case SerovalNodeType.StreamNext:
          return this.deserializeStreamNext(node);
        case SerovalNodeType.StreamThrow:
          return this.deserializeStreamThrow(node);
        case SerovalNodeType.StreamReturn:
          return this.deserializeStreamReturn(node);
        case SerovalNodeType.IteratorFactory:
          return this.deserializeIteratorFactory(node);
        case SerovalNodeType.AsyncIteratorFactory:
          return this.deserializeAsyncIteratorFactory(node);
        // case SerovalNodeType.SpecialReference:
        default:
          throw new SerovalUnsupportedNodeError(node);
      }
    } catch (error) {
      throw new SerovalDeserializationError(error);
    }
  }
}
