import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import assert from '../assert';
import {
  createArrayBufferNode,
  createBigIntNode,
  createDateNode,
  createNumberNode,
  createPluginNode,
  createRegExpNode,
  createStringNode,
  createWKSymbolNode,
} from '../base-primitives';
import { BIGINT_FLAG, Feature } from '../compat';
import type { WellKnownSymbols } from '../constants';
import {
  SerovalNodeType,
} from '../constants';
import { createCustomEventOptions, createEventOptions } from '../constructors';
import {
  FALSE_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
} from '../literals';
import type { BaseParserContextOptions } from '../parser-context';
import { BaseParserContext } from '../parser-context';
import { hasReferenceID } from '../reference';
import { getErrorConstructor, getObjectFlag } from '../shared';
import { serializeString } from '../string';
import { SerovalObjectRecordSpecialKey } from '../types';
import type {
  SerovalBoxedNode,
  SerovalArrayNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalErrorNode,
  SerovalMapNode,
  SerovalSetNode,
  SerovalPluginNode,
  SerovalAggregateErrorNode,
  SerovalCustomEventNode,
  SerovalEventNode,
  SerovalHeadersNode,
  SerovalPlainRecordNode,
  SerovalFormDataNode,
  SerovalTypedArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalDataViewNode,
  SerovalIndexedValueNode,
  SerovalReferenceNode,
} from '../types';
import { createDOMExceptionNode, createURLNode, createURLSearchParamsNode } from '../web-api';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode;

export interface BaseSyncParserContextOptions extends BaseParserContextOptions {
  refs?: Map<unknown, number>;
}

export default abstract class BaseSyncParserContext extends BaseParserContext {
  protected abstract getReference<T>(
    current: T,
  ): number | SerovalIndexedValueNode | SerovalReferenceNode;

  protected parseItems(
    current: unknown[],
  ): SerovalNode[] {
    const size = current.length;
    const nodes = new Array<SerovalNode>(size);
    const deferred = new Array<unknown>(size);
    let item: unknown;
    for (let i = 0; i < size; i++) {
      if (i in current) {
        item = current[i];
        if (this.isIterable(item)) {
          deferred[i] = item;
        } else {
          nodes[i] = this.parse(item);
        }
      }
    }
    for (let i = 0; i < size; i++) {
      if (i in deferred) {
        nodes[i] = this.parse(deferred[i]);
      }
    }
    return nodes;
  }

  protected parseArray(
    id: number,
    current: unknown[],
  ): SerovalArrayNode {
    return {
      t: SerovalNodeType.Array,
      i: id,
      s: undefined,
      l: current.length,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: this.parseItems(current),
      f: undefined,
      b: undefined,
      o: getObjectFlag(current),
    };
  }

  protected parseProperties(
    properties: Record<string, unknown>,
  ): SerovalObjectRecordNode {
    const keys = Object.keys(properties);
    let size = keys.length;
    const keyNodes = new Array<SerovalObjectRecordKey>(size);
    const valueNodes = new Array<SerovalNode>(size);
    const deferredKeys = new Array<SerovalObjectRecordKey>(size);
    const deferredValues = new Array<unknown>(size);
    let deferredSize = 0;
    let nodesSize = 0;
    let item: unknown;
    let escaped: SerovalObjectRecordKey;
    for (const key of keys) {
      item = properties[key];
      escaped = serializeString(key);
      if (this.isIterable(item)) {
        deferredKeys[deferredSize] = escaped;
        deferredValues[deferredSize] = item;
        deferredSize++;
      } else {
        keyNodes[nodesSize] = escaped;
        valueNodes[nodesSize] = this.parse(item);
        nodesSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodesSize + i] = deferredKeys[i];
      valueNodes[nodesSize + i] = this.parse(deferredValues[i]);
    }
    if (this.features & Feature.Symbol) {
      if (Symbol.iterator in properties) {
        keyNodes[size] = SerovalObjectRecordSpecialKey.SymbolIterator;
        const items = Array.from(properties as Iterable<unknown>);
        valueNodes[size] = this.parse(items);
        size++;
      }
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: size,
    };
  }

