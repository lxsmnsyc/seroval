import {
  INV_SYMBOL_REF,
  NIL,
  SerovalNodeType,
  type SerovalTemporalType,
  type WellKnownSymbols,
} from './constants';
import { INFINITY_NODE, NAN_NODE, NEG_INFINITY_NODE, NEG_ZERO_NODE } from './literals';
import { SerovalUnsupportedTypeError } from './errors';
import { createSerovalNode } from './node';
import { serializeString } from './string';
import type {
  SerovalAggregateErrorNode,
  SerovalArrayNode,
  SerovalAsyncIteratorFactoryInstanceNode,
  SerovalBigIntNode,
  SerovalBigIntTypedArrayNode,
  SerovalBoxedNode,
  SerovalConstantNode,
  SerovalDataViewNode,
  SerovalDateNode,
  SerovalErrorNode,
  SerovalIndexedValueNode,
  SerovalIteratorFactoryInstanceNode,
  SerovalNode,
  SerovalNodeWithID,
  SerovalNumberNode,
  SerovalObjectRecordNode,
  SerovalPluginNode,
  SerovalReferenceNode,
  SerovalRegExpNode,
  SerovalSequenceNode,
  SerovalSetNode,
  SerovalStreamConstructorNode,
  SerovalStreamNextNode,
  SerovalStreamReturnNode,
  SerovalStreamThrowNode,
  SerovalStringNode,
  SerovalTemporalNode,
  SerovalTypedArrayNode,
  SerovalWKSymbolNode,
} from './types';
import { getErrorConstructor } from './utils/error';
import { getObjectFlag } from './utils/get-object-flag';
import type { BigIntTypedArrayValue, TypedArrayValue } from './utils/typed-array';
import { getTypedArrayName } from './utils/typed-array';

export function createNumberNode(value: number): SerovalConstantNode | SerovalNumberNode {
  switch (value) {
    case Number.POSITIVE_INFINITY:
      return INFINITY_NODE;
    case Number.NEGATIVE_INFINITY:
      return NEG_INFINITY_NODE;
  }
  if (value !== value) {
    return NAN_NODE;
  }
  if (Object.is(value, -0)) {
    return NEG_ZERO_NODE;
  }
  return createSerovalNode(SerovalNodeType.Number, NIL, value);
}

export function createStringNode(value: string): SerovalStringNode {
  return createSerovalNode(SerovalNodeType.String, NIL, serializeString(value));
}

export function createBigIntNode(current: bigint): SerovalBigIntNode {
  return createSerovalNode(SerovalNodeType.BigInt, NIL, '' + current);
}

export function createIndexedValueNode(id: number): SerovalIndexedValueNode {
  return createSerovalNode(SerovalNodeType.IndexedValue, id);
}

export function createDateNode(id: number, current: Date): SerovalDateNode {
  const timestamp = current.valueOf();
  return createSerovalNode(
    SerovalNodeType.Date,
    id,
    timestamp === timestamp ? current.toISOString() : '',
  );
}

type SerovalTemporalValue =
  | Temporal.Instant
  | Temporal.Duration
  | Temporal.PlainDate
  | Temporal.PlainDateTime
  | Temporal.PlainMonthDay
  | Temporal.PlainTime
  | Temporal.PlainYearMonth
  | Temporal.ZonedDateTime;

export function createTemporalNode(
  id: number,
  type: SerovalTemporalType,
  current: SerovalTemporalValue,
): SerovalTemporalNode {
  return createSerovalNode(SerovalNodeType.Temporal, id, current.toString(), type);
}

// Own `source` and `flags` properties on the value cannot replace these
// getters. The `source` getter reads the RegExp's internal state and throws
// for anything that is not a real RegExp, such as a Proxy around one. The
// `flags` getter only ever returns flag letters.
const getRegExpSource = Object.getOwnPropertyDescriptor(RegExp.prototype, 'source')!.get!;
const getRegExpFlags = Object.getOwnPropertyDescriptor(RegExp.prototype, 'flags')!.get!;

export function createRegExpNode(id: number, current: RegExp): SerovalRegExpNode {
  return createSerovalNode(
    SerovalNodeType.RegExp,
    id,
    NIL,
    serializeString(getRegExpSource.call(current) as string),
    getRegExpFlags.call(current) as string,
  );
}

export function createWKSymbolNode(id: number, current: WellKnownSymbols): SerovalWKSymbolNode {
  return createSerovalNode(SerovalNodeType.WKSymbol, id, INV_SYMBOL_REF[current]);
}

