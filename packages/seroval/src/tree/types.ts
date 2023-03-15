import { PrimitiveValue } from '../types';

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

export type SerovalPrimitiveNode = [
  type: SerovalNodeType.Primitive,
  value: PrimitiveValue,
];
export type SerovalReferenceNode = [type: SerovalNodeType.Reference, value: number];
export type SerovalSemiPrimitiveNode =
  | [type: SerovalNodeType.BigInt, value: string]
  | [type: SerovalNodeType.Date, value: string, id: number]
  | [type: SerovalNodeType.RegExp, value: string, id: number]
  | [
    type: SerovalNodeType.TypedArray,
    value: [constructor: string, array: string, byteOffset: number],
    id: number
  ]
  | [
    type: SerovalNodeType.BigIntTypedArray,
    value: [constructor: string, array: string, byteOffset: number],
    id: number
  ];

export type SerovalDictionaryNode = Record<string, SerovalNode>;
export type SerovalSetNode = [type: SerovalNodeType.Set, value: SerovalNode[], id: number];
export type SerovalMapNode = [
  type: SerovalNodeType.Map,
  value: [key: SerovalNode[], value: SerovalNode[], size: number],
  id: number
];
export type SerovalArrayNode = [type: SerovalNodeType.Array, value: SerovalNode[], id: number];
export type SerovalObjectNode = [
  type: SerovalNodeType.Object,
  value: SerovalDictionaryNode,
  id: number
];
export type SerovalNullConstructorNode = [
  type: SerovalNodeType.NullConstructor,
  value: SerovalDictionaryNode,
  id: number,
];
export type SerovalPromiseNode = [type: SerovalNodeType.Promise, value: SerovalNode, id: number];
export type SerovalErrorNode = [
  type: SerovalNodeType.Error,
  value: [
    constructor: string,
    message: string,
    options?: SerovalDictionaryNode,
  ],
  id: number
];
export type SerovalAggregateErrorNode = [
  type: SerovalNodeType.AggregateError,
  value: [
    message: string,
    options: SerovalDictionaryNode | undefined,
    errors: SerovalNode,
  ],
  id: number
];

export type SerovalIterableNode = [
  type: SerovalNodeType.Iterable,
  value: [
    options: SerovalDictionaryNode | undefined,
    items: SerovalNode[],
  ],
  id: number,
];

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
