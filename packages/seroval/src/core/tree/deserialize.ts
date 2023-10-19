/* eslint-disable prefer-spread */
import { deserializeString } from '../string';
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import { getReference } from '../reference';
import { getTypedArrayConstructor } from '../shared';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayBufferNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalBlobNode,
  SerovalBoxedNode,
  SerovalCustomEventNode,
  SerovalDOMExceptionNode,
  SerovalDataViewNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalEventNode,
  SerovalFileNode,
  SerovalFormDataNode,
  SerovalHeadersNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalRequestNode,
  SerovalResponseNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
  SerovalURLNode,
  SerovalURLSearchParamsNode,
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
import {
  CONSTANT_VAL,
  ERROR_CONSTRUCTOR,
  SYMBOL_REF,
  SerovalNodeType,
  SerovalObjectFlags,
} from '../constants';
import type { Plugin, PluginAccessOptions } from '../plugin';

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

type AssignableValue = AggregateError | Error | Iterable<unknown>
type AssignableNode = SerovalAggregateErrorNode | SerovalErrorNode;

interface Deferred {
  resolve(value: unknown): void;
  reject(value: unknown): void;
  promise: Promise<unknown>;
}

function createDeferred(): Deferred {
  let resolve: Deferred['resolve'];
  let reject: Deferred['reject'];
  return {
    resolve(v): void {
      resolve(v);
    },
    reject(v): void {
      reject(v);
    },
    promise: new Promise((res, rej) => {
      resolve = res as Deferred['resolve'];
      reject = rej as Deferred['reject'];
    }),
  };
}

export interface DeserializerOptions extends PluginAccessOptions {
  markedRefs: number[] | Set<number>;
}

export default class VanillaDeserializerContext implements PluginAccessOptions {
  /**
   * Mapping ids to values
   * @private
   */
  values: Map<number, unknown> = new Map();

  /**
   * Which refs are pre-marked
   * @private
   */
  refs: Set<number>;

  plugins?: Plugin<any, any>[] | undefined;

  constructor(options: DeserializerOptions) {
    this.plugins = options.plugins;
    this.refs = new Set(options.markedRefs);
  }

  assignIndexedValue<T>(
    index: number,
    value: T,
  ): T {
    if (this.refs.has(index)) {
      this.values.set(index, value);
    }
    return value;
  }

  private deserializeReference(
    node: SerovalReferenceNode,
  ): unknown {
    return this.assignIndexedValue(node.i, getReference(deserializeString(node.s)));
  }

