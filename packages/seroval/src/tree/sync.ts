/* eslint-disable @typescript-eslint/no-use-before-define */
import assert from '../assert';
import { Feature } from '../compat';
import { createRef, ParserContext } from '../context';
import quote from '../quote';
import { BigIntTypedArrayValue, ServerValue, TypedArrayValue } from '../types';
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
  SerovalSetNode,
} from './types';

type ObjectLikeNode = SerovalObjectNode | SerovalNullConstructorNode | SerovalIterableNode;

class SyncParser {
  ctx: ParserContext;

  constructor(ctx: ParserContext) {
    this.ctx = ctx;
  }

  generateNodeList(current: ServerValue[]) {
    const size = current.length;
    const nodes = new Array<SerovalNode>(size);
    const deferred = new Array<ServerValue>(size);
    let item: ServerValue;
    for (let i = 0; i < size; i++) {
      if (i in current) {
        item = current[i];
        if (isIterable(item)) {
          deferred[i] = item;
        } else {
          nodes[i] = this.parse(item);
        }
      }
    }
    for (let i = 0; i < size; i++) {
      if (i in deferred) {
        nodes[i] = this.parse(deferred[i]);
      }
    }
    return nodes;
  }

  generateArrayNode(id: number, current: ServerValue[]): SerovalArrayNode {
    return {
      t: SerovalNodeType.Array,
      i: id,
      a: this.generateNodeList(current),
      s: undefined,
      l: undefined,
      m: undefined,
      c: undefined,
      d: undefined,
      n: undefined,
    };
  }

