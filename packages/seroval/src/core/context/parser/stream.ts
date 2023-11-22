import type { BigIntTypedArrayValue, TypedArrayValue } from '../../../types';
import UnsupportedTypeError from '../../UnsupportedTypeError';
import {
  createArrayBufferNode,
  createAsyncIteratorFactoryInstanceNode,
  createDateNode,
  createIteratorFactoryInstanceNode,
  createPluginNode,
  createRegExpNode,
  createStringNode,
} from '../../base-primitives';
import type { BaseSyncParserContextOptions } from './sync';
import BaseSyncParserContext from './sync';
import { BIGINT_FLAG, Feature } from '../../compat';
import { SerovalNodeType } from '../../constants';
import { createRequestOptions, createResponseOptions } from '../../utils/constructors';
import { FALSE_NODE, NULL_NODE, TRUE_NODE } from '../../literals';
import { serializeString } from '../../string';
import type {
  SerovalNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalReadableStreamConstructorNode,
  SerovalRequestNode,
  SerovalResponseNode,
} from '../../types';
import { createDOMExceptionNode, createURLNode, createURLSearchParamsNode } from '../../web-api';
import { asyncIteratorToReadableStream, iteratorToSequence } from '../../utils/iterator-to-sequence';
import { SpecialReference, UNIVERSAL_SENTINEL } from '../../special-reference';

export interface BaseStreamParserContextOptions extends BaseSyncParserContextOptions {
  onParse: (node: SerovalNode, initial: boolean) => void;
  onError?: (error: unknown) => void;
  onDone?: () => void;
}

export default abstract class BaseStreamParserContext extends BaseSyncParserContext {
  // Life
  private alive = true;

  // Amount of pending promises/streams
  private pending = 0;

  private onParseCallback: (node: SerovalNode, initial: boolean) => void;

  private onErrorCallback?: (error: unknown) => void;

  private onDoneCallback?: () => void;

  constructor(options: BaseStreamParserContextOptions) {
    super(options);
    this.onParseCallback = options.onParse;
    this.onErrorCallback = options.onError;
    this.onDoneCallback = options.onDone;
  }

  private onParse(node: SerovalNode, initial: boolean): void {
    try {
      this.onParseCallback(node, initial);
    } catch (error) {
      this.onError(error);
    }
  }

