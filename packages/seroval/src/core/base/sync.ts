/* eslint-disable prefer-destructuring */
import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import UnsupportedTypeError from '../UnsupportedTypeError';
import assert from '../assert';
import {
  createArrayBufferNode,
  createArrayNode,
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
  UNIVERSAL_SENTINEL,
} from '../constants';
import { createCustomEventOptions, createEventOptions } from '../constructors';
import {
  FALSE_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
} from '../literals';
import { iteratorToSequence } from '../iterator-to-sequence';
import type { BaseParserContextOptions } from '../parser-context';
import { BaseParserContext } from '../parser-context';
import { hasReferenceID } from '../reference';
import { getErrorConstructor, getErrorOptions } from '../shared';
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
} from '../types';
import { createDOMExceptionNode, createURLNode, createURLSearchParamsNode } from '../web-api';
import { SpecialReference } from '../special-reference';

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
    properties: Record<string, unknown>,
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
      if (Symbol.iterator in properties) {
        keyNodes.push(SerovalObjectRecordSpecialKey.SymbolIterator);
        valueNodes.push(this.parse(iteratorToSequence(properties as Iterable<unknown>)));
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
      x: undefined,
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
      x: undefined,
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
      x: undefined,
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
      x: undefined,
    };
  }

  protected parseError(
    id: number,
    current: Error,
  ): SerovalErrorNode {
    const options = getErrorOptions(current, this.features);
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
      x: undefined,
    };
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
      x: {
        [SpecialReference.Sentinel]: this.parseMapSentinel(),
      },
    };
  }

  protected parseSet(
    id: number,
    current: Set<unknown>,
  ): SerovalSetNode {
    const nodes: SerovalNode[] = [];
    for (const item of current.keys()) {
      nodes.push(this.parse(item));
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
      x: undefined,
    };
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
      x: undefined,
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
      x: undefined,
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
      x: undefined,
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
      x: undefined,
    };
  }

  protected parseAggregateError(
    id: number,
    current: AggregateError,
  ): SerovalAggregateErrorNode {
    const options = getErrorOptions(current, this.features);
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
      x: undefined,
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
    if (currentFeatures & Feature.Symbol && Symbol.iterator in current) {
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
