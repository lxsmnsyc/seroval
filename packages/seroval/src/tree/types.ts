/* eslint-disable max-classes-per-file */
import { BigIntTypedArrayValue, PrimitiveValue, TypedArrayValue } from '../types';

export const enum SerovalNodeType {
  Primitive,
  BigInt,
  Reference,
  Date,
  RegExp,
  Set,
  Map,
  Array,
  Object,
  NullConstructor,
  Promise,
  Error,
  AggregateError,
  Iterable,
  TypedArray,
  BigIntTypedArray,
}

export interface SerovalBaseNode {
  // Type of the node
  t?: SerovalNodeType;
  // Serialized value
  s?: PrimitiveValue;
  // Reference ID
  i?: number;
  // Size/Byte offset
  l?: number;
  // Constructor name
  c?: string;
  // dictionary
  d?: SerovalDictionaryNode;
  // message
  m?: string;
  // next node
  n?: SerovalNode;
  // array of nodes
  a?: SerovalNode[];
}

export class SerovalObjectRecordNode {
  k: string[];

  v: SerovalNode[];

  s: number;

  constructor(k: string[], v: SerovalNode[], s: number) {
    this.k = k;
    this.v = v;
    this.s = s;
  }
}

export class SerovalMapRecordNode {
  k: SerovalNode[];

  v: SerovalNode[];

  s: number;

  constructor(k: SerovalNode[], v: SerovalNode[], s: number) {
    this.k = k;
    this.v = v;
    this.s = s;
  }
}

export type SerovalDictionaryNode =
  | SerovalObjectRecordNode
  | SerovalMapRecordNode;

export class SerovalPrimitiveNode implements SerovalBaseNode {
  t: SerovalNodeType.Primitive = SerovalNodeType.Primitive;

  s: string | number | null;

  constructor(current: string | number | null) {
    this.s = current;
  }
}

export class SerovalReferenceNode implements SerovalBaseNode {
  t: SerovalNodeType.Reference = SerovalNodeType.Reference;

  i: number;

  constructor(id: number) {
    this.i = id;
  }
}

export class SerovalBigIntNode implements SerovalBaseNode {
  t: SerovalNodeType.BigInt = SerovalNodeType.BigInt;

  s: string;

  constructor(current: bigint) {
    this.s = `${current}n`;
  }
}

export class SerovalDateNode implements SerovalBaseNode {
  t: SerovalNodeType.Date = SerovalNodeType.Date;

  i: number;

  s: string;

  constructor(id: number, current: Date) {
    this.i = id;
    this.s = current.toISOString();
  }
}

export class SerovalRegExpNode implements SerovalBaseNode {
  t: SerovalNodeType.RegExp = SerovalNodeType.RegExp;

  i: number;

  s: string;

  constructor(id: number, current: RegExp) {
    this.i = id;
    this.s = String(current);
  }
}

export class SerovalTypedArrayNode implements SerovalBaseNode {
  t: SerovalNodeType.TypedArray = SerovalNodeType.TypedArray;

  i: number;

  s: string;

  l: number;

  c: string;

  constructor(id: number, current: TypedArrayValue) {
    this.i = id;
    this.s = current.toString();
    this.l = current.byteOffset;
    this.c = current.constructor.name;
  }
}

export class SerovalBigIntTypedArrayNode implements SerovalBaseNode {
  t: SerovalNodeType.BigIntTypedArray = SerovalNodeType.BigIntTypedArray;

  i: number;

  s: string;

  l: number;

  c: string;

  constructor(id: number, current: BigIntTypedArrayValue) {
    let result = '';
    const cap = current.length - 1;
    for (let i = 0; i < cap; i++) {
      result += `${current[i]}n,`;
    }
    result += `"${current[cap]}"`;

    this.i = id;
    this.s = result;
    this.l = current.byteOffset;
    this.c = current.constructor.name;
  }
}

export type SerovalSemiPrimitiveNode =
  | SerovalBigIntNode
  | SerovalDateNode
  | SerovalRegExpNode
  | SerovalTypedArrayNode
  | SerovalBigIntTypedArrayNode;

export class SerovalSetNode implements SerovalBaseNode {
  t: SerovalNodeType.Set = SerovalNodeType.Set;

  i: number;

  a: SerovalNode[];

  constructor(id: number, a: SerovalNode[]) {
    this.i = id;
    this.a = a;
  }
}

export class SerovalMapNode implements SerovalBaseNode {
  t: SerovalNodeType.Map = SerovalNodeType.Map;

  i: number;

  d: SerovalMapRecordNode;

  constructor(id: number, d: SerovalMapRecordNode) {
    this.i = id;
    this.d = d;
  }
}

export class SerovalArrayNode implements SerovalBaseNode {
  t: SerovalNodeType.Array = SerovalNodeType.Array;

  i: number;

  a: SerovalNode[];

  constructor(id: number, a: SerovalNode[]) {
    this.i = id;
    this.a = a;
  }
}

export class SerovalObjectNode implements SerovalBaseNode {
  t: SerovalNodeType.Object = SerovalNodeType.Object;

  i: number;

  d: SerovalObjectRecordNode;

  constructor(id: number, d: SerovalObjectRecordNode) {
    this.i = id;
    this.d = d;
  }
}

export class SerovalNullConstructorNode implements SerovalBaseNode {
  t: SerovalNodeType.NullConstructor = SerovalNodeType.NullConstructor;

  i: number;

  d: SerovalObjectRecordNode;

  constructor(id: number, d: SerovalObjectRecordNode) {
    this.i = id;
    this.d = d;
  }
}

export class SerovalPromiseNode implements SerovalBaseNode {
  t: SerovalNodeType.Promise = SerovalNodeType.Promise;

  i: number;

  n: SerovalNode;

  constructor(id: number, n: SerovalNode) {
    this.i = id;
    this.n = n;
  }
}

export class SerovalErrorNode implements SerovalBaseNode {
  t: SerovalNodeType.Error = SerovalNodeType.Error;

  i: number;

  c: string;

  m: string;

  d: SerovalObjectRecordNode | undefined;

  constructor(id: number, c: string, m: string, d: SerovalObjectRecordNode | undefined) {
    this.i = id;
    this.c = c;
    this.m = m;
    this.d = d;
  }
}

export class SerovalAggregateErrorNode implements SerovalBaseNode {
  t: SerovalNodeType.AggregateError = SerovalNodeType.AggregateError;

  i: number;

  m: string;

  d: SerovalObjectRecordNode | undefined;

  n: SerovalNode;

  constructor(id: number, m: string, d: SerovalObjectRecordNode | undefined, n: SerovalNode) {
    this.i = id;
    this.m = m;
    this.d = d;
    this.n = n;
  }
}

export class SerovalIterableNode implements SerovalBaseNode {
  t: SerovalNodeType.Iterable = SerovalNodeType.Iterable;

  i: number;

  d: SerovalObjectRecordNode | undefined;

  a: SerovalNode[];

  constructor(id: number, d: SerovalObjectRecordNode | undefined, a: SerovalNode[]) {
    this.i = id;
    this.d = d;
    this.a = a;
  }
}

export type SerovalNode =
  | SerovalPrimitiveNode
  | SerovalReferenceNode
  | SerovalSemiPrimitiveNode
  | SerovalSetNode
  | SerovalMapNode
  | SerovalArrayNode
  | SerovalObjectNode
  | SerovalNullConstructorNode
  | SerovalPromiseNode
  | SerovalErrorNode
  | SerovalAggregateErrorNode
  | SerovalIterableNode;
