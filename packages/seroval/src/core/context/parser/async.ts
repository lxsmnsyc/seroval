/* eslint-disable prefer-destructuring */
/* eslint-disable no-await-in-loop */
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../../types';
import UnsupportedTypeError from '../../UnsupportedTypeError';
import assert from '../../utils/assert';
import {
  createPluginNode,
  createDateNode,
  createRegExpNode,
  createArrayBufferNode,
  createBigIntNode,
  createStringNode,
  createNumberNode,
  createArrayNode,
  createBoxedNode,
  createTypedArrayNode,
  createBigIntTypedArrayNode,
  createDataViewNode,
  createErrorNode,
  createSetNode,
  createAggregateErrorNode,
  createIteratorFactoryInstanceNode,
  createAsyncIteratorFactoryInstanceNode,
} from '../../base-primitives';
import { BIGINT_FLAG, Feature } from '../../compat';
import {
  SerovalNodeType,
} from '../../constants';
import {
  createRequestOptions,
  createResponseOptions,
  createEventOptions,
  createCustomEventOptions,
} from '../../utils/constructors';
import {
  NULL_NODE,
  TRUE_NODE,
  FALSE_NODE,
  UNDEFINED_NODE,
} from '../../literals';
import { asyncIteratorToSequence, iteratorToSequence, readableStreamToSequence } from '../../utils/iterator-to-sequence';
import { BaseParserContext } from '../parser';
import promiseToResult from '../../utils/promise-to-result';
import { getErrorOptions } from '../../utils/error';
import { serializeString } from '../../string';
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
  SerovalReadableStreamNode,
} from '../../types';
import {
  createURLNode,
  createURLSearchParamsNode,
  createDOMExceptionNode,
  createEventNode,
  createCustomEventNode,
  createReadableStreamNode,
} from '../../web-api';
import { SpecialReference, UNIVERSAL_SENTINEL } from '../../special-reference';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode;

export default abstract class BaseAsyncParserContext extends BaseParserContext {
  private async parseItems(
    current: unknown[],
  ): Promise<SerovalNode[]> {
    const nodes = [];
    for (let i = 0, len = current.length; i < len; i++) {
      if (i in current) {
        nodes[i] = await this.parse(current[i]);
      }
    }
    return nodes;
  }

  private async parseArray(
    id: number,
    current: unknown[],
  ): Promise<SerovalArrayNode> {
    return createArrayNode(
      id,
      current,
      await this.parseItems(current),
    );
  }