  protected parsePlainObject(
    id: number,
    current: Record<string, unknown>,
    empty: boolean,
  ): ObjectLikeNode {
    return {
      t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: this.parseProperties(current),
      e: undefined,
      a: undefined,
      f: undefined,
      b: undefined,
      o: getObjectFlag(current),
    };
  }

  protected parseBoxed(
    id: number,
    current: object,
  ): SerovalBoxedNode {
    return {
      t: SerovalNodeType.Boxed,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parse(current.valueOf()),
      b: undefined,
      o: undefined,
    };
  }

  protected parseTypedArray(
    id: number,
    current: TypedArrayValue,
  ): SerovalTypedArrayNode {
    return {
      t: SerovalNodeType.TypedArray,
      i: id,
      s: undefined,
      l: current.length,
      c: current.constructor.name,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parse(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  protected parseBigIntTypedArray(
    id: number,
    current: BigIntTypedArrayValue,
  ): SerovalBigIntTypedArrayNode {
    return {
      t: SerovalNodeType.BigIntTypedArray,
      i: id,
      s: undefined,
      l: current.length,
      c: current.constructor.name,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parse(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  protected parseDataView(
    id: number,
    current: DataView,
  ): SerovalDataViewNode {
    return {
      t: SerovalNodeType.DataView,
      i: id,
      s: undefined,
      l: current.byteLength,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parse(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  protected parseError(
    id: number,
    current: Error,
  ): SerovalErrorNode {
    const options = this.getErrorOptions(current);
    const optionsNode = options
      ? this.parseProperties(options)
      : undefined;
    return {
      t: SerovalNodeType.Error,
      i: id,
      s: getErrorConstructor(current),
      l: undefined,
      c: undefined,
      m: serializeString(current.message),
      p: optionsNode,
      e: undefined,
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  protected parseMap(
    id: number,
    current: Map<unknown, unknown>,
  ): SerovalMapNode {
    const len = current.size;
    const keyNodes = new Array<SerovalNode>(len);
    const valueNodes = new Array<SerovalNode>(len);
    const deferredKey = new Array<unknown>(len);
    const deferredValue = new Array<unknown>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const [key, value] of current.entries()) {
      // Either key or value might be an iterable
      if (this.isIterable(key) || this.isIterable(value)) {
        deferredKey[deferredSize] = key;
        deferredValue[deferredSize] = value;
        deferredSize++;
      } else {
        keyNodes[nodeSize] = this.parse(key);
        valueNodes[nodeSize] = this.parse(value);
        nodeSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodeSize + i] = this.parse(deferredKey[i]);
      valueNodes[nodeSize + i] = this.parse(deferredValue[i]);
    }
    return {
      t: SerovalNodeType.Map,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: { k: keyNodes, v: valueNodes, s: len },
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  protected parseSet(
    id: number,
    current: Set<unknown>,
  ): SerovalSetNode {
    const len = current.size;
    const nodes = new Array<SerovalNode>(len);
    const deferred = new Array<unknown>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const item of current.keys()) {
      // Iterables are lazy, so the evaluation must be deferred
      if (this.isIterable(item)) {
        deferred[deferredSize++] = item;
      } else {
        nodes[nodeSize++] = this.parse(item);
      }
    }
    // Parse deferred items
    for (let i = 0; i < deferredSize; i++) {
      nodes[nodeSize + i] = this.parse(deferred[i]);
    }
    return {
      t: SerovalNodeType.Set,
      i: id,
      s: undefined,
      l: len,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: nodes,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  protected parsePlainProperties(
    properties: Record<string, unknown>,
  ): SerovalPlainRecordNode {
    const keys = Object.keys(properties);
    const size = keys.length;
    const keyNodes = new Array<string>(size);
    const valueNodes = new Array<SerovalNode>(size);
    const deferredKeys = new Array<string>(size);
    const deferredValues = new Array<unknown>(size);
    let deferredSize = 0;
    let nodesSize = 0;
    let item: unknown;
    let escaped: string;
    for (const key of keys) {
      item = properties[key];
      escaped = serializeString(key);
      if (this.isIterable(item)) {
        deferredKeys[deferredSize] = escaped;
        deferredValues[deferredSize] = item;
        deferredSize++;
      } else {
        keyNodes[nodesSize] = escaped;
        valueNodes[nodesSize] = this.parse(item);
        nodesSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodesSize + i] = deferredKeys[i];
      valueNodes[nodesSize + i] = this.parse(deferredValues[i]);
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: size,
    };
  }

  protected parseHeaders(
    id: number,
    current: Headers,
  ): SerovalHeadersNode {
    const items: Record<string, string> = {};
    current.forEach((value, key) => {
      items[key] = value;
    });
    return {
      t: SerovalNodeType.Headers,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: this.parsePlainProperties(items),
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  protected parseFormData(
    id: number,
    current: FormData,
  ): SerovalFormDataNode {
    const items: Record<string, FormDataEntryValue> = {};
    current.forEach((value, key) => {
      items[key] = value;
    });
    return {
      t: SerovalNodeType.FormData,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: this.parsePlainProperties(items),
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  protected parseEvent(
    id: number,
    current: Event,
  ): SerovalEventNode {
    return {
      t: SerovalNodeType.Event,
      i: id,
      s: serializeString(current.type),
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parse(createEventOptions(current)),
      b: undefined,
      o: undefined,
    };
  }

  protected parseCustomEvent(
    id: number,
    current: CustomEvent,
  ): SerovalCustomEventNode {
    return {
      t: SerovalNodeType.CustomEvent,
      i: id,
      s: serializeString(current.type),
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parse(createCustomEventOptions(current)),
      b: undefined,
      o: undefined,
    };
  }

  protected parseAggregateError(
    id: number,
    current: AggregateError,
  ): SerovalAggregateErrorNode {
    const options = this.getErrorOptions(current);
    const optionsNode = options
      ? this.parseProperties(options)
      : undefined;
    return {
      t: SerovalNodeType.AggregateError,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: serializeString(current.message),
      p: optionsNode,
      e: undefined,
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  protected parsePlugin(
    id: number,
    current: unknown,
  ): SerovalPluginNode | undefined {
    if (this.plugins) {
      for (let i = 0, len = this.plugins.length; i < len; i++) {
        const plugin = this.plugins[i];
        if (plugin.parse.sync && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            plugin.parse.sync(current, this, {
              id,
              isCross: false,
            }),
          );
        }
      }
    }
    return undefined;
  }

  protected parseObject(
    id: number,
    current: object,
  ): SerovalNode {
    if (Array.isArray(current)) {
      return this.parseArray(id, current);
    }
    const currentClass = current.constructor;
    switch (currentClass) {
      case Object:
        return this.parsePlainObject(
          id,
          current as Record<string, unknown>,
          false,
        );
      case undefined:
        return this.parsePlainObject(
          id,
          current as Record<string, unknown>,
          true,
        );
      case Date:
        return createDateNode(id, current as unknown as Date);
      case RegExp:
        return createRegExpNode(id, current as unknown as RegExp);
      case Error:
      case EvalError:
      case RangeError:
      case ReferenceError:
      case SyntaxError:
      case TypeError:
      case URIError:
        return this.parseError(id, current as unknown as Error);
      case Number:
      case Boolean:
      case String:
      case BigInt:
        return this.parseBoxed(id, current);
      default:
        break;
    }
    // Typed Arrays
    if (this.features & Feature.TypedArray) {
      switch (currentClass) {
        case ArrayBuffer:
          return createArrayBufferNode(id, current as unknown as ArrayBuffer);
        case Int8Array:
        case Int16Array:
        case Int32Array:
        case Uint8Array:
        case Uint16Array:
        case Uint32Array:
        case Uint8ClampedArray:
        case Float32Array:
        case Float64Array:
          return this.parseTypedArray(id, current as unknown as TypedArrayValue);
        case DataView:
          return this.parseDataView(id, current as unknown as DataView);
        default:
          break;
      }
    }
    // BigInt Typed Arrays
    if ((this.features & BIGINT_FLAG) === BIGINT_FLAG) {
      switch (currentClass) {
        case BigInt64Array:
        case BigUint64Array:
          return this.parseBigIntTypedArray(id, current as unknown as BigIntTypedArrayValue);
        default:
          break;
      }
    }
    // ES Collection
    if (this.features & Feature.Map && currentClass === Map) {
      return this.parseMap(
        id,
        current as unknown as Map<unknown, unknown>,
      );
    }
    if (this.features & Feature.Set && currentClass === Set) {
      return this.parseSet(
        id,
        current as unknown as Set<unknown>,
      );
    }
    // Web APIs
    if (this.features & Feature.WebAPI) {
      switch (currentClass) {
        case URL:
          return createURLNode(id, current as unknown as URL);
        case URLSearchParams:
          return createURLSearchParamsNode(id, current as unknown as URLSearchParams);
        case Headers:
          return this.parseHeaders(id, current as unknown as Headers);
        case FormData:
          return this.parseFormData(id, current as unknown as FormData);
        case Event:
          return this.parseEvent(id, current as unknown as Event);
        case CustomEvent:
          return this.parseCustomEvent(id, current as unknown as CustomEvent);
        case DOMException:
          return createDOMExceptionNode(id, current as unknown as DOMException);
        default:
          break;
      }
    }
    const parsed = this.parsePlugin(id, current);
    if (parsed) {
      return parsed;
    }
    if (
      (this.features & Feature.AggregateError)
      && (currentClass === AggregateError || current instanceof AggregateError)
    ) {
      return this.parseAggregateError(id, current as unknown as AggregateError);
    }
    // Slow path. We only need to handle Errors and Iterators
    // since they have very broad implementations.
    if (current instanceof Error) {
      return this.parseError(id, current);
    }
    // Generator functions don't have a global constructor
    // despite existing
    if (this.features & Feature.Symbol && Symbol.iterator in current) {
      return this.parsePlainObject(id, current, !!currentClass);
    }
    throw new UnsupportedTypeError(current);
  }

  protected parseInternal(
    // eslint-disable-next-line @typescript-eslint/ban-types
    current: object | Function | symbol,
    mode: 'object' | 'function' | 'symbol',
  ): SerovalNode {
    if (mode === 'function') {
      assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
    }
    // Non-primitive values needs a reference ID
    // mostly because the values themselves are stateful
    const id = this.getReference(current);
    if (typeof id !== 'number') {
      return id;
    }
    switch (mode) {
      case 'symbol':
        return createWKSymbolNode(id, current as WellKnownSymbols);
      case 'object':
        return this.parseObject(id, current as object);
      default:
        throw new UnsupportedTypeError(current);
    }
  }

  parse<T>(current: T): SerovalNode {
    const t = typeof current;
    if (this.features & Feature.BigInt && t === 'bigint') {
      return createBigIntNode(current as bigint);
    }
    switch (t) {
      case 'boolean':
        return current ? TRUE_NODE : FALSE_NODE;
      case 'undefined':
        return UNDEFINED_NODE;
      case 'string':
        return createStringNode(current as string);
      case 'number':
        return createNumberNode(current as number);
      case 'object':
      case 'symbol':
      case 'function':
        if (!current) {
          return NULL_NODE;
        }
        return this.parseInternal(current as unknown as object, t);
      default:
        throw new UnsupportedTypeError(current);
    }
  }
}
