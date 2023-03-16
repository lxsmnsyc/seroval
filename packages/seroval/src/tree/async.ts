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
  createBigIntNode,
  createBigIntTypedArrayNode,
  createDateNode,
  createPrimitiveNode,
  createReferenceNode,
  createRegExpNode,
  createTypedArrayNode,
  FALSE_NODE,
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
  SerovalErrorNode,
  SerovalIterableNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNodeType,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordNode,
  SerovalPromiseNode,
  SerovalSetNode,
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
  static async generateNodeList(
    ctx: ParserContext,
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
          nodes[i] = await this.parse(ctx, item);
        }
      }
    }
    for (let i = 0; i < size; i++) {
      if (i in deferred) {
        nodes[i] = await this.parse(ctx, deferred[i]);
      }
    }
    return nodes;
  }

  static async generateArrayNode(
    ctx: ParserContext,
    id: number,
    current: AsyncServerValue[],
  ): Promise<SerovalArrayNode> {
    return {
      t: SerovalNodeType.Array,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      d: undefined,
      a: await this.generateNodeList(ctx, current),
      n: undefined,
    };
  }

  static async generateMapNode(
    ctx: ParserContext,
    id: number,
    current: Map<AsyncServerValue, AsyncServerValue>,
  ): Promise<SerovalMapNode> {
    assert(ctx.features & Feature.Map, 'Unsupported type "Map"');
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
        keyNodes[nodeSize] = await this.parse(ctx, key);
        valueNodes[nodeSize] = await this.parse(ctx, value);
        nodeSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodeSize + i] = await this.parse(ctx, deferredKey[i]);
      valueNodes[nodeSize + i] = await this.parse(ctx, deferredValue[i]);
    }
    return {
      t: SerovalNodeType.Map,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      d: { k: keyNodes, v: valueNodes, s: len },
      a: undefined,
      n: undefined,
    };
  }

  static async generateSetNode(
    ctx: ParserContext,
    id: number,
    current: Set<AsyncServerValue>,
  ): Promise<SerovalSetNode> {
    assert(ctx.features & Feature.Set, 'Unsupported type "Set"');
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
        nodes[nodeSize++] = await this.parse(ctx, item);
      }
    }
    // Parse deferred items
    for (let i = 0; i < deferredSize; i++) {
      nodes[nodeSize + i] = await this.parse(ctx, deferred[i]);
    }
    return {
      t: SerovalNodeType.Set,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      d: undefined,
      a: nodes,
      n: undefined,
    };
  }

  static async generateProperties(
    ctx: ParserContext,
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
        valueNodes[nodesSize] = await this.parse(ctx, item);
        nodesSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodesSize + i] = deferredKeys[i];
      valueNodes[nodesSize + i] = await this.parse(ctx, deferredValues[i]);
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: size,
    };
  }

  static async generateIterableNode(
    ctx: ParserContext,
    id: number,
    current: Iterable<AsyncServerValue>,
  ): Promise<SerovalIterableNode> {
    assert(ctx.features & Feature.SymbolIterator, 'Unsupported type "Iterable"');
    const options = getIterableOptions(current);
    return {
      t: SerovalNodeType.Iterable,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      // Parse options first before the items
      d: options
        ? await this.generateProperties(ctx, options as Record<string, AsyncServerValue>)
        : undefined,
      a: await this.generateNodeList(ctx, Array.from(current)),
      n: undefined,
    };
  }

  static async generatePromiseNode(
    ctx: ParserContext,
    id: number,
    current: PromiseLike<AsyncServerValue>,
  ): Promise<SerovalPromiseNode> {
    assert(ctx.features & Feature.Promise, 'Unsupported type "Promise"');
    return current.then(async (value) => ({
      t: SerovalNodeType.Promise,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      // Parse options first before the items
      d: undefined,
      a: undefined,
      n: await this.parse(ctx, value),
    }));
  }

  static async generateObjectNode(
    ctx: ParserContext,
    id: number,
    current: ObjectLikeValue,
    empty: boolean,
  ): Promise<ObjectLikeNode> {
    if (Symbol.iterator in current) {
      return this.generateIterableNode(ctx, id, current);
    }
    if ('then' in current && typeof current.then === 'function') {
      return this.generatePromiseNode(ctx, id, current as PromiseLike<AsyncServerValue>);
    }
    return {
      t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      d: await this.generateProperties(ctx, current as Record<string, AsyncServerValue>),
      a: undefined,
      n: undefined,
    };
  }

  static async generateAggregateErrorNode(
    ctx: ParserContext,
    id: number,
    current: AggregateError,
  ): Promise<SerovalAggregateErrorNode> {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? await this.generateProperties(ctx, options)
      : undefined;
    return {
      t: SerovalNodeType.AggregateError,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: current.message,
      d: optionsNode,
      a: undefined,
      n: await this.parse(ctx, current.errors),
    };
  }

  static async generateErrorNode(
    ctx: ParserContext,
    id: number,
    current: Error,
  ): Promise<SerovalErrorNode> {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? await this.generateProperties(ctx, options)
      : undefined;
    return {
      t: SerovalNodeType.Error,
      i: id,
      s: undefined,
      l: undefined,
      c: getErrorConstructor(current),
      m: current.message,
      d: optionsNode,
      a: undefined,
      n: undefined,
    };
  }

  static async parse(
    ctx: ParserContext,
    current: AsyncServerValue,
  ): Promise<SerovalNode> {
    switch (typeof current) {
      case 'boolean':
        return current ? TRUE_NODE : FALSE_NODE;
      case 'undefined':
        return UNDEFINED_NODE;
      case 'string':
        return createPrimitiveNode(quote(current));
      case 'number':
        if (Object.is(current, -0)) {
          return NEG_ZERO_NODE;
        }
        if (Object.is(current, Infinity)) {
          return createPrimitiveNode('1/0');
        }
        if (Object.is(current, -Infinity)) {
          return createPrimitiveNode('-1/0');
        }
        return createPrimitiveNode(current);
      case 'bigint':
        return createBigIntNode(ctx, current);
      case 'object': {
        if (!current) {
          return NULL_NODE;
        }
        // Non-primitive values needs a reference ID
        // mostly because the values themselves are stateful
        const id = createRef(ctx, current, true);
        if (ctx.markedRefs.has(id)) {
          return createReferenceNode(id);
        }
        if (Array.isArray(current)) {
          return this.generateArrayNode(ctx, id, current);
        }
        switch (current.constructor) {
          case Date:
            return createDateNode(id, current as Date);
          case RegExp:
            return createRegExpNode(id, current as RegExp);
          case Promise:
            return this.generatePromiseNode(ctx, id, current as Promise<AsyncServerValue>);
          case Int8Array:
          case Int16Array:
          case Int32Array:
          case Uint8Array:
          case Uint16Array:
          case Uint32Array:
          case Uint8ClampedArray:
          case Float32Array:
          case Float64Array:
            return createTypedArrayNode(ctx, id, current as TypedArrayValue);
          case BigInt64Array:
          case BigUint64Array:
            return createBigIntTypedArrayNode(ctx, id, current as BigIntTypedArrayValue);
          case Map:
            return this.generateMapNode(
              ctx,
              id,
              current as Map<AsyncServerValue, AsyncServerValue>,
            );
          case Set:
            return this.generateSetNode(
              ctx,
              id,
              current as Set<AsyncServerValue>,
            );
          case Object:
            return this.generateObjectNode(
              ctx,
              id,
              current as Record<string, AsyncServerValue>,
              false,
            );
          case undefined:
            return this.generateObjectNode(
              ctx,
              id,
              current as Record<string, AsyncServerValue>,
              true,
            );
          case AggregateError:
            if (ctx.features & Feature.AggregateError) {
              return this.generateAggregateErrorNode(ctx, id, current as AggregateError);
            }
            return this.generateErrorNode(ctx, id, current as AggregateError);
          case Error:
          case EvalError:
          case RangeError:
          case ReferenceError:
          case SyntaxError:
          case TypeError:
          case URIError:
            return this.generateErrorNode(ctx, id, current as Error);
          default:
            break;
        }
        if (current instanceof AggregateError && ctx.features & Feature.AggregateError) {
          return this.generateAggregateErrorNode(ctx, id, current);
        }
        if (current instanceof Error) {
          return this.generateErrorNode(ctx, id, current);
        }
        if (current instanceof Promise) {
          return this.generatePromiseNode(ctx, id, current);
        }
        // Generator functions don't have a global constructor
        if (Symbol.iterator in current) {
          return this.generateIterableNode(ctx, id, current);
        }
        // For Promise-like objects
        if ('then' in current && typeof current.then === 'function') {
          return this.generatePromiseNode(ctx, id, current as PromiseLike<AsyncServerValue>);
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
  const result = await AsyncParser.parse(ctx, current);
  const isObject = result.t === SerovalNodeType.Object
    || result.t === SerovalNodeType.Iterable;
  return [result, createRef(ctx, current, false), isObject] as const;
}