  private deserializeArray(
    node: SerovalArrayNode,
  ): unknown[] {
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
      let key: SerovalObjectRecordKey;
      let value: unknown;
      const keys = node.k;
      const vals = node.v;
      for (let i = 0; i < len; i++) {
        key = keys[i];
        value = this.deserialize(vals[i]);
        switch (key) {
          case SerovalObjectRecordSpecialKey.SymbolIterator: {
            const current = value as unknown[];
            result[Symbol.iterator] = (): IterableIterator<unknown> => current.values();
          }
            break;
          default:
            result[deserializeString(key)] = value;
            break;
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
      (node.t === SerovalNodeType.Object
        ? {}
        : Object.create(null)) as Record<string, unknown>,
    );
    this.deserializeProperties(node.p, result);
    applyObjectFlag(result, node.o);
    return result;
  }

  private deserializeDate(
    node: SerovalDateNode,
  ): Date {
    return this.assignIndexedValue(node.i, new Date(node.s));
  }

  private deserializeRegExp(
    node: SerovalRegExpNode,
  ): RegExp {
    return this.assignIndexedValue(node.i, new RegExp(node.c, node.m));
  }

  private deserializeSet(
    node: SerovalSetNode,
  ): Set<unknown> {
    const result = this.assignIndexedValue(node.i, new Set<unknown>());
    const items = node.a;
    for (let i = 0, len = node.l; i < len; i++) {
      result.add(this.deserialize(items[i]));
    }
    return result;
  }

  private deserializeMap(
    node: SerovalMapNode,
  ): Map<unknown, unknown> {
    const result = this.assignIndexedValue(
      node.i,
      new Map<unknown, unknown>(),
    );
    const keys = node.e.k;
    const vals = node.e.v;
    for (let i = 0, len = node.e.s; i < len; i++) {
      result.set(
        this.deserialize(keys[i]),
        this.deserialize(vals[i]),
      );
    }
    return result;
  }

  private deserializeArrayBuffer(
    node: SerovalArrayBufferNode,
  ): ArrayBuffer {
    const bytes = new Uint8Array(node.s);
    const result = this.assignIndexedValue(node.i, bytes.buffer);
    return result;
  }

  private deserializeTypedArray(
    node: SerovalTypedArrayNode | SerovalBigIntTypedArrayNode,
  ): TypedArrayValue | BigIntTypedArrayValue {
    const TypedArray = getTypedArrayConstructor(node.c);
    const source = this.deserialize(node.f) as ArrayBuffer;
    const result = this.assignIndexedValue(node.i, new TypedArray(
      source,
      node.b,
      node.l,
    ));
    return result;
  }

  private deserializeDataView(
    node: SerovalDataViewNode,
  ): DataView {
    const source = this.deserialize(node.f) as ArrayBuffer;
    const result = this.assignIndexedValue(node.i, new DataView(
      source,
      node.b,
      node.l,
    ));
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

  private deserializeError(
    node: SerovalErrorNode,
  ): Error {
    const ErrorConstructor = ERROR_CONSTRUCTOR[node.s];
    const result = this.assignIndexedValue(
      node.i,
      new ErrorConstructor(deserializeString(node.m)),
    );
    return this.deserializeDictionary(node, result);
  }

  private async deserializePromise(
    node: SerovalPromiseNode,
  ): Promise<unknown> {
    const deferred = createDeferred();
    const result = this.assignIndexedValue(node.i, deferred.promise);
    const deserialized = this.deserialize(node.f);
    if (node.s) {
      deferred.resolve(deserialized);
    } else {
      deferred.reject(deserialized);
    }
    return result;
  }

  private deserializeURL(
    node: SerovalURLNode,
  ): URL {
    return this.assignIndexedValue(node.i, new URL(deserializeString(node.s)));
  }

  private deserializeURLSearchParams(
    node: SerovalURLSearchParamsNode,
  ): URLSearchParams {
    return this.assignIndexedValue(node.i, new URLSearchParams(deserializeString(node.s)));
  }

  private deserializeBlob(
    node: SerovalBlobNode,
  ): Blob {
    const source = this.deserialize(node.f) as ArrayBuffer;
    const result = this.assignIndexedValue(node.i, new Blob(
      [source],
      { type: deserializeString(node.c) },
    ));
    return result;
  }

  private deserializeFile(
    node: SerovalFileNode,
  ): File {
    const source = this.deserialize(node.f) as ArrayBuffer;
    const result = this.assignIndexedValue(node.i, new File(
      [source],
      deserializeString(node.m),
      { type: deserializeString(node.c), lastModified: node.b },
    ));
    return result;
  }

  private deserializeHeaders(
    node: SerovalHeadersNode,
  ): Headers {
    const result = this.assignIndexedValue(node.i, new Headers());
    const keys = node.e.k;
    const vals = node.e.v;
    for (let i = 0, len = node.e.s; i < len; i++) {
      result.set(
        deserializeString(keys[i]),
        this.deserialize(vals[i]) as string,
      );
    }
    return result;
  }

  private deserializeFormData(
    node: SerovalFormDataNode,
  ): FormData {
    const result = this.assignIndexedValue(node.i, new FormData());
    const keys = node.e.k;
    const vals = node.e.v;
    for (let i = 0, len = node.e.s; i < len; i++) {
      result.set(
        deserializeString(keys[i]),
        this.deserialize(vals[i]) as FormDataEntryValue,
      );
    }
    return result;
  }

  private deserializeBoxed(
    node: SerovalBoxedNode,
  ): unknown {
    return this.assignIndexedValue(
      node.i,
      Object(this.deserialize(node.f)),
    );
  }

  private deserializeRequest(
    node: SerovalRequestNode,
  ): Request {
    return this.assignIndexedValue(
      node.i,
      new Request(deserializeString(node.s), this.deserialize(node.f) as RequestInit),
    );
  }

  private deserializeResponse(
    node: SerovalResponseNode,
  ): Response {
    return this.assignIndexedValue(
      node.i,
      new Response(
        this.deserialize(node.a[0]) as BodyInit,
        this.deserialize(node.a[1]) as RequestInit,
      ),
    );
  }

  private deserializeEvent(
    node: SerovalEventNode,
  ): Event {
    return this.assignIndexedValue(
      node.i,
      new Event(
        deserializeString(node.s),
        this.deserialize(node.f) as EventInit,
      ),
    );
  }

  private deserializeCustomEvent(
    node: SerovalCustomEventNode,
  ): CustomEvent {
    return this.assignIndexedValue(
      node.i,
      new CustomEvent(
        deserializeString(node.s),
        this.deserialize(node.f) as CustomEventInit,
      ),
    );
  }

  private deserializeDOMException(
    node: SerovalDOMExceptionNode,
  ): DOMException {
    return this.assignIndexedValue(
      node.i,
      new DOMException(
        deserializeString(node.s),
        deserializeString(node.c),
      ),
    );
  }

  private deserializePlugin(node: SerovalPluginNode): unknown {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.tag === node.c) {
          return plugin.deserialize(node.s, this, {
            id: node.i,
          });
        }
      }
    }
    throw new Error('Missing plugin for tag "' + node.c + '".');
  }

  deserialize(node: SerovalNode): unknown {
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
        return this.values.get(node.i);
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
      case SerovalNodeType.URL:
        return this.deserializeURL(node);
      case SerovalNodeType.URLSearchParams:
        return this.deserializeURLSearchParams(node);
      case SerovalNodeType.Blob:
        return this.deserializeBlob(node);
      case SerovalNodeType.File:
        return this.deserializeFile(node);
      case SerovalNodeType.Headers:
        return this.deserializeHeaders(node);
      case SerovalNodeType.FormData:
        return this.deserializeFormData(node);
      case SerovalNodeType.Boxed:
        return this.deserializeBoxed(node);
      case SerovalNodeType.Request:
        return this.deserializeRequest(node);
      case SerovalNodeType.Response:
        return this.deserializeResponse(node);
      case SerovalNodeType.Event:
        return this.deserializeEvent(node);
      case SerovalNodeType.CustomEvent:
        return this.deserializeCustomEvent(node);
      case SerovalNodeType.DOMException:
        return this.deserializeDOMException(node);
      case SerovalNodeType.Plugin:
        return this.deserializePlugin(node);
      default:
        throw new Error('invariant');
    }
  }
}
