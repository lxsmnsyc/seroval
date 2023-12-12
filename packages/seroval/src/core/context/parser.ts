import assert from '../utils/assert';
import {
  createIndexedValueNode,
  createReferenceNode,
  createWKSymbolNode,
} from '../base-primitives';
import { ALL_ENABLED } from '../compat';
import type { WellKnownSymbols } from '../constants';
import { INV_SYMBOL_REF, SerovalNodeType } from '../constants';
import type { Plugin, PluginAccessOptions, SerovalMode } from '../plugin';
import { hasReferenceID } from '../reference';
import {
  SpecialReference,
  ASYNC_ITERATOR,
  ITERATOR,
  SPECIAL_REFS,
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
  SerovalReferenceNode,
  SerovalSpecialReferenceNode,
  SerovalWKSymbolNode,
} from '../types';
import { getObjectFlag } from '../utils/get-object-flag';

export interface BaseParserContextOptions extends PluginAccessOptions {
  disabledFeatures?: number;
  refs?: Map<unknown, number>;
}

interface FreshNode {
  type: 0;
  value: number;
}

interface IndexedNode {
  type: 1;
  value: SerovalIndexedValueNode;
}

interface ReferencedNode {
  type: 2;
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
        type: 1,
        value: createIndexedValueNode(registeredId),
      };
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    return {
      type: 0,
      value: id,
    };
  }

  protected getReference<T>(current: T): ObjectNode {
    const indexed = this.getIndexedValue(current);
    if (indexed.type === 1) {
      return indexed;
    }
    if (hasReferenceID(current)) {
      return {
        type: 2,
        value: createReferenceNode(indexed.value, current),
      };
    }
    return indexed;
  }

  protected getStrictReference<T>(
    current: T,
  ): SerovalIndexedValueNode | SerovalReferenceNode {
    assert(
      hasReferenceID(current),
      new Error(
        'Cannot serialize ' + typeof current + ' without reference ID.',
      ),
    );
    const result = this.getIndexedValue(current);
    if (result.type === 1) {
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
    if (ref.type !== 0) {
      return ref.value;
    }
    assert(
      current in INV_SYMBOL_REF,
      new Error('Cannot serialized unsupported symbol.'),
    );
    return createWKSymbolNode(ref.value, current as WellKnownSymbols);
  }

  protected parseSpecialReference(
    ref: SpecialReference,
  ): SerovalIndexedValueNode | SerovalSpecialReferenceNode {
    const result = this.getIndexedValue(SPECIAL_REFS[ref]);
    if (result.type === 1) {
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
    if (result.type === 1) {
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
    if (result.type === 1) {
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
}
