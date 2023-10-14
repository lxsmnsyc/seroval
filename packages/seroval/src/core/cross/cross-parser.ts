import type { BigIntTypedArrayValue, TypedArrayValue } from '../../types';
import assert from '../assert';
import {
  createArrayBufferNode,
  createIndexedValueNode,
  createReferenceNode,
  createWKSymbolNode,
} from '../base-primitives';
import { SerovalNodeType, type WellKnownSymbols } from '../constants';
import type { BaseParserContextOptions } from '../parser-context';
import { BaseParserContext } from '../parser-context';
import { hasReferenceID } from '../reference';
import type {
  SerovalArrayBufferNode,
  SerovalBigIntTypedArrayNode,
  SerovalDataViewNode,
  SerovalIndexedValueNode,
  SerovalReferenceNode,
  SerovalTypedArrayNode,
  SerovalWKSymbolNode,
} from '../types';

export interface CrossParserContextOptions extends BaseParserContextOptions {
  scopeId?: string;
  refs?: Map<unknown, number>;
}

export default class CrossParserContext extends BaseParserContext {
  scopeId?: string;

  refs: Map<unknown, number>;

  constructor(options: Partial<CrossParserContextOptions> = {}) {
    super(options);
    this.scopeId = options.scopeId;
    this.refs = options.refs || new Map<unknown, number>();
  }

  /**
   * @private
   */
  protected createIndexedValue<T>(current: T): number {
    const ref = this.refs.get(current);
    if (ref == null) {
      const id = this.refs.size;
      this.refs.set(current, id);
      return id;
    }
    return ref;
  }

  /**
   * @private
   */
  protected parseArrayBuffer(
    current: ArrayBuffer,
  ): SerovalIndexedValueNode | SerovalReferenceNode | SerovalArrayBufferNode {
    const id = this.refs.get(current);
    if (id != null) {
      return createIndexedValueNode(id);
    }
    const newID = this.refs.size;
    this.refs.set(current, newID);
    if (hasReferenceID(current)) {
      return createReferenceNode(newID, current);
    }
    return createArrayBufferNode(newID, current);
  }

  /**
   * @private
   */
  protected parseTypedArray(
    id: number,
    current: TypedArrayValue,
  ): SerovalTypedArrayNode {
    return {
      t: SerovalNodeType.TypedArray,
      i: id,
      s: undefined,
      l: current.length,
      c: current.constructor.name,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parseArrayBuffer(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  /**
   * @private
   */
  protected parseBigIntTypedArray(
    id: number,
    current: BigIntTypedArrayValue,
  ): SerovalBigIntTypedArrayNode {
    return {
      t: SerovalNodeType.BigIntTypedArray,
      i: id,
      s: undefined,
      l: current.length,
      c: current.constructor.name,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parseArrayBuffer(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  /**
   * @private
   */
  protected parseDataView(
    id: number,
    current: DataView,
  ): SerovalDataViewNode {
    return {
      t: SerovalNodeType.DataView,
      i: id,
      s: undefined,
      l: current.byteLength,
      c: undefined,
      m: undefined,
      p: undefined,
      e: undefined,
      a: undefined,
      f: this.parseArrayBuffer(current.buffer),
      b: current.byteOffset,
      o: undefined,
    };
  }

  /**
   * @private
   */
  protected parseSymbol(
    current: symbol,
  ): SerovalIndexedValueNode | SerovalReferenceNode | SerovalWKSymbolNode {
    const id = this.refs.get(current);
    if (id != null) {
      return createIndexedValueNode(id);
    }
    const newID = this.refs.size;
    this.refs.set(current, newID);
    if (hasReferenceID(current)) {
      return createReferenceNode(newID, current);
    }
    return createWKSymbolNode(newID, current as WellKnownSymbols);
  }

  /**
   * @private
   */
  protected parseFunction<T>(
    current: T,
  ): SerovalIndexedValueNode | SerovalReferenceNode {
    assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
    const id = this.refs.get(current);
    if (id != null) {
      return createIndexedValueNode(id);
    }
    const newID = this.refs.size;
    this.refs.set(current, newID);
    return createReferenceNode(newID, current);
  }
}
