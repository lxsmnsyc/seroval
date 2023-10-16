/* eslint-disable prefer-destructuring */
/* eslint-disable no-await-in-loop */
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import assert from '../assert';
import {
  createPluginNode,
  createDateNode,
  createRegExpNode,
  createArrayBufferNode,
  createWKSymbolNode,
  createBigIntNode,
  createStringNode,
  createNumberNode,
} from '../base-primitives';
import { BIGINT_FLAG, Feature } from '../compat';
import type { WellKnownSymbols } from '../constants';
import { SerovalNodeType } from '../constants';
import {
  createRequestOptions,
  createResponseOptions,
  createEventOptions,
  createCustomEventOptions,
} from '../constructors';
import {
  NULL_NODE,
  TRUE_NODE,
  FALSE_NODE,
  UNDEFINED_NODE,
} from '../literals';
import { getConstructor } from '../object';
import { BaseParserContext } from '../parser-context';
import promiseToResult from '../promise-to-result';
import { hasReferenceID } from '../reference';
import { getErrorConstructor, getObjectFlag } from '../shared';
import { serializeString } from '../string';
import { SerovalObjectRecordSpecialKey } from '../types';
import type {
  SerovalErrorNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPromiseNode,
  SerovalTypedArrayNode,
  SerovalAggregateErrorNode,
  SerovalBlobNode,
  SerovalCustomEventNode,
  SerovalEventNode,
  SerovalFileNode,
  SerovalFormDataNode,
  SerovalHeadersNode,
  SerovalMapNode,
  SerovalPlainRecordNode,
  SerovalPluginNode,
  SerovalRequestNode,
  SerovalResponseNode,
  SerovalSetNode,
  SerovalDataViewNode,
  SerovalIndexedValueNode,
  SerovalReferenceNode,
} from '../types';
import { createURLNode, createURLSearchParamsNode, createDOMExceptionNode } from '../web-api';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode;

export default abstract class BaseAsyncParserContext extends BaseParserContext {
  protected abstract getReference<T>(
    current: T,
  ): number | SerovalIndexedValueNode | SerovalReferenceNode;

  protected abstract getStrictReference<T>(
    current: T,
  ): SerovalIndexedValueNode | SerovalReferenceNode;

  private async parseItems(
    current: unknown[],
  ): Promise<SerovalNode[]> {
    const size = current.length;
    const nodes = [];
    const deferred = [];
    for (let i = 0, item: unknown; i < size; i++) {
      if (i in current) {
        item = current[i];
        if (this.isIterable(item)) {
          deferred[i] = item;
        } else {
          nodes[i] = await this.parse(item);
        }
      }
    }
    for (let i = 0; i < size; i++) {
      if (i in deferred) {
        nodes[i] = await this.parse(deferred[i]);
      }
    }
    return nodes;
  }

  private async parseArray(
    id: number,
    current: unknown[],
  ): Promise<SerovalArrayNode> {
    return {
      t: SerovalNodeType.Array,
      i: id,
      s: undefined,
      l: current.length,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: await this.parseItems(current),
      f: undefined,
      b: undefined,
      o: getObjectFlag(current),
    };
  }

