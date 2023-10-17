import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import {
  createArrayBufferNode,
  createDateNode,
  createPluginNode,
  createRegExpNode,
} from '../base-primitives';
import type { BaseSyncParserContextOptions } from './sync';
import BaseSyncParserContext from './sync';
import { BIGINT_FLAG, Feature } from '../compat';
import { SerovalNodeType } from '../constants';
import { createRequestOptions, createResponseOptions } from '../constructors';
import { NULL_NODE } from '../literals';
import { serializeString } from '../string';
import type {
  SerovalNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalReadableStreamConstructorNode,
  SerovalRequestNode,
  SerovalResponseNode,
} from '../types';
import { createDOMExceptionNode, createURLNode, createURLSearchParamsNode } from '../web-api';

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
    this.onParseCallback(node, initial);
  }

  private onError(error: unknown): void {
    if (this.onErrorCallback) {
      this.onErrorCallback(error);
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
            try {
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
            } catch (err) {
              this.onError(err);
            }
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

  protected parsePlugin(
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

  /**
   * @private
   */
  start<T>(current: T): void {
    let result: SerovalNode;
    try {
      result = this.parse(current);
    } catch (err) {
      this.onError(err);
      return;
    }

    this.onParse(
      result,
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