  generateMapNode(
    id: number,
    current: Map<ServerValue, ServerValue>,
  ): SerovalMapNode {
    assert(this.ctx.features & Feature.Map, 'Unsupported type "Map"');
    const len = current.size;
    const keyNodes = new Array<SerovalNode>(len);
    const valueNodes = new Array<SerovalNode>(len);
    const deferredKey = new Array<ServerValue>(len);
    const deferredValue = new Array<ServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const [key, value] of current.entries()) {
      // Either key or value might be an iterable
      if (isIterable(key) || isIterable(value)) {
        deferredKey[deferredSize] = key;
        deferredValue[deferredSize] = value;
        deferredSize++;
      } else {
        keyNodes[nodeSize] = this.parse(key);
        valueNodes[nodeSize] = this.parse(value);
        nodeSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodeSize + i] = this.parse(deferredKey[i]);
      valueNodes[nodeSize + i] = this.parse(deferredValue[i]);
    }
    return {
      t: SerovalNodeType.Map,
      i: id,
      a: undefined,
      s: undefined,
      l: undefined,
      m: undefined,
      c: undefined,
      d: { k: keyNodes, v: valueNodes, s: len },
      n: undefined,
    };
  }

  generateSetNode(
    id: number,
    current: Set<ServerValue>,
  ): SerovalSetNode {
    assert(this.ctx.features & Feature.Set, 'Unsupported type "Set"');
    const len = current.size;
    const nodes = new Array<SerovalNode>(len);
    const deferred = new Array<ServerValue>(len);
    let deferredSize = 0;
    let nodeSize = 0;
    for (const item of current.keys()) {
      // Iterables are lazy, so the evaluation must be deferred
      if (isIterable(item)) {
        deferred[deferredSize++] = item;
      } else {
        nodes[nodeSize++] = this.parse(item);
      }
    }
    // Parse deferred items
    for (let i = 0; i < deferredSize; i++) {
      nodes[nodeSize + i] = this.parse(deferred[i]);
    }
    return {
      t: SerovalNodeType.Set,
      i: id,
      a: nodes,
      s: undefined,
      l: undefined,
      m: undefined,
      c: undefined,
      d: undefined,
      n: undefined,
    };
  }

  generateProperties(properties: Record<string, ServerValue>): SerovalObjectRecordNode {
    const keys = Object.keys(properties);
    const size = keys.length;
    const keyNodes = new Array<string>(size);
    const valueNodes = new Array<SerovalNode>(size);
    const deferredKeys = new Array<string>(size);
    const deferredValues = new Array<ServerValue>(size);
    let deferredSize = 0;
    let nodesSize = 0;
    let item: ServerValue;
    for (const key of keys) {
      item = properties[key];
      if (isIterable(item)) {
        deferredKeys[deferredSize] = key;
        deferredValues[deferredSize] = item;
        deferredSize++;
      } else {
        keyNodes[nodesSize] = key;
        valueNodes[nodesSize] = this.parse(item);
        nodesSize++;
      }
    }
    for (let i = 0; i < deferredSize; i++) {
      keyNodes[nodesSize + i] = deferredKeys[i];
      valueNodes[nodesSize + i] = this.parse(deferredValues[i]);
    }
    return {
      k: keyNodes,
      v: valueNodes,
      s: size,
    };
  }

  generateIterableNode(
    id: number,
    current: Iterable<ServerValue>,
  ): SerovalIterableNode {
    assert(this.ctx.features & Feature.SymbolIterator, 'Unsupported type "Iterable"');
    const options = getIterableOptions(current);
    return {
      t: SerovalNodeType.Iterable,
      i: id,
      s: undefined,
      l: undefined,
      m: undefined,
      c: undefined,
      // Parse options first before the items
      d: options
        ? this.generateProperties(options as Record<string, ServerValue>)
        : undefined,
      a: this.generateNodeList(Array.from(current)),
      n: undefined,
    };
  }

  generateObjectNode(
    id: number,
    current: Record<string, ServerValue> | Iterable<ServerValue>,
    empty: boolean,
  ): ObjectLikeNode {
    if (Symbol.iterator in current) {
      return this.generateIterableNode(id, current);
    }
    return {
      t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      i: id,
      s: undefined,
      l: undefined,
      m: undefined,
      c: undefined,
      d: this.generateProperties(current),
      a: undefined,
      n: undefined,
    };
  }

  generateAggregateErrorNode(
    id: number,
    current: AggregateError,
  ): SerovalAggregateErrorNode {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? this.generateProperties(options)
      : undefined;
    return {
      t: SerovalNodeType.AggregateError,
      i: id,
      a: undefined,
      s: undefined,
      l: undefined,
      m: current.message,
      c: undefined,
      d: optionsNode,
      n: this.parse(current.errors),
    };
  }

  generateErrorNode(
    id: number,
    current: Error,
  ): SerovalErrorNode {
    const options = getErrorOptions(current);
    const optionsNode = options
      ? this.generateProperties(options)
      : undefined;
    return {
      t: SerovalNodeType.Error,
      i: id,
      a: undefined,
      s: undefined,
      l: undefined,
      m: current.message,
      c: getErrorConstructor(current),
      d: optionsNode,
      n: undefined,
    };
  }

  parse(current: ServerValue): SerovalNode {
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
        return createBigIntNode(this.ctx, current);
      case 'object': {
        if (!current) {
          return NULL_NODE;
        }
        // Non-primitive values needs a reference ID
        // mostly because the values themselves are stateful
        const id = createRef(this.ctx, current, true);
        if (this.ctx.markedRefs[id]) {
          return createReferenceNode(id);
        }
        if (Array.isArray(current)) {
          return this.generateArrayNode(id, current);
        }
        switch (current.constructor) {
          case Date:
            return createDateNode(id, current as Date);
          case RegExp:
            return createRegExpNode(id, current as RegExp);
          case Int8Array:
          case Int16Array:
          case Int32Array:
          case Uint8Array:
          case Uint16Array:
          case Uint32Array:
          case Uint8ClampedArray:
          case Float32Array:
          case Float64Array:
            return createTypedArrayNode(this.ctx, id, current as TypedArrayValue);
          case BigInt64Array:
          case BigUint64Array:
            return createBigIntTypedArrayNode(this.ctx, id, current as BigIntTypedArrayValue);
          case Map:
            return this.generateMapNode(id, current as Map<ServerValue, ServerValue>);
          case Set:
            return this.generateSetNode(id, current as Set<ServerValue>);
          case Object:
            return this.generateObjectNode(id, current as Record<string, ServerValue>, false);
          case undefined:
            return this.generateObjectNode(id, current as Record<string, ServerValue>, true);
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
        // Generator functions don't have a global constructor
        if (Symbol.iterator in current) {
          return this.generateIterableNode(id, current);
        }
        throw new Error('Unsupported type');
      }
      default:
        throw new Error('Unsupported type');
    }
  }
}

export default function parseSync(
  ctx: ParserContext,
  current: ServerValue,
) {
  const result = new SyncParser(ctx).parse(current);
  const isObject = result.t === SerovalNodeType.Object
    || result.t === SerovalNodeType.Iterable;
  return [result, createRef(ctx, current, false), isObject] as const;
}
