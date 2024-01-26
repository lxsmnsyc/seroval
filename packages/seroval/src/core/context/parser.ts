import {
  createIndexedValueNode,
  createReferenceNode,
  createWKSymbolNode,
} from '../base-primitives';
import { ALL_ENABLED } from '../compat';
import type { WellKnownSymbols } from '../constants';
import { INV_SYMBOL_REF, SerovalNodeType } from '../constants';
import { SerovalUnsupportedTypeError } from '../errors';
import type { Plugin, PluginAccessOptions, SerovalMode } from '../plugin';
import { hasReferenceID } from '../reference';
import {
  ASYNC_ITERATOR,
  ITERATOR,
  SPECIAL_REFS,
  SpecialReference,
} from '../special-reference';
import type {
  SerovalAsyncIteratorFactoryNode,
  SerovalIndexedValueNode,
  SerovalIteratorFactoryNode,
  SerovalMapNode,
  SerovalNode,
  SerovalNullConstructorNode,
  SerovalObjectNode,
  SerovalObjectRecordNode,
  SerovalPromiseConstructorNode,
  SerovalReferenceNode,
  SerovalSpecialReferenceNode,
  SerovalWKSymbolNode,
} from '../types';
import assert from '../utils/assert';
import { getObjectFlag } from '../utils/get-object-flag';

export interface BaseParserContextOptions extends PluginAccessOptions {
  disabledFeatures?: number;
  refs?: Map<unknown, number>;
}

const enum NodeType {
  Fresh = 0,
  Indexed = 1,
  Referenced = 2,
}

interface FreshNode {
  type: NodeType.Fresh;
  value: number;
}

interface IndexedNode {
  type: NodeType.Indexed;
  value: SerovalIndexedValueNode;
}

interface ReferencedNode {
  type: NodeType.Referenced;
  value: SerovalReferenceNode;
}

type ObjectNode = FreshNode | IndexedNode | ReferencedNode;

export abstract class BaseParserContext implements PluginAccessOptions {
  abstract readonly mode: SerovalMode;

  features: number;

  marked = new Set<number>();

  refs: Map<unknown, number>;

  plugins?: Plugin<any, any>[] | undefined;

  constructor(options: BaseParserContextOptions) {
    this.plugins = options.plugins;
    this.features = ALL_ENABLED ^ (options.disabledFeatures || 0);
    this.refs = options.refs || new Map<unknown, number>();
  }

  protected markRef(id: number): void {
    this.marked.add(id);
  }

  protected isMarked(id: number): boolean {
    return this.marked.has(id);
  }

  protected getIndexedValue<T>(current: T): FreshNode | IndexedNode {
    const registeredId = this.refs.get(current);
    if (registeredId != null) {
      this.markRef(registeredId);
      return {
        type: NodeType.Indexed,
        value: createIndexedValueNode(registeredId),
      };
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    return {
      type: NodeType.Fresh,
      value: id,
    };
  }

  protected getReference<T>(current: T): ObjectNode {
    const indexed = this.getIndexedValue(current);
    if (indexed.type === NodeType.Indexed) {
      return indexed;
    }
    if (hasReferenceID(current)) {
      return {
        type: NodeType.Referenced,
        value: createReferenceNode(indexed.value, current),
      };
    }
    return indexed;
  }

  protected getStrictReference<T>(
    current: T,
  ): SerovalIndexedValueNode | SerovalReferenceNode {
    assert(hasReferenceID(current), new SerovalUnsupportedTypeError(current));
    const result = this.getIndexedValue(current);
    if (result.type === NodeType.Indexed) {
      return result.value;
    }
    return createReferenceNode(result.value, current);
  }

  protected parseFunction(
    current: (...args: unknown[]) => unknown,
  ): SerovalNode {
    return this.getStrictReference(current);
  }

  protected parseWellKnownSymbol(
    current: symbol,
  ): SerovalIndexedValueNode | SerovalWKSymbolNode | SerovalReferenceNode {
    const ref = this.getReference(current);
    if (ref.type !== NodeType.Fresh) {
      return ref.value;
    }
    assert(current in INV_SYMBOL_REF, new SerovalUnsupportedTypeError(current));
    return createWKSymbolNode(ref.value, current as WellKnownSymbols);
  }

  protected parseSpecialReference(
    ref: SpecialReference,
  ): SerovalIndexedValueNode | SerovalSpecialReferenceNode {
    const result = this.getIndexedValue(SPECIAL_REFS[ref]);
    if (result.type === NodeType.Indexed) {
      return result.value;
    }
    return {
      t: SerovalNodeType.SpecialReference,
      i: result.value,
      s: ref,
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

  protected parseIteratorFactory():
    | SerovalIndexedValueNode
    | SerovalIteratorFactoryNode {
    const result = this.getIndexedValue(ITERATOR);
    if (result.type === NodeType.Indexed) {
      return result.value;
    }
    return {
      t: SerovalNodeType.IteratorFactory,
      i: result.value,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parseWellKnownSymbol(Symbol.iterator),
      b: undefined,
      o: undefined,
    };
  }

  protected parseAsyncIteratorFactory():
    | SerovalIndexedValueNode
    | SerovalAsyncIteratorFactoryNode {
    const result = this.getIndexedValue(ASYNC_ITERATOR);
    if (result.type === NodeType.Indexed) {
      return result.value;
    }
    return {
      t: SerovalNodeType.AsyncIteratorFactory,
      i: result.value,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: [
        this.parseSpecialReference(SpecialReference.PromiseConstructor),
        this.parseWellKnownSymbol(Symbol.asyncIterator),
      ],
      f: undefined,
      b: undefined,
      o: undefined,
    };
  }

  protected createObjectNode(
    id: number,
    current: Record<string, unknown>,
    empty: boolean,
    record: SerovalObjectRecordNode,
  ): SerovalObjectNode | SerovalNullConstructorNode {
    return {
      t: empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: record,
      e: undefined,
      a: undefined,
      f: undefined,
      b: undefined,
      o: getObjectFlag(current),
    };
  }

  protected createMapNode(
    id: number,
    k: SerovalNode[],
    v: SerovalNode[],
    s: number,
  ): SerovalMapNode {
    return {
      t: SerovalNodeType.Map,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: { k, v, s },
      a: undefined,
      f: this.parseSpecialReference(SpecialReference.MapSentinel),
      b: undefined,
      o: undefined,
    };
  }

  protected createPromiseConstructorNode(
    id: number,
  ): SerovalPromiseConstructorNode {
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
      f: this.parseSpecialReference(SpecialReference.PromiseConstructor),
      b: undefined,
      o: undefined,
    };
  }
}
