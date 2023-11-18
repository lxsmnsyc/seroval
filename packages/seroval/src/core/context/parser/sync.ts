/* eslint-disable prefer-destructuring */
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../../types';
import UnsupportedTypeError from '../../UnsupportedTypeError';
import assert from '../../utils/assert';
import {
  createAggregateErrorNode,
  createArrayBufferNode,
  createArrayNode,
  createBigIntNode,
  createBigIntTypedArrayNode,
  createBoxedNode,
  createDataViewNode,
  createDateNode,
  createErrorNode,
  createIteratorFactoryInstanceNode,
  createNumberNode,
  createPluginNode,
  createRegExpNode,
  createSetNode,
  createStringNode,
  createTypedArrayNode,
  createWKSymbolNode,
} from '../../base-primitives';
import { BIGINT_FLAG, Feature } from '../../compat';
import type { WellKnownSymbols } from '../../constants';
import {
  SerovalNodeType,
} from '../../constants';
import { createCustomEventOptions, createEventOptions } from '../../utils/constructors';
import {
  FALSE_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
} from '../../literals';
import { iteratorToSequence } from '../../utils/iterator-to-sequence';
import type { BaseParserContextOptions } from '../parser';
import { BaseParserContext } from '../parser';
import { hasReferenceID } from '../../reference';
import { getErrorOptions } from '../../utils/error';
import { serializeString } from '../../string';
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
} from '../../types';
import {
  createCustomEventNode,
  createDOMExceptionNode,
  createEventNode,
  createURLNode,
  createURLSearchParamsNode,
} from '../../web-api';
import { UNIVERSAL_SENTINEL } from '../../special-reference';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode;

export type BaseSyncParserContextOptions = BaseParserContextOptions

export default abstract class BaseSyncParserContext extends BaseParserContext {
  protected parseItems(
    current: unknown[],
  ): SerovalNode[] {
    const nodes = [];
    for (let i = 0, len = current.length; i < len; i++) {
      if (i in current) {
        nodes[i] = this.parse(current[i]);
      }
    }
    return nodes;
  }

  protected parseArray(
    id: number,
    current: unknown[],
  ): SerovalArrayNode {
    return createArrayNode(
      id,
      current,
      this.parseItems(current),
    );
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

  protected parsePlainObject(
    id: number,
    current: Record<string, unknown>,
    empty: boolean,
  ): ObjectLikeNode {
    return this.createObjectNode(
      id,
      current,
      empty,
      this.parseProperties(current),
    );
  }

  protected parseBoxed(
    id: number,
    current: object,
  ): SerovalBoxedNode {
    return createBoxedNode(id, this.parse(current.valueOf()));
  }

  protected parseTypedArray(
    id: number,
    current: TypedArrayValue,
  ): SerovalTypedArrayNode {
    return createTypedArrayNode(id, current, this.parse(current.buffer));
  }

  protected parseBigIntTypedArray(
    id: number,
    current: BigIntTypedArrayValue,
  ): SerovalBigIntTypedArrayNode {
    return createBigIntTypedArrayNode(id, current, this.parse(current.buffer));
  }

  protected parseDataView(
    id: number,
    current: DataView,
  ): SerovalDataViewNode {
    return createDataViewNode(id, current, this.parse(current.buffer));
  }

  protected parseError(
    id: number,
    current: Error,
  ): SerovalErrorNode {
    const options = getErrorOptions(current, this.features);
    return createErrorNode(
      id,
      current,
      options
        ? this.parseProperties(options)
        : undefined,
    );
  }

  protected parseAggregateError(
    id: number,
    current: AggregateError,
  ): SerovalAggregateErrorNode {
    const options = getErrorOptions(current, this.features);
    return createAggregateErrorNode(
      id,
      current,
      options
        ? this.parseProperties(options)
        : undefined,
    );
  }

  protected parseMap(
    id: number,
    current: Map<unknown, unknown>,
  ): SerovalMapNode {
    const keyNodes: SerovalNode[] = [];
    const valueNodes: SerovalNode[] = [];
    for (const [key, value] of current.entries()) {
      keyNodes.push(this.parse(key));
      valueNodes.push(this.parse(value));
    }
    return this.createMapNode(
      id,
      keyNodes,
      valueNodes,
      current.size,
    );
  }

  protected parseSet(
    id: number,
    current: Set<unknown>,
  ): SerovalSetNode {
    const items: SerovalNode[] = [];
    for (const item of current.keys()) {
      items.push(this.parse(item));
    }
    return createSetNode(id, current.size, items);
  }

  protected parsePlainProperties(
    entries: [key: string, value: unknown][],
  ): SerovalPlainRecordNode {
    const size = entries.length;
    const keyNodes: string[] = [];
    const valueNodes: SerovalNode[] = [];
    for (let i = 0; i < size; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(this.parse(entries[i][1]));
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
    const items: [key: string, value: unknown][] = [];
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
    return createEventNode(id, current.type, this.parse(createEventOptions(current)));
  }

  protected parseCustomEvent(
    id: number,
    current: CustomEvent,
  ): SerovalCustomEventNode {
    return createCustomEventNode(id, current.type, this.parse(createCustomEventOptions(current)));
  }

  protected parsePlugin(
    id: number,
    current: unknown,
  ): SerovalPluginNode | undefined {
    const currentPlugins = this.plugins;
    if (currentPlugins) {
      for (let i = 0, len = currentPlugins.length; i < len; i++) {
        const plugin = currentPlugins[i];
        if (plugin.parse.sync && plugin.test(current)) {
          return createPluginNode(
            id,
            plugin.tag,
            plugin.parse.sync(current, this, {
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
      && Symbol.iterator in current
    ) {
      return this.parsePlainObject(id, current, !!currentClass);
    }
    throw new UnsupportedTypeError(current);
  }

  parse<T>(current: T): SerovalNode {
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
        assert(this.features & Feature.Symbol, new UnsupportedTypeError(current));
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
