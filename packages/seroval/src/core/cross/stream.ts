/* eslint-disable no-await-in-loop */
import { BIGINT_FLAG, Feature } from '../compat';
import { serializeString } from '../string';
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import {
  TRUE_NODE,
  FALSE_NODE,
  UNDEFINED_NODE,
  NULL_NODE,
} from '../literals';
import { hasReferenceID } from '../reference';
import {
  getErrorConstructor,
  getObjectFlag,
} from '../shared';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalBoxedNode,
  SerovalCustomEventNode,
  SerovalErrorNode,
  SerovalEventNode,
  SerovalFormDataNode,
  SerovalHeadersNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPlainRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalReadableStreamConstructorNode,
  SerovalRequestNode,
  SerovalResponseNode,
  SerovalSetNode,
} from '../types';
import {
  SerovalObjectRecordSpecialKey,
} from '../types';
import { SerovalNodeType } from '../constants';
import {
  createArrayBufferNode,
  createBigIntNode,
  createDateNode,
  createIndexedValueNode,
  createNumberNode,
  createPluginNode,
  createReferenceNode,
  createRegExpNode,
  createStringNode,
} from '../base-primitives';
import { createDOMExceptionNode, createURLNode, createURLSearchParamsNode } from '../web-api';
import {
  createCustomEventOptions,
  createEventOptions,
  createRequestOptions,
  createResponseOptions,
} from '../constructors';
import type { CrossParserContextOptions } from './cross-parser';
import CrossParserContext from './cross-parser';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode;

export interface StreamCrossParserContextOptions extends CrossParserContextOptions {
  onParse: (node: SerovalNode, initial: boolean) => void;
  onDone?: () => void;
}

export default class StreamCrossParserContext extends CrossParserContext {
  // Life
  private alive = true;

  // Amount of pending promises/streams
  private pending = 0;

  private onParseCallback: (node: SerovalNode, initial: boolean) => void;

  private onDoneCallback?: () => void;

  constructor(options: StreamCrossParserContextOptions) {
    super(options);
    this.onParseCallback = options.onParse;
    this.onDoneCallback = options.onDone;
  }

  private onParse(node: SerovalNode, initial: boolean): void {
    this.onParseCallback(node, initial);
  }

  private onDone(): void {
    if (this.onDoneCallback) {
      this.onDoneCallback();
    }
  }

  push<T>(value: T): void {
    this.onParse(
      this.parse(value),
      false,
    );
  }

  pushPendingState(): void {
    this.pending++;
  }

  popPendingState(): void {
    if (--this.pending <= 0) {
      this.onDone();
    }
  }

