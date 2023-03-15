/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { Feature } from '../compat';
import { createRef, ParserContext } from '../context';
import quote from '../quote';
import {
  AsyncServerValue,
  BigIntTypedArrayValue,
  TypedArrayValue,
} from '../types';
import {
  FALSE_NODE,
  INFINITY_NODE,
  NEG_INFINITY_NODE,
  NEG_ZERO_NODE,
  NULL_NODE,
  TRUE_NODE,
  UNDEFINED_NODE,
} from './primitives';
import {
  getErrorConstructor,
  getErrorOptions,
  getIterableOptions,
  isIterable,
} from './shared';
import {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalBigIntNode,
  SerovalBigIntTypedArrayNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalIterableNode,
  SerovalMapNode,
  SerovalMapRecordNode,
  SerovalNode,
  SerovalNodeType,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordNode,
  SerovalPrimitiveNode,
  SerovalPromiseNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSetNode,
  SerovalTypedArrayNode,
} from './types';

type ObjectLikeNode =
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalIterableNode
  | SerovalPromiseNode;

type ObjectLikeValue =
  | Record<string, AsyncServerValue>
  | Iterable<AsyncServerValue>
  | PromiseLike<AsyncServerValue>;

class AsyncParser {
  ctx: ParserContext;

  constructor(ctx: ParserContext) {
    this.ctx = ctx;
  }

