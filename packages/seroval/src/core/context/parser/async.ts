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
  createStreamConstructorNode,
  createStreamNextNode,
  createStreamThrowNode,
  createStreamReturnNode,
} from '../../base-primitives';
import { BIGINT_FLAG, Feature } from '../../compat';
import {
  SerovalNodeType,
} from '../../constants';
import {
  NULL_NODE,
  TRUE_NODE,
  FALSE_NODE,
  UNDEFINED_NODE,
} from '../../literals';
import { iteratorToSequence } from '../../utils/iterator-to-sequence';
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
  SerovalMapNode,
  SerovalPlainRecordNode,
  SerovalPluginNode,
  SerovalSetNode,
  SerovalDataViewNode,
  SerovalStreamConstructorNode,
} from '../../types';
import { SpecialReference } from '../../special-reference';
import type { Stream } from '../../stream';
import { createStreamFromAsyncIterable, isStream } from '../../stream';

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
            this.parseAsyncIteratorFactory(),
            await this.parse(
              createStreamFromAsyncIterable(
                properties as unknown as AsyncIterable<unknown>,
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

  private async parseStream(
    id: number,
    current: Stream<unknown>,
  ): Promise<SerovalStreamConstructorNode> {
    return createStreamConstructorNode(
      id,
      this.parseSpecialReference(SpecialReference.StreamConstructor),
      await new Promise<SerovalNode[]>((resolve, reject) => {
        const sequence: SerovalNode[] = [];
        const cleanup = current.on({
          next: (value) => {
            this.markRef(id);
            this.parse(value).then(
              (data) => {
                sequence.push(
                  createStreamNextNode(id, data),
                );
              },
              (data) => {
                reject(data);
                cleanup();
              },
            );
          },
          throw: (value) => {
            this.markRef(id);
            this.parse(value).then(
              (data) => {
                sequence.push(
                  createStreamThrowNode(id, data),
                );
                resolve(sequence);
                cleanup();
              },
              (data) => {
                reject(data);
                cleanup();
              },
            );
          },
          return: (value) => {
            this.markRef(id);
            this.parse(value).then(
              (data) => {
                sequence.push(
                  createStreamReturnNode(id, data),
                );
                resolve(sequence);
                cleanup();
              },
              (data) => {
                reject(data);
                cleanup();
              },
            );
          },
        });
      }),
    );
  }

  private async parseObject(
    id: number,
    current: object,
  ): Promise<SerovalNode> {
    if (Array.isArray(current)) {
      return this.parseArray(id, current);
    }
    if (isStream(current)) {
      return this.parseStream(id, current);
    }
    const parsed = await this.parsePlugin(id, current);
    if (parsed) {
      return parsed;
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