  private async parseProperties(
    properties: Record<string | symbol, unknown>,
  ): Promise<SerovalObjectRecordNode> {
    const entries = Object.entries(properties);
    const keyNodes: SerovalObjectRecordKey[] = [];
    const valueNodes: SerovalNode[] = [];
    for (
      let i = 0, len = entries.length;
      i < len;
      i++
    ) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(await this.parse(entries[i][1]));
    }
    // Check special properties
    if (this.features & Feature.Symbol) {
      let symbol = Symbol.iterator;
      if (symbol in properties) {
        keyNodes.push(
          this.parseWKSymbol(symbol),
        );
        valueNodes.push(
          createIteratorFactoryInstanceNode(
            this.parseIteratorFactory(),
            await this.parse(
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
            this.parseAsyncIteratorFactory(0),
            await this.parse(
              await asyncIteratorToSequence(properties as unknown as AsyncIterable<unknown>),
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

  private async parsePlainObject(
    id: number,
    current: Record<string, unknown>,
    empty: boolean,
  ): Promise<ObjectLikeNode> {
    return this.createObjectNode(
      id,
      current,
      empty,
      await this.parseProperties(current),
    );
  }

  private async parseBoxed(
    id: number,
    current: object,
  ): Promise<SerovalBoxedNode> {
    return createBoxedNode(id, await this.parse(current.valueOf()));
  }

  private async parseTypedArray(
    id: number,
    current: TypedArrayValue,
  ): Promise<SerovalTypedArrayNode> {
    return createTypedArrayNode(id, current, await this.parse(current.buffer));
  }

  private async parseBigIntTypedArray(
    id: number,
    current: BigIntTypedArrayValue,
  ): Promise<SerovalBigIntTypedArrayNode> {
    return createBigIntTypedArrayNode(id, current, await this.parse(current.buffer));
  }

  private async parseDataView(
    id: number,
    current: DataView,
  ): Promise<SerovalDataViewNode> {
    return createDataViewNode(id, current, await this.parse(current.buffer));
  }

  private async parseError(
    id: number,
    current: Error,
  ): Promise<SerovalErrorNode> {
    const options = getErrorOptions(current, this.features);
    return createErrorNode(
      id,
      current,
      options
        ? await this.parseProperties(options)
        : undefined,
    );
  }

  private async parseAggregateError(
    id: number,
    current: AggregateError,
  ): Promise<SerovalAggregateErrorNode> {
    const options = getErrorOptions(current, this.features);
    return createAggregateErrorNode(
      id,
      current,
      options
        ? await this.parseProperties(options)
        : undefined,
    );
  }

  private async parseMap(
    id: number,
    current: Map<unknown, unknown>,
  ): Promise<SerovalMapNode> {
    const keyNodes: SerovalNode[] = [];
    const valueNodes: SerovalNode[] = [];
    for (const [key, value] of current.entries()) {
      keyNodes.push(await this.parse(key));
      valueNodes.push(await this.parse(value));
    }
    return this.createMapNode(
      id,
      keyNodes,
      valueNodes,
      current.size,
    );
  }

  private async parseSet(
    id: number,
    current: Set<unknown>,
  ): Promise<SerovalSetNode> {
    const items: SerovalNode[] = [];
    for (const item of current.keys()) {
      items.push(await this.parse(item));
    }
    return createSetNode(id, current.size, items);
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

  protected async parsePlainProperties(
    entries: [key: string, value: unknown][],
  ): Promise<SerovalPlainRecordNode> {
    const size = entries.length;
    const keyNodes: string[] = [];
    const valueNodes: SerovalNode[] = [];
    for (let i = 0; i < size; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(await this.parse(entries[i][1]));
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
    const items: [key: string, value: unknown][] = [];
    current.forEach((value, key) => {
      items.push([key, value]);
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
    const items: [key: string, value: FormDataEntryValue][] = [];
    current.forEach((value, key) => {
      items.push([key, value]);
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
    return createEventNode(id, current.type, await this.parse(createEventOptions(current)));
  }

  private async parseCustomEvent(
    id: number,
    current: CustomEvent,
  ): Promise<SerovalCustomEventNode> {
    return createCustomEventNode(
      id,
      current.type,
      await this.parse(createCustomEventOptions(current)),
    );
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
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
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

  private async parseReadableStream(
    id: number,
    current: ReadableStream,
  ): Promise<SerovalReadableStreamNode> {
    return createReadableStreamNode(
      id,
      this.parseSpecialReference(SpecialReference.ReadableStream),
      await this.parse(
        await readableStreamToSequence(current),
      ),
    );
  }

  private async parseObject(
    id: number,
    current: object,
  ): Promise<SerovalNode> {
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
        case (typeof Blob !== 'undefined' ? Blob : UNIVERSAL_SENTINEL):
          return this.parseBlob(id, current as unknown as Blob);
        case (typeof File !== 'undefined' ? File : UNIVERSAL_SENTINEL):
          return this.parseFile(id, current as unknown as File);
        case (typeof Headers !== 'undefined' ? Headers : UNIVERSAL_SENTINEL):
          return this.parseHeaders(id, current as unknown as Headers);
        case (typeof FormData !== 'undefined' ? FormData : UNIVERSAL_SENTINEL):
          return this.parseFormData(id, current as unknown as FormData);
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
        case (typeof ReadableStream !== 'undefined' ? ReadableStream : UNIVERSAL_SENTINEL):
          return this.parseReadableStream(id, current as unknown as ReadableStream);
        default:
          break;
      }
    }
    const parsed = await this.parsePlugin(id, current);
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
      case 'symbol':
        return this.parseWKSymbol(current);
      case 'function':
        return this.parseFunction(current);
      default:
        throw new UnsupportedTypeError(current);
    }
  }
}
