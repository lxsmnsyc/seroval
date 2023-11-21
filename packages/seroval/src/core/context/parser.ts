import UnsupportedTypeError from '../UnsupportedTypeError';
import assert from '../utils/assert';
import {
  createIndexedValueNode,
  createReferenceNode,
  createWKSymbolNode,
} from '../base-primitives';
import { ALL_ENABLED, Feature } from '../compat';
import type { WellKnownSymbols } from '../constants';
import {
  INV_SYMBOL_REF,
  SerovalNodeType,
} from '../constants';
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

  protected getReference<T>(current: T): number | SerovalIndexedValueNode | SerovalReferenceNode {
    const registeredID = this.refs.get(current);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    if (hasReferenceID(current)) {
      return createReferenceNode(id, current);
    }
    return id;
  }

  protected getStrictReference<T>(current: T): SerovalIndexedValueNode | SerovalReferenceNode {
    const registeredID = this.refs.get(current);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(current, id);
    return createReferenceNode(id, current);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  protected parseFunction(current: Function): SerovalNode {
    assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
    return this.getStrictReference(current);
  }

  protected parseWKSymbol(
    current: symbol,
  ): SerovalIndexedValueNode | SerovalWKSymbolNode | SerovalReferenceNode {
    assert(this.features & Feature.Symbol, new UnsupportedTypeError(current));
    const registeredID = this.refs.get(current);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const isValid = current in INV_SYMBOL_REF;
    assert(current in INV_SYMBOL_REF || hasReferenceID(current), new Error('Cannot serialize symbol without reference ID.'));
    const id = this.refs.size;
    this.refs.set(current, id);
    if (isValid) {
      return createWKSymbolNode(id, current as WellKnownSymbols);
    }
    return createReferenceNode(id, current);
  }

  protected parseSpecialReference(
    ref: SpecialReference,
  ): SerovalIndexedValueNode | SerovalSpecialReferenceNode {
    const specialRef = SPECIAL_REFS[ref];
    const registeredID = this.refs.get(specialRef);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(specialRef, id);
    return {
      t: SerovalNodeType.SpecialReference,
      i: id,
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

  protected parseIteratorFactory(): SerovalIndexedValueNode | SerovalIteratorFactoryNode {
    const registeredID = this.refs.get(ITERATOR);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(ITERATOR, id);
    return {
      t: SerovalNodeType.IteratorFactory,
      i: id,
      s: undefined,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parseWKSymbol(Symbol.iterator),
      b: undefined,
      o: undefined,
    };
  }

  protected parseAsyncIteratorFactory(
    streaming: 0 | 1,
  ): SerovalIndexedValueNode | SerovalAsyncIteratorFactoryNode {
    const registeredID = this.refs.get(ASYNC_ITERATOR);
    if (registeredID != null) {
      this.markRef(registeredID);
      return createIndexedValueNode(registeredID);
    }
    const id = this.refs.size;
    this.refs.set(ASYNC_ITERATOR, id);
    return {
      t: SerovalNodeType.AsyncIteratorFactory,
      i: id,
      s: streaming,
      l: undefined,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parseWKSymbol(Symbol.asyncIterator),
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
