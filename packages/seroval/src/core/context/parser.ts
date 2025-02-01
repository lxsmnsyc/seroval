import {
  createIndexedValueNode,
  createReferenceNode,
  createWKSymbolNode,
} from '../base-primitives';
import { ALL_ENABLED } from '../compat';
import type { WellKnownSymbols } from '../constants';
import { INV_SYMBOL_REF, NIL, SerovalNodeType } from '../constants';
import { SerovalUnsupportedTypeError } from '../errors';
import { createSerovalNode } from '../node';
import type { Plugin, PluginAccessOptions, SerovalMode } from '../plugin';
import { hasReferenceID } from '../reference';
import {
  ASYNC_ITERATOR,
  ITERATOR,
  SPECIAL_REFS,
  SpecialReference,
} from '../special-reference';
import type {
  SerovalAbortSignalConstructorNode,
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

export const enum ParserNodeType {
  Fresh = 0,
  Indexed = 1,
  Referenced = 2,
}

export interface FreshNode {
  type: ParserNodeType.Fresh;
  value: number;
}

export interface IndexedNode {
  type: ParserNodeType.Indexed;
  value: SerovalIndexedValueNode;
}

export interface ReferencedNode {
  type: ParserNodeType.Referenced;
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
        type: ParserNodeType.Indexed,
        value: createIndexedValueNode(registeredId),
      };
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    return {
      type: ParserNodeType.Fresh,
      value: id,
    };
  }

  protected getReference<T>(current: T): ObjectNode {
    const indexed = this.getIndexedValue(current);
    if (indexed.type === ParserNodeType.Indexed) {
      return indexed;
    }
    if (hasReferenceID(current)) {
      return {
        type: ParserNodeType.Referenced,
        value: createReferenceNode(indexed.value, current),
      };
    }
    return indexed;
  }

  protected parseWellKnownSymbol(
    current: symbol,
  ): SerovalIndexedValueNode | SerovalWKSymbolNode | SerovalReferenceNode {
    const ref = this.getReference(current);
    if (ref.type !== ParserNodeType.Fresh) {
      return ref.value;
    }
    assert(current in INV_SYMBOL_REF, new SerovalUnsupportedTypeError(current));
    return createWKSymbolNode(ref.value, current as WellKnownSymbols);
  }

  protected parseSpecialReference(
    ref: SpecialReference,
  ): SerovalIndexedValueNode | SerovalSpecialReferenceNode {
    const result = this.getIndexedValue(SPECIAL_REFS[ref]);
    if (result.type === ParserNodeType.Indexed) {
      return result.value;
    }
    return createSerovalNode(
      SerovalNodeType.SpecialReference,
      result.value,
      ref,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
    );
  }

  protected parseIteratorFactory():
    | SerovalIndexedValueNode
    | SerovalIteratorFactoryNode {
    const result = this.getIndexedValue(ITERATOR);
    if (result.type === ParserNodeType.Indexed) {
      return result.value;
    }
    return createSerovalNode(
      SerovalNodeType.IteratorFactory,
      result.value,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      this.parseWellKnownSymbol(Symbol.iterator),
      NIL,
      NIL,
    );
  }

  protected parseAsyncIteratorFactory():
    | SerovalIndexedValueNode
    | SerovalAsyncIteratorFactoryNode {
    const result = this.getIndexedValue(ASYNC_ITERATOR);
    if (result.type === ParserNodeType.Indexed) {
      return result.value;
    }
    return createSerovalNode(
      SerovalNodeType.AsyncIteratorFactory,
      result.value,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      [
        this.parseSpecialReference(SpecialReference.PromiseConstructor),
        this.parseWellKnownSymbol(Symbol.asyncIterator),
      ],
      NIL,
      NIL,
      NIL,
    );
  }

  protected createObjectNode(
    id: number,
    current: Record<string, unknown>,
    empty: boolean,
    record: SerovalObjectRecordNode,
  ): SerovalObjectNode | SerovalNullConstructorNode {
    return createSerovalNode(
      empty ? SerovalNodeType.NullConstructor : SerovalNodeType.Object,
      id,
      NIL,
      NIL,
      NIL,
      NIL,
      record,
      NIL,
      NIL,
      NIL,
      NIL,
      getObjectFlag(current),
    );
  }

  protected createMapNode(
    id: number,
    k: SerovalNode[],
    v: SerovalNode[],
    s: number,
  ): SerovalMapNode {
    return createSerovalNode(
      SerovalNodeType.Map,
      id,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      { k, v, s },
      NIL,
      this.parseSpecialReference(SpecialReference.MapSentinel),
      NIL,
      NIL,
    );
  }

  protected createPromiseConstructorNode(
    id: number,
  ): SerovalPromiseConstructorNode {
    return createSerovalNode(
      SerovalNodeType.PromiseConstructor,
      id,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      this.parseSpecialReference(SpecialReference.PromiseConstructor),
      NIL,
      NIL,
    );
  }

  protected createAbortSignalConstructorNode(
    id: number,
  ): SerovalAbortSignalConstructorNode {
    return createSerovalNode(
      SerovalNodeType.AbortSignalConstructor,
      id,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      NIL,
      this.parseSpecialReference(SpecialReference.AbortSignalConstructor),
      NIL,
      NIL,
    );
  }
}
