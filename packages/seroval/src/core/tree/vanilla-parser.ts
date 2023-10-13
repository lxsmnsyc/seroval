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

export type VanillaParserContextOptions = BaseParserContextOptions;

export default class VanillaParserContext extends BaseParserContext {
  ids: Map<unknown, number> = new Map();

  marked: Set<number> = new Set();

  constructor(options: Partial<VanillaParserContextOptions> = {}) {
    super(options);
  }

  createIndexedValue<T>(current: T): number {
    const ref = this.ids.get(current);
    if (ref == null) {
      const id = this.ids.size;
      this.ids.set(current, id);
      return id;
    }
    this.marked.add(ref);
    return ref;
  }

  protected parseArrayBuffer(
    current: ArrayBuffer,
  ): SerovalIndexedValueNode | SerovalReferenceNode | SerovalArrayBufferNode {
    const id = this.createIndexedValue(current);
    if (this.marked.has(id)) {
      return createIndexedValueNode(id);
    }
    if (hasReferenceID(current)) {
      return createReferenceNode(id, current);
    }
    return createArrayBufferNode(id, current);
  }

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

  protected parseSymbol(
    current: symbol,
  ): SerovalIndexedValueNode | SerovalReferenceNode | SerovalWKSymbolNode {
    const id = this.createIndexedValue(current);
    if (this.marked.has(id)) {
      return createIndexedValueNode(id);
    }
    if (hasReferenceID(current)) {
      return createReferenceNode(id, current);
    }
    return createWKSymbolNode(id, current as WellKnownSymbols);
  }

  protected parseFunction<T>(
    current: T,
  ): SerovalIndexedValueNode | SerovalReferenceNode {
    assert(hasReferenceID(current), new Error('Cannot serialize function without reference ID.'));
    const id = this.createIndexedValue(current);
    if (this.marked.has(id)) {
      return createIndexedValueNode(id);
    }
    return createReferenceNode(id, current);
  }
}