  private onError(error: unknown): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
    } else {
      throw error;
    }
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

  protected parseProperties(
    properties: Record<string | symbol, unknown>,
  ): SerovalObjectRecordNode {
    const entries = Object.entries(properties);
    const keyNodes: SerovalObjectRecordKey[] = [];
    const valueNodes: SerovalNode[] = [];
    for (
      let i = 0, len = entries.length;
      i < len;
      i++
    ) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(this.parse(entries[i][1]));
    }
    // Check special properties, symbols in this case
    if (this.features & Feature.Symbol) {
      let symbol = Symbol.iterator;
      if (symbol in properties) {
        keyNodes.push(
          this.parseWKSymbol(symbol),
        );
        valueNodes.push(
          createIteratorFactoryInstanceNode(
            this.parseIteratorFactory(),
            this.parse(
              iteratorToSequence(properties as unknown as Iterable<unknown>),
            ),
          ),
        );
      }
      symbol = Symbol.asyncIterator;
      if (symbol in properties) {
        keyNodes.push(
          this.parseWKSymbol(symbol),
        );
        valueNodes.push(
          createAsyncIteratorFactoryInstanceNode(
            this.parseAsyncIteratorFactory(1),
            this.parse(
              asyncIteratorToReadableStream(
                properties as unknown as AsyncIterable<unknown>,
                this,
              ),
            ),
          ),
        );
      }
      symbol = Symbol.toStringTag;
      if (symbol in properties) {
        keyNodes.push(this.parseWKSymbol(symbol));
        valueNodes.push(createStringNode(properties[symbol] as string));
      }
      symbol = Symbol.isConcatSpreadable;
      if (symbol in properties) {
        keyNodes.push(this.parseWKSymbol(symbol));
        valueNodes.push(properties[symbol] ? TRUE_NODE : FALSE_NODE);
      }
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: keyNodes.length,
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
              f: this.parseSpecialReference(SpecialReference.ReadableStreamClose),
              b: undefined,
              o: undefined,
            }, false);
            this.popPendingState();
          } else {
            const parsed = this.parseWithError(data.value);
            if (parsed) {
              this.onParse({
                t: SerovalNodeType.ReadableStreamEnqueue,
                i: id,
                s: undefined,
                l: undefined,
                c: undefined,
                m: undefined,
                p: undefined,
                e: undefined,
                a: [
                  this.parseSpecialReference(SpecialReference.ReadableStreamEnqueue),
                  parsed,
                ],
                f: undefined,
                b: undefined,
                o: undefined,
              }, false);
              this.pushReadableStreamReader(id, reader);
            }
          }
        }
      },
      (value) => {
        if (this.alive) {
          const parsed = this.parseWithError(value);
          if (parsed) {
            this.onParse({
              t: SerovalNodeType.ReadableStreamError,
              i: id,
              s: undefined,
              l: undefined,
              c: undefined,
              m: undefined,
              p: undefined,
              e: undefined,
              a: [
                this.parseSpecialReference(SpecialReference.ReadableStreamError),
                parsed,
              ],
              f: undefined,
              b: undefined,
              o: undefined,
            }, false);
          }
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
      f: this.parseSpecialReference(SpecialReference.ReadableStreamConstructor),
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
      f: this.parse(
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
          ? this.parse(current.clone().body)
          : NULL_NODE,
        this.parse(createResponseOptions(current)),
      ],
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
        const parsed = this.parseWithError(data);
        if (parsed) {
          this.onParse({
            t: SerovalNodeType.PromiseResolve,
            i: id,
            s: undefined,
            l: undefined,
            c: undefined,
            m: undefined,
            p: undefined,
            e: undefined,
            a: [
              this.parseSpecialReference(SpecialReference.PromiseResolve),
              parsed,
            ],
            f: undefined,
            b: undefined,
            o: undefined,
          }, false);
        }
        this.popPendingState();
      },
      (data) => {
        if (this.alive) {
          const parsed = this.parseWithError(data);
          if (parsed) {
            this.onParse({
              t: SerovalNodeType.PromiseReject,
              i: id,
              s: undefined,
              l: undefined,
              c: undefined,
              m: undefined,
              p: undefined,
              e: undefined,
              a: [
                this.parseSpecialReference(SpecialReference.PromiseReject),
                parsed,
              ],
              f: undefined,
              b: undefined,
              o: undefined,
            }, false);
          }
        }
        this.popPendingState();
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
      f: this.parseSpecialReference(SpecialReference.PromiseConstructor),
      b: undefined,
      o: undefined,
    };
  }

  protected parsePlugin(
    id: number,
    current: unknown,
  ): SerovalPluginNode | undefined {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.parse.stream && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            plugin.parse.stream(current, this, {
              id,
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
    const currentFeatures = this.features;
    // Promises
    if (
      (currentFeatures & Feature.Promise)
      && (currentClass === Promise || current instanceof Promise)
    ) {
      return this.parsePromise(id, current as unknown as Promise<unknown>);
    }
    // Typed Arrays
    if (currentFeatures & Feature.TypedArray) {
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
    if ((currentFeatures & BIGINT_FLAG) === BIGINT_FLAG) {
      switch (currentClass) {
        case BigInt64Array:
        case BigUint64Array:
          return this.parseBigIntTypedArray(id, current as unknown as BigIntTypedArrayValue);
        default:
          break;
      }
    }
    // ES Collection
    if (currentFeatures & Feature.Map && currentClass === Map) {
      return this.parseMap(
        id,
        current as unknown as Map<unknown, unknown>,
      );
    }
    if (currentFeatures & Feature.Set && currentClass === Set) {
      return this.parseSet(
        id,
        current as unknown as Set<unknown>,
      );
    }
    // Web APIs
    if (currentFeatures & Feature.WebAPI) {
      switch (currentClass) {
        case (typeof URL !== 'undefined' ? URL : UNIVERSAL_SENTINEL):
          return createURLNode(id, current as unknown as URL);
        case (typeof URLSearchParams !== 'undefined' ? URLSearchParams : UNIVERSAL_SENTINEL):
          return createURLSearchParamsNode(id, current as unknown as URLSearchParams);
        case (typeof Headers !== 'undefined' ? Headers : UNIVERSAL_SENTINEL):
          return this.parseHeaders(id, current as unknown as Headers);
        case (typeof FormData !== 'undefined' ? FormData : UNIVERSAL_SENTINEL):
          return this.parseFormData(id, current as unknown as FormData);
        case (typeof ReadableStream !== 'undefined' ? ReadableStream : UNIVERSAL_SENTINEL):
          return this.parseReadableStream(id, current as unknown as ReadableStream);
        case (typeof Request !== 'undefined' ? Request : UNIVERSAL_SENTINEL):
          return this.parseRequest(id, current as unknown as Request);
        case (typeof Response !== 'undefined' ? Response : UNIVERSAL_SENTINEL):
          return this.parseResponse(id, current as unknown as Response);
        case (typeof Event !== 'undefined' ? Event : UNIVERSAL_SENTINEL):
          return this.parseEvent(id, current as unknown as Event);
        case (typeof CustomEvent !== 'undefined' ? CustomEvent : UNIVERSAL_SENTINEL):
          return this.parseCustomEvent(id, current as unknown as CustomEvent);
        case (typeof DOMException !== 'undefined' ? DOMException : UNIVERSAL_SENTINEL):
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
      (currentFeatures & Feature.AggregateError)
      && typeof AggregateError !== 'undefined'
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
    if (
      currentFeatures & Feature.Symbol
      && (Symbol.iterator in current || Symbol.asyncIterator in current)
    ) {
      return this.parsePlainObject(id, current, !!currentClass);
    }
    throw new UnsupportedTypeError(current);
  }

  private parseWithError<T>(current: T): SerovalNode | undefined {
    try {
      return this.parse(current);
    } catch (err) {
      this.onError(err);
      return undefined;
    }
  }

  /**
   * @private
   */
  start<T>(current: T): void {
    const parsed = this.parseWithError(current);
    if (parsed) {
      this.onParse(parsed, true);

      // Check if there's any pending pushes
      if (this.pending <= 0) {
        this.destroy();
      }
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
