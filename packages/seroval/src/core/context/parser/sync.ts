import {
  createAggregateErrorNode,
  createArrayBufferNode,
  createArrayNode,
  createAsyncIteratorFactoryInstanceNode,
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
  createStreamConstructorNode,
  createStringNode,
  createTypedArrayNode,
} from '../../base-primitives';
import { Feature } from '../../compat';
import { NIL } from '../../constants';
import { SerovalParserError, SerovalUnsupportedTypeError } from '../../errors';
import {
  FALSE_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
} from '../../literals';
import { OpaqueReference } from '../../opaque-reference';
import { SpecialReference } from '../../special-reference';
import type { Stream } from '../../stream';
import { createStream, isStream } from '../../stream';
import { serializeString } from '../../string';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalDataViewNode,
  SerovalErrorNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordKey,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalPromiseConstructorNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
} from '../../types';
import { getErrorOptions } from '../../utils/error';
import { iteratorToSequence } from '../../utils/iterator-to-sequence';
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../../utils/typed-array';
import type { BaseParserContextOptions } from '../parser';
import { BaseParserContext, ParserNodeType } from '../parser';

type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode;

export type BaseSyncParserContextOptions = BaseParserContextOptions;

export default abstract class BaseSyncParserContext extends BaseParserContext {
  protected parseItems(current: unknown[]): SerovalNode[] {
    const nodes = [];
    for (let i = 0, len = current.length; i < len; i++) {
      if (i in current) {
        nodes[i] = this.parse(current[i]);
      }
    }
    return nodes;
  }

  protected parseArray(id: number, current: unknown[]): SerovalArrayNode {
    return createArrayNode(id, current, this.parseItems(current));
  }

  protected parseProperties(
    properties: Record<string | symbol, unknown>,
  ): SerovalObjectRecordNode {
    const entries = Object.entries(properties);
    const keyNodes: SerovalObjectRecordKey[] = [];
    const valueNodes: SerovalNode[] = [];
    for (let i = 0, len = entries.length; i < len; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(this.parse(entries[i][1]));
    }
    // Check special properties, symbols in this case
    let symbol = Symbol.iterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
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
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(
        createAsyncIteratorFactoryInstanceNode(
          this.parseAsyncIteratorFactory(),
          this.parse(createStream()),
        ),
      );
    }
    symbol = Symbol.toStringTag;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(createStringNode(properties[symbol] as string));
    }
    symbol = Symbol.isConcatSpreadable;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
      valueNodes.push(properties[symbol] ? TRUE_NODE : FALSE_NODE);
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

  protected parseBoxed(id: number, current: object): SerovalBoxedNode {
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

  protected parseDataView(id: number, current: DataView): SerovalDataViewNode {
    return createDataViewNode(id, current, this.parse(current.buffer));
  }

  protected parseError(id: number, current: Error): SerovalErrorNode {
    const options = getErrorOptions(current, this.features);
    return createErrorNode(
      id,
      current,
      options ? this.parseProperties(options) : NIL,
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
      options ? this.parseProperties(options) : NIL,
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
    return this.createMapNode(id, keyNodes, valueNodes, current.size);
  }

  protected parseSet(id: number, current: Set<unknown>): SerovalSetNode {
    const items: SerovalNode[] = [];
    for (const item of current.keys()) {
      items.push(this.parse(item));
    }
    return createSetNode(id, current.size, items);
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

  protected parseStream(id: number, _current: Stream<unknown>): SerovalNode {
    return createStreamConstructorNode(
      id,
      this.parseSpecialReference(SpecialReference.StreamConstructor),
      [],
    );
  }

  protected parsePromise(
    id: number,
    _current: Promise<unknown>,
  ): SerovalPromiseConstructorNode {
    return this.createPromiseConstructorNode(id, this.createIndex({}));
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ehh
  protected parseObject(id: number, current: object): SerovalNode {
    if (Array.isArray(current)) {
      return this.parseArray(id, current);
    }
    if (isStream(current)) {
      return this.parseStream(id, current);
    }
    const currentClass = current.constructor;
    if (currentClass === OpaqueReference) {
      return this.parse(
        (current as OpaqueReference<unknown, unknown>).replacement,
      );
    }
    const parsed = this.parsePlugin(id, current);
    if (parsed) {
      return parsed;
    }
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
      case Map:
        return this.parseMap(id, current as unknown as Map<unknown, unknown>);
      case Set:
        return this.parseSet(id, current as unknown as Set<unknown>);
      default:
        break;
    }
    // Promises
    if (currentClass === Promise || current instanceof Promise) {
      return this.parsePromise(id, current as unknown as Promise<unknown>);
    }
    const currentFeatures = this.features;
    // BigInt Typed Arrays
    if (currentFeatures & Feature.BigIntTypedArray) {
      switch (currentClass) {
        case BigInt64Array:
        case BigUint64Array:
          return this.parseBigIntTypedArray(
            id,
            current as unknown as BigIntTypedArrayValue,
          );
        default:
          break;
      }
    }
    if (
      currentFeatures & Feature.AggregateError &&
      typeof AggregateError !== 'undefined' &&
      (currentClass === AggregateError || current instanceof AggregateError)
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
    if (Symbol.iterator in current || Symbol.asyncIterator in current) {
      return this.parsePlainObject(id, current, !!currentClass);
    }
    throw new SerovalUnsupportedTypeError(current);
  }

  protected parseFunction(current: unknown): SerovalNode {
    const ref = this.getReference(current);
    if (ref.type !== ParserNodeType.Fresh) {
      return ref.value;
    }
    const plugin = this.parsePlugin(ref.value, current);
    if (plugin) {
      return plugin;
    }
    throw new SerovalUnsupportedTypeError(current);
  }

  parse<T>(current: T): SerovalNode {
    switch (typeof current) {
      case 'boolean':
        return current ? TRUE_NODE : FALSE_NODE;
      case 'undefined':
        return UNDEFINED_NODE;
      case 'string':
        return createStringNode(current as string);
      case 'number':
        return createNumberNode(current as number);
      case 'bigint':
        return createBigIntNode(current as bigint);
      case 'object': {
        if (current) {
          const ref = this.getReference(current);
          return ref.type === ParserNodeType.Fresh
            ? this.parseObject(ref.value, current as object)
            : ref.value;
        }
        return NULL_NODE;
      }
      case 'symbol':
        return this.parseWellKnownSymbol(current);
      case 'function': {
        return this.parseFunction(current);
      }
      default:
        throw new SerovalUnsupportedTypeError(current);
    }
  }

  parseTop<T>(current: T): SerovalNode {
    try {
      return this.parse(current);
    } catch (error) {
      throw error instanceof SerovalParserError
        ? error
        : new SerovalParserError(error);
    }
  }
}