  async generateNodeList(
    current: AsyncServerValue[],
  ) {
    const size = current.length;
    const nodes = new Array<SerovalNode>(size);
    const deferred = new Array<AsyncServerValue>(size);
    let item: AsyncServerValue;
    for (let i = 0; i < size; i++) {
      if (i in current) {
        item = current[i];
        if (isIterable(item)) {
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

  async generateArrayNode(
    id: number,
    current: AsyncServerValue[],
  ): Promise<SerovalArrayNode> {
    return new SerovalArrayNode(id, await this.generateNodeList(current));
  }

  async generateMapNode(
    id: number,
    current: Map<AsyncServerValue, AsyncServerValue>,
  ): Promise<SerovalMapNode> {
    assert(this.ctx.features & Feature.Map, 'Unsupported type "Map"');
    const len = current.size;
    const keyNodes = new Array<SerovalNode>(len);
    const valueNodes = new Array<SerovalNode>(len);
    const deferredKey = new Array<AsyncServerValue>(len);
    const deferredValue = new Array<AsyncServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const [key, value] of current.entries()) {
      // Either key or value might be an iterable
      if (isIterable(key) || isIterable(value)) {
        deferredKey[deferredSize] = key;
        deferredValue[deferredSize] = value;
        deferredSize++;
      } else {
        keyNodes[nodeSize] = await this.parse(key);
        valueNodes[nodeSize] = await this.parse(value);
        nodeSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodeSize + i] = await this.parse(deferredKey[i]);
      valueNodes[nodeSize + i] = await this.parse(deferredValue[i]);
    }
    return new SerovalMapNode(id, new SerovalMapRecordNode(keyNodes, valueNodes, len));
  }

  async generateSetNode(
    id: number,
    current: Set<AsyncServerValue>,
  ): Promise<SerovalSetNode> {
    assert(this.ctx.features & Feature.Set, 'Unsupported type "Set"');
    const len = current.size;
    const nodes = new Array<SerovalNode>(len);
    const deferred = new Array<AsyncServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const item of current.keys()) {
      // Iterables are lazy, so the evaluation must be deferred
      if (isIterable(item)) {
        deferred[deferredSize++] = item;
      } else {
        nodes[nodeSize++] = await this.parse(item);
      }
    }
    // Parse deferred items
    for (let i = 0; i < deferredSize; i++) {
      nodes[nodeSize + i] = await this.parse(deferred[i]);
    }
    return new SerovalSetNode(id, nodes);
  }

  async generateProperties(
    properties: Record<string, AsyncServerValue>,
  ): Promise<SerovalObjectRecordNode> {
    const keys = Object.keys(properties);
    const size = keys.length;
    const keyNodes = new Array<string>(size);
    const valueNodes = new Array<SerovalNode>(size);
    const deferredKeys = new Array<string>(size);
    const deferredValues = new Array<AsyncServerValue>(size);
    let deferredSize = 0;
    let nodesSize = 0;
    let item: AsyncServerValue;
    for (const key of keys) {
      item = properties[key];
      if (isIterable(item)) {
        deferredKeys[deferredSize] = key;
        deferredValues[deferredSize] = item;
        deferredSize++;
      } else {
        keyNodes[nodesSize] = key;
        valueNodes[nodesSize] = await this.parse(item);
        nodesSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodesSize + i] = deferredKeys[i];
      valueNodes[nodesSize + i] = await this.parse(deferredValues[i]);
    }
    return new SerovalObjectRecordNode(keyNodes, valueNodes, size);
  }

  async generateIterableNode(
    id: number,
    current: Iterable<AsyncServerValue>,
  ): Promise<SerovalIterableNode> {
    assert(this.ctx.features & Feature.SymbolIterator, 'Unsupported type "Iterable"');
    const options = getIterableOptions(current);
    return new SerovalIterableNode(
      id,
      // Parse options first before the items
      options
        ? await this.generateProperties(options as Record<string, AsyncServerValue>)
        : undefined,
      await this.generateNodeList(Array.from(current)),
    );
  }

  async generatePromiseNode(
    id: number,
    current: PromiseLike<AsyncServerValue>,
  ): Promise<SerovalPromiseNode> {
    assert(this.ctx.features & Feature.Promise, 'Unsupported type "Promise"');
    return current.then(async (value) => new SerovalPromiseNode(id, await this.parse(value)));
  }

  async generateObjectNode(
    id: number,
    current: ObjectLikeValue,
    empty: boolean,
  ): Promise<ObjectLikeNode> {
    if (Symbol.iterator in current) {
      return this.generateIterableNode(id, current);
    }
    if ('then' in current && typeof current.then === 'function') {
      return this.generatePromiseNode(id, current as PromiseLike<AsyncServerValue>);
    }
    const properties = await this.generateProperties(current as Record<string, AsyncServerValue>);
    if (empty) {
      return new SerovalNullConstructorNode(id, properties);
    }
    return new SerovalObjectNode(id, properties);
  }

  async generateAggregateErrorNode(
    id: number,
    current: AggregateError,
  ): Promise<SerovalAggregateErrorNode> {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? await this.generateProperties(options)
      : undefined;
    return new SerovalAggregateErrorNode(
      id,
      current.message,
      optionsNode,
      await this.parse(current.errors),
    );
  }

  async generateErrorNode(
    id: number,
    current: Error,
  ): Promise<SerovalErrorNode> {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? await this.generateProperties(options)
      : undefined;
    return new SerovalErrorNode(id, getErrorConstructor(current), current.message, optionsNode);
  }

  async parse(current: AsyncServerValue): Promise<SerovalNode> {
    switch (typeof current) {
      case 'boolean':
        return current ? TRUE_NODE : FALSE_NODE;
      case 'undefined':
        return UNDEFINED_NODE;
      case 'string':
        return new SerovalPrimitiveNode(quote(current));
      case 'number':
        if (Object.is(current, -0)) {
          return NEG_ZERO_NODE;
        }
        if (Object.is(current, Infinity)) {
          return INFINITY_NODE;
        }
        if (Object.is(current, -Infinity)) {
          return NEG_INFINITY_NODE;
        }
        return new SerovalPrimitiveNode(current);
      case 'bigint':
        assert(this.ctx.features & Feature.BigInt, 'Unsupported type "BigInt"');
        return new SerovalBigIntNode(current);
      case 'object': {
        if (!current) {
          return NULL_NODE;
        }
        // Non-primitive values needs a reference ID
        // mostly because the values themselves are stateful
        const id = createRef(this.ctx, current, true);
        if (this.ctx.markedRefs[id]) {
          return new SerovalReferenceNode(id);
        }
        if (Array.isArray(current)) {
          return this.generateArrayNode(id, current);
        }
        switch (current.constructor) {
          case Date:
            return new SerovalDateNode(id, current as Date);
          case RegExp:
            return new SerovalRegExpNode(id, current as RegExp);
          case Promise:
            return this.generatePromiseNode(id, current as Promise<AsyncServerValue>);
          case Int8Array:
          case Int16Array:
          case Int32Array:
          case Uint8Array:
          case Uint16Array:
          case Uint32Array:
          case Uint8ClampedArray:
          case Float32Array:
          case Float64Array:
            assert(this.ctx.features & Feature.TypedArray, `Unsupported value type "${current.constructor.name}"`);
            return new SerovalTypedArrayNode(id, current as TypedArrayValue);
          case BigInt64Array:
          case BigUint64Array:
            assert(
              this.ctx.features & (Feature.BigIntTypedArray),
              `Unsupported value type "${current.constructor.name}"`,
            );
            return new SerovalBigIntTypedArrayNode(id, current as BigIntTypedArrayValue);
          case Map:
            return this.generateMapNode(id, current as Map<AsyncServerValue, AsyncServerValue>);
          case Set:
            return this.generateSetNode(id, current as Set<AsyncServerValue>);
          case Object:
            return this.generateObjectNode(id, current as Record<string, AsyncServerValue>, false);
          case undefined:
            return this.generateObjectNode(id, current as Record<string, AsyncServerValue>, true);
          case AggregateError:
            if (this.ctx.features & Feature.AggregateError) {
              return this.generateAggregateErrorNode(id, current as AggregateError);
            }
            return this.generateErrorNode(id, current as AggregateError);
          case Error:
          case EvalError:
          case RangeError:
          case ReferenceError:
          case SyntaxError:
          case TypeError:
          case URIError:
            return this.generateErrorNode(id, current as Error);
          default:
            break;
        }
        if (current instanceof AggregateError && this.ctx.features & Feature.AggregateError) {
          return this.generateAggregateErrorNode(id, current);
        }
        if (current instanceof Error) {
          return this.generateErrorNode(id, current);
        }
        if (current instanceof Promise) {
          return this.generatePromiseNode(id, current);
        }
        // Generator functions don't have a global constructor
        if (Symbol.iterator in current) {
          return this.generateIterableNode(id, current);
        }
        // For Promise-like objects
        if ('then' in current && typeof current.then === 'function') {
          return this.generatePromiseNode(id, current as PromiseLike<AsyncServerValue>);
        }
        throw new Error('Unsupported type');
      }
      default:
        throw new Error('Unsupported type');
    }
  }
}

export default async function parseAsync(
  ctx: ParserContext,
  current: AsyncServerValue,
) {
  const result = await new AsyncParser(ctx).parse(current);
  const isObject = result.t === SerovalNodeType.Object
    || result.t === SerovalNodeType.Iterable;
  return [result, createRef(ctx, current, false), isObject] as const;
}
