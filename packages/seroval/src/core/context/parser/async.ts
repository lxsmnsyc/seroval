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
  createStreamNextNode,
  createStreamReturnNode,
  createStreamThrowNode,
  createStringNode,
  createTypedArrayNode,
} from '../../base-primitives';
import { Feature } from '../../compat';
import { SerovalNodeType } from '../../constants';
import { SerovalParserError, SerovalUnsupportedTypeError } from '../../errors';
import {
  FALSE_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
} from '../../literals';
import { SpecialReference } from '../../special-reference';
import type { Stream } from '../../stream';
import { createStreamFromAsyncIterable, isStream } from '../../stream';
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
  SerovalPromiseNode,
  SerovalSetNode,
  SerovalStreamConstructorNode,
  SerovalTypedArrayNode,
} from '../../types';
import { getErrorOptions } from '../../utils/error';
import { iteratorToSequence } from '../../utils/iterator-to-sequence';
import promiseToResult from '../../utils/promise-to-result';
import type {
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../../utils/typed-array';
import { BaseParserContext } from '../parser';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode;

export default abstract class BaseAsyncParserContext extends BaseParserContext {
  private async parseItems(current: unknown[]): Promise<SerovalNode[]> {
    const nodes = [];
    for (let i = 0, len = current.length; i < len; i++) {
      // For consistency in holes
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
    return createArrayNode(id, current, await this.parseItems(current));
  }

  private async parseProperties(
    properties: Record<string | symbol, unknown>,
  ): Promise<SerovalObjectRecordNode> {
    const entries = Object.entries(properties);
    const keyNodes: SerovalObjectRecordKey[] = [];
    const valueNodes: SerovalNode[] = [];
    for (let i = 0, len = entries.length; i < len; i++) {
      keyNodes.push(serializeString(entries[i][0]));
      valueNodes.push(await this.parse(entries[i][1]));
    }
    // Check special properties
    let symbol = Symbol.iterator;
    if (symbol in properties) {
      keyNodes.push(this.parseWellKnownSymbol(symbol));
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
      keyNodes.push(this.parseWellKnownSymbol(symbol));
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
    return createBigIntTypedArrayNode(
      id,
      current,
      await this.parse(current.buffer),
    );
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
      options ? await this.parseProperties(options) : undefined,
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
      options ? await this.parseProperties(options) : undefined,
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
    return this.createMapNode(id, keyNodes, valueNodes, current.size);
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
          next: value => {
            this.markRef(id);
            this.parse(value).then(
              data => {
                sequence.push(createStreamNextNode(id, data));
              },
              data => {
                reject(data);
                cleanup();
              },
            );
          },
          throw: value => {
            this.markRef(id);
            this.parse(value).then(
              data => {
                sequence.push(createStreamThrowNode(id, data));
                resolve(sequence);
                cleanup();
              },
              data => {
                reject(data);
                cleanup();
              },
            );
          },
          return: value => {
            this.markRef(id);
            this.parse(value).then(
              data => {
                sequence.push(createStreamReturnNode(id, data));
                resolve(sequence);
                cleanup();
              },
              data => {
                reject(data);
                cleanup();
              },
            );
          },
        });
      }),
    );
  }

  private async parseObject(id: number, current: object): Promise<SerovalNode> {
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

  async parse<T>(current: T): Promise<SerovalNode> {
    try {
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
            return ref.type === 0
              ? await this.parseObject(ref.value, current as object)
              : ref.value;
          }
          return NULL_NODE;
        }
        case 'symbol':
          return this.parseWellKnownSymbol(current);
        case 'function':
          return this.parseFunction(current as (...args: unknown[]) => unknown);
        default:
          throw new SerovalUnsupportedTypeError(current);
      }
    } catch (error) {
      throw new SerovalParserError(error);
    }
  }
}