  private async parseBoxed(
    id: number,
    current: object,
  ): Promise<SerovalBoxedNode> {
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
      f: await this.parse(current.valueOf()),
      b: undefined,
      o: undefined,
    };
  }

  private async parseTypedArray(
    id: number,
    current: TypedArrayValue,
  ): Promise<SerovalTypedArrayNode> {
    return {
      t: SerovalNodeType.TypedArray,
      i: id,
      s: undefined,
      l: current.length,
      c: getConstructor(current).name,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: await this.parse(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  private async parseBigIntTypedArray(
    id: number,
    current: BigIntTypedArrayValue,
  ): Promise<SerovalBigIntTypedArrayNode> {
    return {
      t: SerovalNodeType.BigIntTypedArray,
      i: id,
      s: undefined,
      l: current.length,
      c: getConstructor(current).name,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: await this.parse(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  private async parseDataView(
    id: number,
    current: DataView,
  ): Promise<SerovalDataViewNode> {
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
      f: await this.parse(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  private async parseProperties(
    properties: Record<string, unknown>,
  ): Promise<SerovalObjectRecordNode> {
    const entries = Object.entries(properties);
    const keyNodes: (string | number)[] = [];
    const valueNodes: SerovalNode[] = [];
    const deferredKeys: string[] = [];
    const deferredValues: unknown[] = [];
    for (
      let i = 0, len = entries.length, key: string, item: unknown, escaped: SerovalObjectRecordKey;
      i < len;
      i++
    ) {
      key = entries[i][0];
      item = entries[i][1];
      escaped = serializeString(key);
      if (this.isIterable(item)) {
        deferredKeys.push(escaped);
        deferredValues.push(item);
      } else {
        keyNodes.push(escaped);
        valueNodes.push(await this.parse(item));
      }
    }
    for (let i = 0, len = deferredKeys.length; i < len; i++) {
      keyNodes.push(deferredKeys[i]);
      valueNodes.push(await this.parse(deferredValues[i]));
    }
    if (this.features & Feature.Symbol) {
      if (Symbol.iterator in properties) {
        keyNodes.push(SerovalObjectRecordSpecialKey.SymbolIterator);
        valueNodes.push(await this.parse(Array.from(properties as Iterable<unknown>)));
      }
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: keyNodes.length,
    };
  }

  private async parsePlainObject(
    id: number,
    current: Record<string, unknown>,
    empty: boolean,
  ): Promise<ObjectLikeNode> {
    return {
      t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: await this.parseProperties(current),
      e: undefined,
      a: undefined,
      f: undefined,
      b: undefined,
      o: getObjectFlag(current),
    };
  }

  private async parseError(
    id: number,
    current: Error,
  ): Promise<SerovalErrorNode> {
    const options = this.getErrorOptions(current);
    const optionsNode = options
      ? await this.parseProperties(options)
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

  private async parseMap(
    id: number,
    current: Map<unknown, unknown>,
  ): Promise<SerovalMapNode> {
    const keyNodes: SerovalNode[] = [];
    const valueNodes: SerovalNode[] = [];
    const deferredKey: unknown[] = [];
    const deferredValue: unknown[] = [];
    for (const [key, value] of current.entries()) {
      // Either key or value might be an iterable
      if (this.isIterable(key) || this.isIterable(value)) {
        deferredKey.push(key);
        deferredValue.push(value);
      } else {
        keyNodes.push(await this.parse(key));
        valueNodes.push(await this.parse(value));
      }
    }
    for (let i = 0, len = deferredKey.length; i < len; i++) {
      keyNodes.push(await this.parse(deferredKey[i]));
      valueNodes.push(await this.parse(deferredValue[i]));
    }
    return {
      t: SerovalNodeType.Map,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: { k: keyNodes, v: valueNodes, s: current.size },
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private async parseSet(
    id: number,
    current: Set<unknown>,
  ): Promise<SerovalSetNode> {
    const nodes: SerovalNode[] = [];
    const deferred: unknown[] = [];
    for (const item of current.keys()) {
      // Iterables are lazy, so the evaluation must be deferred
      if (this.isIterable(item)) {
        deferred.push(item);
      } else {
        nodes.push(await this.parse(item));
      }
    }
    // Parse deferred items
    for (let i = 0, len = deferred.length; i < len; i++) {
      nodes.push(await this.parse(deferred[i]));
    }
    return {
      t: SerovalNodeType.Set,
      i: id,
      s: undefined,
      l: current.size,
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

  private async parseBlob(
    id: number,
    current: Blob,
  ): Promise<SerovalBlobNode> {
    return {
      t: SerovalNodeType.Blob,
      i: id,
      s: undefined,
      l: undefined,
      c: serializeString(current.type),
      m: undefined,
      p: undefined,
      e: undefined,
      f: await this.parse(await current.arrayBuffer()),
      a: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private async parseFile(
    id: number,
    current: File,
  ): Promise<SerovalFileNode> {
    return {
      t: SerovalNodeType.File,
      i: id,
      s: undefined,
      l: undefined,
      c: serializeString(current.type),
      m: serializeString(current.name),
      p: undefined,
      e: undefined,
      f: await this.parse(await current.arrayBuffer()),
      a: undefined,
      b: current.lastModified,
      o: undefined,
    };
  }

  private async parsePlainProperties(
    properties: Record<string, unknown>,
  ): Promise<SerovalPlainRecordNode> {
    const entries = Object.entries(properties);
    const size = entries.length;
    const keyNodes: string[] = [];
    const valueNodes: SerovalNode[] = [];
    const deferredKeys: string[] = [];
    const deferredValues: unknown[] = [];
    for (let i = 0, key: string, escaped: string, item: unknown; i < size; i++) {
      key = entries[i][0];
      item = entries[i][1];
      escaped = serializeString(key);
      if (this.isIterable(item)) {
        deferredKeys.push(escaped);
        deferredValues.push(item);
      } else {
        keyNodes.push(escaped);
        valueNodes.push(await this.parse(item));
      }
    }
    for (let i = 0, len = deferredKeys.length; i < len; i++) {
      keyNodes.push(deferredKeys[i]);
      valueNodes.push(await this.parse(deferredValues[i]));
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: size,
    };
  }

  private async parseHeaders(
    id: number,
    current: Headers,
  ): Promise<SerovalHeadersNode> {
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
      e: await this.parsePlainProperties(items),
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private async parseFormData(
    id: number,
    current: FormData,
  ): Promise<SerovalFormDataNode> {
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
      e: await this.parsePlainProperties(items),
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private async parseRequest(
    id: number,
    current: Request,
  ): Promise<SerovalRequestNode> {
    return {
      t: SerovalNodeType.Request,
      i: id,
      s: serializeString(current.url),
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      f: await this.parse(
        createRequestOptions(current, current.body ? await current.clone().arrayBuffer() : null),
      ),
      a: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private async parseResponse(
    id: number,
    current: Response,
  ): Promise<SerovalResponseNode> {
    return {
      t: SerovalNodeType.Response,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      f: undefined,
      a: [
        current.body
          ? await this.parse(await current.clone().arrayBuffer())
          : NULL_NODE,
        await this.parse(createResponseOptions(current)),
      ],
      b: undefined,
      o: undefined,
    };
  }

  private async parseEvent(
    id: number,
    current: Event,
  ): Promise<SerovalEventNode> {
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
      f: await this.parse(createEventOptions(current)),
      b: undefined,
      o: undefined,
    };
  }

  private async parseCustomEvent(
    id: number,
    current: CustomEvent,
  ): Promise<SerovalCustomEventNode> {
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
      f: await this.parse(createCustomEventOptions(current)),
      b: undefined,
      o: undefined,
    };
  }

  private async parseAggregateError(
    id: number,
    current: AggregateError,
  ): Promise<SerovalAggregateErrorNode> {
    const options = this.getErrorOptions(current);
    const optionsNode = options
      ? await this.parseProperties(options)
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

  private async parsePromise(
    id: number,
    current: Promise<unknown>,
  ): Promise<SerovalPromiseNode> {
    const [status, result] = await promiseToResult(current);
    return {
      t: SerovalNodeType.Promise,
      i: id,
      s: status,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: await this.parse(result),
      b: undefined,
      o: undefined,
    };
  }

  private async parsePlugin(
    id: number,
    current: unknown,
  ): Promise<SerovalPluginNode | undefined> {
    if (this.plugins) {
      for (let i = 0, len = this.plugins.length; i < len; i++) {
        const plugin = this.plugins[i];
        if (plugin.parse.async && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            await plugin.parse.async(current, this, {
              id,
            }),
          );
        }
      }
    }
    return undefined;
  }

  private async parseObject(
    id: number,
    current: object,
  ): Promise<SerovalNode> {
    if (Array.isArray(current)) {
      return this.parseArray(id, current);
    }
    const currentClass = getConstructor(current);
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
        case Blob:
          return this.parseBlob(id, current as unknown as Blob);
        case File:
          return this.parseFile(id, current as unknown as File);
        case Headers:
          return this.parseHeaders(id, current as unknown as Headers);
        case FormData:
          return this.parseFormData(id, current as unknown as FormData);
        case Request:
          return this.parseRequest(id, current as unknown as Request);
        case Response:
          return this.parseResponse(id, current as unknown as Response);
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
    const parsed = await this.parsePlugin(id, current);
    if (parsed) {
      return parsed;
    }
    if (
      (this.features & Feature.AggregateError)
      && (currentClass === AggregateError || current instanceof AggregateError)
    ) {
      return this.parseAggregateError(id, current as unknown as AggregateError);
    }
    // Promises
    if (
      (this.features & Feature.Promise)
      && (currentClass === Promise || current instanceof Promise)
    ) {
      return this.parsePromise(id, current as unknown as Promise<unknown>);
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

  async parse<T>(current: T): Promise<SerovalNode> {
    switch (current) {
      case true: return TRUE_NODE;
      case false: return FALSE_NODE;
      case undefined: return UNDEFINED_NODE;
      case null: return NULL_NODE;
      default: break;
    }
    switch (typeof current) {
      case 'string': return createStringNode(current as string);
      case 'number': return createNumberNode(current as number);
      case 'bigint':
        assert(this.features & Feature.BigInt, new UnsupportedTypeError(current));
        return createBigIntNode(current as bigint);
      case 'object': {
        const id = this.getReference(current);
        return typeof id === 'number' ? this.parseObject(id, current as object) : id;
      }
      case 'symbol': {
        const id = this.getReference(current);
        return typeof id === 'number' ? createWKSymbolNode(id, current as WellKnownSymbols) : id;
      }
      case 'function':
        assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
        return this.getStrictReference(current);
      default:
        throw new UnsupportedTypeError(current);
    }
  }
}