export function createReferenceNode(id: number, referenceId: string): SerovalReferenceNode {
  return createSerovalNode(SerovalNodeType.Reference, id, serializeString(referenceId));
}

export function createPluginNode(
  id: number,
  tag: string,
  value: Record<string, SerovalNode>,
): SerovalPluginNode {
  return createSerovalNode(SerovalNodeType.Plugin, id, value, serializeString(tag));
}

export function createArrayNode(
  id: number,
  current: unknown[],
  parsedItems: SerovalArrayNode['a'],
): SerovalArrayNode {
  return createSerovalNode(
    SerovalNodeType.Array,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    parsedItems,
    NIL,
    NIL,
    getObjectFlag(current),
  );
}

export function createBoxedNode(id: number, boxed: SerovalNode): SerovalBoxedNode {
  return createSerovalNode(SerovalNodeType.Boxed, id, NIL, NIL, NIL, NIL, NIL, NIL, boxed);
}

// Same default cap as the ArrayBuffer deserialization limit
// (DEFAULT_MAX_BASE64_LENGTH).
const MAX_TYPED_ARRAY_LENGTH = 1_000_000;

export function createViewNode(
  type: SerovalNodeType.TypedArray | SerovalNodeType.BigIntTypedArray | SerovalNodeType.DataView,
  id: number,
  current: ArrayBufferView & { readonly length?: number },
  buffer: SerovalNode,
): SerovalTypedArrayNode | SerovalBigIntTypedArrayNode | SerovalDataViewNode {
  const isDataView = type === SerovalNodeType.DataView;
  const size = isDataView ? current.byteLength : current.length!;
  if (size > MAX_TYPED_ARRAY_LENGTH) {
    throw new SerovalUnsupportedTypeError(current);
  }
  return createSerovalNode(
    type,
    id,
    NIL,
    isDataView ? NIL : getTypedArrayName(current as TypedArrayValue | BigIntTypedArrayValue),
    NIL,
    NIL,
    NIL,
    NIL,
    buffer,
    current.byteOffset,
    NIL,
    size,
  );
}

export function createErrorNode(
  type: SerovalNodeType.Error | SerovalNodeType.AggregateError,
  id: number,
  current: Error,
  options: SerovalObjectRecordNode | undefined,
): SerovalErrorNode | SerovalAggregateErrorNode {
  return createSerovalNode(
    type,
    id,
    getErrorConstructor(current),
    NIL,
    serializeString(current.message),
    options,
  );
}

export function createSetNode(id: number, items: SerovalNode[]): SerovalSetNode {
  return createSerovalNode(SerovalNodeType.Set, id, NIL, NIL, NIL, NIL, NIL, items);
}

export function createIteratorFactoryInstanceNode(
  type: SerovalNodeType.IteratorFactoryInstance | SerovalNodeType.AsyncIteratorFactoryInstance,
  factory: SerovalNodeWithID,
  items: SerovalNodeWithID,
): SerovalIteratorFactoryInstanceNode | SerovalAsyncIteratorFactoryInstanceNode {
  return createSerovalNode(type, NIL, NIL, NIL, NIL, NIL, NIL, [factory, items]);
}

export function createStreamConstructorNode(
  id: number,
  factory: SerovalNodeWithID,
  sequence: SerovalNode[],
  live?: 1,
): SerovalStreamConstructorNode {
  return createSerovalNode(
    SerovalNodeType.StreamConstructor,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    sequence,
    factory,
    NIL,
    NIL,
    live,
  );
}

export type SerovalStreamEventNode =
  | SerovalStreamNextNode
  | SerovalStreamThrowNode
  | SerovalStreamReturnNode;

export function createStreamEventNode(
  type: SerovalStreamEventNode['t'],
  id: number,
  parsed: SerovalNode,
): SerovalStreamEventNode {
  return createSerovalNode(
    type,
    id,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    NIL,
    parsed,
  ) as SerovalStreamEventNode;
}

export function createSequenceNode(
  id: number,
  sequence: SerovalNode[],
  throwAt: number,
  doneAt: number,
): SerovalSequenceNode {
  return createSerovalNode(
    SerovalNodeType.Sequence,
    id,
    throwAt,
    NIL,
    NIL,
    NIL,
    NIL,
    sequence,
    NIL,
    NIL,
    NIL,
    doneAt,
  );
}