  private parseItems(
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

  private parseArray(
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

  private parseBoxed(
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

  private parseProperties(
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
        valueNodes[size] = this.parseArray(
          this.createIndexedValue(items),
          items,
        );
        size++;
      }
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: size,
    };
  }

  private parsePlainObject(
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

  private parseError(
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

  private parseMap(
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

  private parseSet(
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

  private parsePlainProperties(
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

  private parseHeaders(
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

  private parseFormData(
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

  private pushReadableStreamReader(
    id: number,
    reader: ReadableStreamDefaultReader,
  ): void {
    reader.read().then(
      (data) => {
        if (this.alive) {
          if (data.done) {
            this.onParse({
              t: SerovalNodeType.ReadableStreamClose,
              i: id,
              s: undefined,
              l: undefined,
              c: undefined,
              m: undefined,
              p: undefined,
              e: undefined,
              a: undefined,
              f: undefined,
              b: undefined,
              o: undefined,
            }, false);
            this.popPendingState();
          } else {
            this.onParse({
              t: SerovalNodeType.ReadableStreamEnqueue,
              i: id,
              s: undefined,
              l: undefined,
              c: undefined,
              m: undefined,
              p: undefined,
              e: undefined,
              a: undefined,
              f: this.parse(data.value),
              b: undefined,
              o: undefined,
            }, false);
            this.pushReadableStreamReader(id, reader);
          }
        }
      },
      (value) => {
        if (this.alive) {
          this.onParse({
            t: SerovalNodeType.ReadableStreamError,
            i: id,
            s: undefined,
            l: undefined,
            c: undefined,
            m: undefined,
            p: undefined,
            e: undefined,
            a: undefined,
            f: this.parse(value),
            b: undefined,
            o: undefined,
          }, false);
          this.popPendingState();
        }
      },
    );
  }

  private parseReadableStream(
    id: number,
    current: ReadableStream<unknown>,
  ): SerovalReadableStreamConstructorNode {
    const reader = current.getReader();
    this.pushPendingState();
    this.pushReadableStreamReader(id, reader);

    return {
      t: SerovalNodeType.ReadableStreamConstructor,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private parseRequest(
    id: number,
    current: Request,
  ): SerovalRequestNode {
    return {
      t: SerovalNodeType.Request,
      i: id,
      s: serializeString(current.url),
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      f: this.parseObject(
        createRequestOptions(current, current.clone().body),
      ),
      a: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private parseResponse(
    id: number,
    current: Response,
  ): SerovalResponseNode {
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
          ? this.parseObject(current.clone().body)
          : NULL_NODE,
        this.parseObject(createResponseOptions(current)),
      ],
      b: undefined,
      o: undefined,
    };
  }

  private parseEvent(
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
      f: this.parseObject(createEventOptions(current)),
      b: undefined,
      o: undefined,
    };
  }

  private parseCustomEvent(
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
      f: this.parseObject(createCustomEventOptions(current)),
      b: undefined,
      o: undefined,
    };
  }

  private parseAggregateError(
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

  private parsePromise(
    id: number,
    current: Promise<unknown>,
  ): SerovalPromiseConstructorNode {
    current.then(
      (data) => {
        if (this.alive) {
          this.onParse({
            t: SerovalNodeType.PromiseResolve,
            i: id,
            s: undefined,
            l: undefined,
            c: undefined,
            m: undefined,
            p: undefined,
            e: undefined,
            a: undefined,
            f: this.parse(data),
            b: undefined,
            o: undefined,
          }, false);
          this.popPendingState();
        }
      },
      (data) => {
        if (this.alive) {
          this.onParse({
            t: SerovalNodeType.PromiseReject,
            i: id,
            s: undefined,
            l: undefined,
            c: undefined,
            m: undefined,
            p: undefined,
            e: undefined,
            a: undefined,
            f: this.parse(data),
            b: undefined,
            o: undefined,
          }, false);
          this.popPendingState();
        }
      },
    );
    this.pushPendingState();
    return {
      t: SerovalNodeType.PromiseConstructor,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  private parsePlugin(
    id: number,
    current: unknown,
  ): SerovalPluginNode | undefined {
    if (this.plugins) {
      for (let i = 0, len = this.plugins.length; i < len; i++) {
        const plugin = this.plugins[i];
        if (plugin.parse.stream && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            plugin.parse.stream(current, this, id, true),
          );
        }
      }
    }
    return undefined;
  }

  private parseObject(
    current: object | null,
  ): SerovalNode {
    if (!current) {
      return NULL_NODE;
    }
    // Non-primitive values needs a reference ID
    // mostly because the values themselves are stateful
    const registeredID = this.refs.get(current);
    if (registeredID != null) {
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    if (hasReferenceID(current)) {
      return createReferenceNode(id, current);
    }
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
        case ReadableStream:
          return this.parseReadableStream(id, current as unknown as ReadableStream);
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
        return this.parseObject(current as object);
      case 'symbol':
        return this.parseSymbol(current as symbol);
      case 'function':
        return this.parseFunction(current);
      default:
        throw new UnsupportedTypeError(current);
    }
  }

  /**
   * @private
   */
  start<T>(current: T): void {
    this.onParse(
      this.parse(current),
      true,
    );

    // Check if there's any pending pushes
    if (this.pending <= 0) {
      this.destroy();
    }
  }

  /**
   * @private
   */
  destroy(): void {
    if (this.alive) {
      this.onDone();
      this.alive = false;
    }
  }

  isAlive(): boolean {
    return this.alive;
  }
}
